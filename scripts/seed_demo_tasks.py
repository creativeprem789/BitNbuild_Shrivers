#!/usr/bin/env python3
"""
Seed demo tasks script for live hackathon presentation.
Inserts 2-3 pre-configured demo tasks illustrating:
  1. Single-agent resolution (Calendar scheduling with real API call)
  2. Dynamic multi-agent handoff (Search -> Email handoff)
  3. Paused/Blocked task awaiting clarification (Ready for /retry live demo)
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BASE_DIR))

from app.db.models import Agent, Task, TaskEvent
from app.db.session import async_session_factory, engine
from app.events.event_bus import event_bus


async def seed_demo_data():
    print("🌱 Connecting to database and seeding pre-configured demo tasks...")

    async with async_session_factory() as session:
        # Ensure agents exist
        default_agents = [
            Agent(id="email_agent", display_name="Email Specialist", role="Drafts communications", is_active=True),
            Agent(id="calendar_agent", display_name="Calendar Coordinator", role="Manages schedule", is_active=True),
            Agent(id="search_agent", display_name="Research Analyst", role="Investigates data", is_active=True),
            Agent(id="custom_agent", display_name="Executive Resolver", role="Handles edge cases", is_active=True),
        ]
        for a in default_agents:
            existing = await session.get(Agent, a.id)
            if not existing:
                session.add(a)
        await session.commit()

        # Task 1: Direct Calendar Resolution
        t1_id = uuid.uuid4()
        t1_created = datetime.now(timezone.utc) - timedelta(seconds=12)
        t1_completed = datetime.now(timezone.utc) - timedelta(seconds=9)
        task1 = Task(
            id=t1_id,
            description="Book a 30-minute sync with the design team tomorrow at 2 PM to review the virtual office UI",
            status="completed",
            current_agent_id="calendar_agent",
            created_at=t1_created,
            completed_at=t1_completed,
            duration_ms=2800,
        )
        session.add(task1)

        t1_events = [
            TaskEvent(
                task_id=t1_id,
                sequence_no=1,
                event_type="task.created",
                from_agent_id=None,
                to_agent_id=None,
                reason="Task submitted to harness",
                payload={"task_id": str(t1_id), "description": task1.description, "sequence_no": 1, "event": "task.created", "event_type": "task.created"},
                created_at=t1_created,
            ),
            TaskEvent(
                task_id=t1_id,
                sequence_no=2,
                event_type="task.routed",
                from_agent_id=None,
                to_agent_id="calendar_agent",
                reason="Identified calendar coordination intent with specific time parameter.",
                payload={"task_id": str(t1_id), "agent_id": "calendar_agent", "confidence": 0.98, "reason": "Identified calendar intent", "sequence_no": 2, "event": "task.routed", "event_type": "task.routed"},
                created_at=t1_created + timedelta(seconds=1),
            ),
            TaskEvent(
                task_id=t1_id,
                sequence_no=3,
                event_type="task.completed",
                from_agent_id="calendar_agent",
                to_agent_id=None,
                reason="Calendar event confirmed via external API integration.",
                payload={"task_id": str(t1_id), "duration_ms": 2800, "sequence_no": 3, "event": "task.completed", "event_type": "task.completed"},
                created_at=t1_completed,
            ),
        ]
        session.add_all(t1_events)

        # Task 2: Multi-agent Handoff (Search -> Email)
        t2_id = uuid.uuid4()
        t2_created = datetime.now(timezone.utc) - timedelta(seconds=30)
        t2_completed = datetime.now(timezone.utc) - timedelta(seconds=25)
        task2 = Task(
            id=t2_id,
            description="Research the latest benchmarks on LangGraph orchestration and email a 3-bullet summary to the leads",
            status="completed",
            current_agent_id="email_agent",
            created_at=t2_created,
            completed_at=t2_completed,
            duration_ms=4900,
        )
        session.add(task2)

        t2_events = [
            TaskEvent(
                task_id=t2_id,
                sequence_no=1,
                event_type="task.created",
                payload={"task_id": str(t2_id), "description": task2.description, "sequence_no": 1, "event": "task.created", "event_type": "task.created"},
                created_at=t2_created,
            ),
            TaskEvent(
                task_id=t2_id,
                sequence_no=2,
                event_type="task.routed",
                from_agent_id=None,
                to_agent_id="search_agent",
                reason="Task requires primary external research and comparative analysis.",
                payload={"task_id": str(t2_id), "agent_id": "search_agent", "confidence": 0.94, "reason": "Research intent detected", "sequence_no": 2, "event": "task.routed", "event_type": "task.routed"},
                created_at=t2_created + timedelta(seconds=1),
            ),
            TaskEvent(
                task_id=t2_id,
                sequence_no=3,
                event_type="task.handoff",
                from_agent_id="search_agent",
                to_agent_id="email_agent",
                reason="Research synthesis complete; handing off to email_agent to format executive briefing and send.",
                payload={"task_id": str(t2_id), "from_agent": "search_agent", "to_agent": "email_agent", "reason": "Handoff to email specialist to deliver summary", "sequence_no": 3, "event": "task.handoff", "event_type": "task.handoff"},
                created_at=t2_created + timedelta(seconds=3),
            ),
            TaskEvent(
                task_id=t2_id,
                sequence_no=4,
                event_type="task.completed",
                from_agent_id="email_agent",
                to_agent_id=None,
                reason="Briefing drafted and queued for dispatch.",
                payload={"task_id": str(t2_id), "duration_ms": 4900, "sequence_no": 4, "event": "task.completed", "event_type": "task.completed"},
                created_at=t2_completed,
            ),
        ]
        session.add_all(t2_events)

        # Task 3: Blocked Task (Ready for live demo retry action)
        t3_id = uuid.uuid4()
        t3_created = datetime.now(timezone.utc) - timedelta(seconds=60)
        task3 = Task(
            id=t3_id,
            description="Book conference room Alpha for product launch demo (unscheduled date and time)",
            status="blocked",
            current_agent_id="calendar_agent",
            created_at=t3_created,
            completed_at=None,
            duration_ms=None,
        )
        session.add(task3)

        t3_events = [
            TaskEvent(
                task_id=t3_id,
                sequence_no=1,
                event_type="task.created",
                payload={"task_id": str(t3_id), "description": task3.description, "sequence_no": 1, "event": "task.created", "event_type": "task.created"},
                created_at=t3_created,
            ),
            TaskEvent(
                task_id=t3_id,
                sequence_no=2,
                event_type="task.routed",
                from_agent_id=None,
                to_agent_id="calendar_agent",
                reason="Calendar reservation requested.",
                payload={"task_id": str(t3_id), "agent_id": "calendar_agent", "confidence": 0.96, "reason": "Calendar booking requested", "sequence_no": 2, "event": "task.routed", "event_type": "task.routed"},
                created_at=t3_created + timedelta(seconds=1),
            ),
            TaskEvent(
                task_id=t3_id,
                sequence_no=3,
                event_type="task.blocked",
                from_agent_id="calendar_agent",
                reason="Meeting date and time were not specified. Blocked awaiting scheduling details.",
                payload={"task_id": str(t3_id), "agent_id": "calendar_agent", "reason": "Missing date and time parameters for calendar reservation", "sequence_no": 3, "event": "task.blocked", "event_type": "task.blocked"},
                created_at=t3_created + timedelta(seconds=2),
            ),
        ]
        session.add_all(t3_events)

        await session.commit()

        print(" Demo tasks successfully seeded:")
        print(f"  1. Completed Task (Direct Calendar):   {t1_id}")
        print(f"  2. Completed Task (Handoff Flow):      {t2_id}")
        print(f"  3. BLOCKED Task (Ready for /retry):    {t3_id}")

        # Also publish events to Redis if running
        try:
            for ev in t1_events + t2_events + t3_events:
                await event_bus.publish_event(str(ev.task_id), ev.payload)
            print(" Broadcasted seed events to Redis pub/sub channel.")
        except Exception as e:
            print(f"⚠️ Redis publish skipped ({e}). DB records remain available.")

    await engine.dispose()
    await event_bus.close()


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
