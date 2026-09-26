import json
import logging
from typing import Any, Dict
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
1. email_agent: Drafts, triages, composes, and prepares email communications.
2. calendar_agent: Schedules, creates, reads, and coordinates calendar events and meetings.
3. search_agent: Investigates queries, conducts research, gathers facts, and summarizes findings.
4. custom_agent: Handles ambiguous, multi-domain, complex, or unclassified requests.

CRITICAL INSTRUCTIONS:
- You must evaluate your confidence score strictly between 0.0 and 1.0.
- If the task is unclear, contradictory, or lacks specificity, assign a confidence lower than 0.60.
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
    Ensures offline unit tests and disconnected live demos never crash.
    """
    desc = description.lower()

    search_keywords = ["search", "research", "find information", "lookup", "investigate", "competitor"]
    email_keywords = ["email", "draft an email", "send message", "inbox", "compose email"]
    cal_keywords = ["calendar", "schedule", "meeting", "appointment", "book a slot", "book conference"]

    has_search = any(k in desc for k in search_keywords)
    has_email = any(k in desc for k in email_keywords)
    has_cal = any(k in desc for k in cal_keywords)

    if has_search and has_email:
        s_idx = min([desc.find(k) for k in search_keywords if desc.find(k) != -1], default=999)
        e_idx = min([desc.find(k) for k in email_keywords if desc.find(k) != -1], default=999)
        if s_idx < e_idx:
            r = "Initial action requires research before composing the email deliverable."
            return {
                "agent_id": "search_agent",
                "confidence": 0.92,
                "reasoning": r,
                "reason": r,
            }

    if has_cal:
        r = "Task involves scheduling or calendar event coordination."
        return {
            "agent_id": "calendar_agent",
            "confidence": 0.95,
            "reasoning": r,
            "reason": r,
        }
    if has_email:
        r = "Task involves composing or processing email communications."
        return {
            "agent_id": "email_agent",
            "confidence": 0.92,
            "reasoning": r,
            "reason": r,
        }
    if has_search:
        r = "Task requires research, information retrieval, or data analysis."
        return {
            "agent_id": "search_agent",
            "confidence": 0.90,
            "reasoning": r,
            "reason": r,
        }
    if "unclear" in desc or "vague" in desc or "ambiguous" in desc or len(desc.split()) < 3:
        r = "Description is ambiguous and lacks clear domain intent."
        return {
            "agent_id": "custom_agent",
            "confidence": 0.40,
            "reasoning": r,
            "reason": r,
        }

    r = "Generic domain request best suited for executive resolver."
    return {
        "agent_id": "custom_agent",
        "confidence": 0.50,
        "reasoning": r,
        "reason": r,
    }


async def classify_task(description: str) -> Dict[str, Any]:
    """
    Classifies task using Google Gemini 2.5 Flash via google-genai SDK or robust fallback.
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

        response = await client.aio.models.generate_content(
            model=settings.ROUTER_MODEL,
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
    except Exception as e:
        logger.warning(f"Gemini classification failed or timed out: {e}. Falling back to rule-based.")
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
