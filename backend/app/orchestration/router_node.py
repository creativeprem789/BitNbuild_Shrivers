import json
import logging
from typing import Any, Dict, List
from app.config import settings
from app.db.repository import record_task_event
from app.db.session import async_session_factory
from app.events.event_bus import event_bus
from app.events.event_schemas import TaskRoutedPayload
from app.orchestration.state import TaskState

logger = logging.getLogger("task_harness.orchestration.router")

ROUTER_SYSTEM_PROMPT = """You are the Chief Task Router for the Interactive Multi-Agent Task Harness.
Analyze the user's task description and assign it to the most specialized agent.
The available agents and their capabilities are:
1. search_agent: Investigates queries, conducts research, analyzes data, gathers facts, and summarizes findings.
2. email_agent: Drafts, triages, composes, and prepares email communications.
3. calendar_agent: Schedules, creates, reads, and coordinates calendar events and meetings.
4. custom_agent: Handles ambiguous, contradictory, edge-case, or unclassified requests.

CRITICAL INSTRUCTIONS:
- Sequential Multi-Step Tasks: If a task requires researching, searching, or analyzing information BEFORE sending an email or booking a meeting, assign to 'search_agent' for the initial phase (the workflow will perform a handoff to subsequent agents).
- If the task mentions 'research analyst' or 'analyst', prioritize 'search_agent'.
- If the task mentions 'email specialist', prioritize 'email_agent'.
- If the task mentions 'calendar manager' or 'calendar coordinator', prioritize 'calendar_agent'.
- Do NOT route normal research, email, or scheduling tasks to 'custom_agent'. Assign to 'custom_agent' ONLY if the request is truly unclassifiable, contradictory, or lacks domain specificity (confidence < 0.60).
- Output ONLY valid JSON matching this schema:
{
  "agent_id": "email_agent" | "calendar_agent" | "search_agent" | "custom_agent",
  "confidence": 0.95,
  "reasoning": "Concise human-readable explanation of why this agent was selected."
}
"""


def _classify_offline(description: str) -> Dict[str, Any]:
    """
    Deterministic rule-based classification fallback when Gemini API is unavailable or offline.
    Ensures offline unit tests, complex multi-domain routing, and disconnected live demos never crash.
    """
    desc = description.lower()

    # Explicit agent mentions
    if "research analyst" in desc or "research agent" in desc:
        r = "Task explicitly requests the Research Analyst specialist."
        return {"agent_id": "search_agent", "confidence": 0.96, "reasoning": r, "reason": r}
    if "email specialist" in desc or "email agent" in desc:
        r = "Task explicitly requests the Email Specialist."
        return {"agent_id": "email_agent", "confidence": 0.96, "reasoning": r, "reason": r}
    if "calendar coordinator" in desc or "calendar manager" in desc or "calendar agent" in desc:
        r = "Task explicitly requests the Calendar Coordinator."
        return {"agent_id": "calendar_agent", "confidence": 0.96, "reasoning": r, "reason": r}
    if "executive resolver" in desc or "custom agent" in desc:
        r = "Task explicitly requests the Executive Resolver."
        return {"agent_id": "custom_agent", "confidence": 0.96, "reasoning": r, "reason": r}

    search_keywords = [
        "search", "research", "find", "lookup", "investigate", "competitor",
        "market", "trends", "benchmark", "analyze", "analyst", "gather",
        "survey", "explore", "data", "study", "fetch", "report"
    ]
    email_keywords = [
        "email", "draft an email", "send message", "inbox", "compose email",
        "notify", "forward to", "mail", "newsletter"
    ]
    cal_keywords = [
        "calendar", "schedule", "meeting", "appointment", "book a slot",
        "book conference", "reserve room"
    ]

    has_search = any(k in desc for k in search_keywords)
    has_email = any(k in desc for k in email_keywords)
    has_cal = any(k in desc for k in cal_keywords)

    s_idx = min([desc.find(k) for k in search_keywords if desc.find(k) != -1], default=9999)
    e_idx = min([desc.find(k) for k in email_keywords if desc.find(k) != -1], default=9999)
    c_idx = min([desc.find(k) for k in cal_keywords if desc.find(k) != -1], default=9999)

    # Initial action priority: If research is the first requested action in a multi-step prompt
    if has_search and (s_idx < e_idx or s_idx < c_idx):
        r = "Initial phase requires research and data analysis before downstream coordination."
        return {"agent_id": "search_agent", "confidence": 0.93, "reasoning": r, "reason": r}

    if has_cal and (c_idx <= s_idx and c_idx <= e_idx):
        r = "Task primarily involves scheduling or calendar event coordination."
        return {"agent_id": "calendar_agent", "confidence": 0.95, "reasoning": r, "reason": r}

    if has_email and (e_idx <= s_idx and e_idx <= c_idx):
        r = "Task involves composing or processing email communications."
        return {"agent_id": "email_agent", "confidence": 0.92, "reasoning": r, "reason": r}

    if has_search:
        r = "Task requires research, information retrieval, or data analysis."
        return {"agent_id": "search_agent", "confidence": 0.92, "reasoning": r, "reason": r}

    if has_cal:
        r = "Task involves scheduling or calendar event coordination."
        return {"agent_id": "calendar_agent", "confidence": 0.95, "reasoning": r, "reason": r}

    if has_email:
        r = "Task involves composing or processing email communications."
        return {"agent_id": "email_agent", "confidence": 0.92, "reasoning": r, "reason": r}

    if "unclear" in desc or "vague" in desc or "ambiguous" in desc or len(desc.split()) < 3:
        r = "Description is ambiguous and lacks clear domain intent."
        return {"agent_id": "custom_agent", "confidence": 0.40, "reasoning": r, "reason": r}

    r = "Complex multi-domain request assigned to Executive Resolver."
    return {"agent_id": "custom_agent", "confidence": 0.65, "reasoning": r, "reason": r}


async def classify_task(description: str) -> Dict[str, Any]:
    """
    Classifies task using Google Gemini via google-genai SDK or robust fallback.
    Enforces structured JSON output: {agent_id, confidence, reasoning}.
    """
    api_key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
    if not api_key:
        logger.info("Gemini API key not configured. Using deterministic classifier.")
        return _classify_offline(description)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            system_instruction=ROUTER_SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.0,
        )

        # Primary and candidate fallback models
        models_to_try: List[str] = [
            settings.ROUTER_MODEL,
            "gemini-flash-latest",
            "gemini-3.8-flash",
            "gemini-3.5-flash",
        ]
        seen_models = set()
        last_error = None

        for model_name in models_to_try:
            if model_name in seen_models:
                continue
            seen_models.add(model_name)

            try:
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=f"Classify this task description: '{description}'",
                    config=config,
                )

                content = response.text.strip()
                data = json.loads(content)
                agent_id = data.get("agent_id", "custom_agent")
                confidence = float(data.get("confidence", 0.5))
                reasoning = data.get("reasoning") or data.get("reason", "Classified via Gemini Router.")
                return {
                    "agent_id": agent_id,
                    "confidence": confidence,
                    "reasoning": reasoning,
                    "reason": reasoning,
                }
            except Exception as model_err:
                last_error = model_err
                logger.warning(f"Gemini call to {model_name} failed: {model_err}. Trying fallback model...")

        logger.warning(f"All Gemini models exhausted. Last error: {last_error}. Using deterministic rule-based classifier.")
        return _classify_offline(description)

    except Exception as e:
        logger.warning(f"Gemini client initialization failed: {e}. Falling back to rule-based.")
        return _classify_offline(description)


async def classify_and_route(state: TaskState) -> Dict[str, Any]:
    """
    Entry node in the LangGraph orchestration graph.
    - Classifies task into specialized agent.
    - If confidence < 0.6, deliberately falls back to custom_agent to prevent misrouting.
    - Writes task.routed event to DB and publishes to Redis.
    """
    logger.info(
        f"classify_and_route started for task: {state.task_id}",
        extra={"task_id": state.task_id},
    )

    classification = await classify_task(state.description)
    agent_id = classification.get("agent_id", "custom_agent")
    confidence = float(classification.get("confidence", 0.5))
    reasoning = classification.get("reasoning") or classification.get("reason", "Classified.")

    # Rule: If confidence < 0.6, do NOT guess — route to custom_agent as deliberate fallback
    if confidence < 0.60:
        logger.info(
            f"Classification confidence {confidence:.2f} < 0.60 for task {state.task_id}. "
            "Routing to custom_agent as deliberate fallback."
        )
        agent_id = "custom_agent"
        reasoning = (
            f"Deliberate fallback to custom_agent due to low routing confidence "
            f"({confidence:.2f} < 0.60). Avoids misrouting during execution."
        )

    # Persist transition to database first
    async with async_session_factory() as session:
        event = await record_task_event(
            session=session,
            task_id=state.task_id,
            event_type="task.routed",
            payload={
                "task_id": state.task_id,
                "agent_id": agent_id,
                "confidence": confidence,
                "reason": reasoning,
            },
            to_agent_id=agent_id,
            reason=reasoning,
        )

    # Publish to Redis event bus
    await event_bus.publish_event(
        task_id=state.task_id,
        payload=event.payload,
    )

    return {
        "status": "routed",
        "current_agent": agent_id,
        "route_confidence": confidence,
        "route_reason": reasoning,
        "history": state.history
        + [
            {
                "node": "classify_and_route",
                "assigned_agent": agent_id,
                "confidence": confidence,
                "reason": reasoning,
            }
        ],
    }
