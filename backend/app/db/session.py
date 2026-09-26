import asyncio
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select, text

from app.config import settings
from app.db.models import Agent, Base

logger = logging.getLogger("task_harness.db")

# Create engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    future=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for FastAPI endpoints to get an async db session."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def seed_agents(session: AsyncSession) -> None:
    """Seed default agents if they do not exist."""
    default_agents = [
        Agent(
            id="email_agent",
            display_name="Email Specialist",
            role="Drafts, triages, and prepares email communications",
            is_active=True,
        ),
        Agent(
            id="calendar_agent",
            display_name="Calendar Coordinator",
            role="Schedules, manages, and verifies calendar events via external API",
            is_active=True,
        ),
        Agent(
            id="search_agent",
            display_name="Research Analyst",
            role="Investigates queries, gathers external data, and summarizes findings",
            is_active=True,
        ),
        Agent(
            id="custom_agent",
            display_name="Executive Resolver",
            role="Handles low-confidence fallback, complex multi-domain workflows, and escalations",
            is_active=True,
        ),
    ]

    for agent in default_agents:
        existing = await session.get(Agent, agent.id)
        if not existing:
            session.add(agent)
    await session.commit()
    logger.info("Default agents verified and seeded.")


async def init_db_with_retry(max_retries: int = 15, delay_seconds: float = 2.0) -> None:
    """
    Retries DB connection upon application startup rather than crashing immediately.
    Fixes container startup race conditions.
    """
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Connecting to database (attempt {attempt}/{max_retries})...")
            async with engine.begin() as conn:
                # Create tables if not present (useful for development & testing)
                await conn.run_sync(Base.metadata.create_all)
                await conn.execute(text("SELECT 1"))

            async with async_session_factory() as session:
                await seed_agents(session)

            logger.info("Database connection and schema initialization successful.")
            return
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt} failed: {e}")
            if attempt == max_retries:
                logger.error("Exceeded max retries connecting to database.")
                raise
            await asyncio.sleep(delay_seconds)
