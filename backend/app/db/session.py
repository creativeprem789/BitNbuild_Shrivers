import asyncio
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select, text

from app.config import settings
from app.db.models import Agent, Base

logger = logging.getLogger("task_harness.db")

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
engine_kwargs = {"echo": False, "future": True}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True
    # Required for Supabase / PgBouncer connection poolers
    engine_kwargs["connect_args"] = {"statement_cache_size": 0}

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

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


async def init_db_with_retry(max_retries: int = 5, delay_seconds: float = 1.0) -> None:
    """
    Connects to configured database (e.g. PostgreSQL).
    If PostgreSQL is unreachable after retries (e.g. local dev without Docker/Postgres service),
    it automatically enables local SQLite fallback so the backend pipeline is immediately operational.
    """
    global engine, async_session_factory

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Connecting to database at {settings.DATABASE_URL} (attempt {attempt}/{max_retries})...")
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await conn.execute(text("SELECT 1"))

            async with async_session_factory() as session:
                await seed_agents(session)

            logger.info("Database connection and schema initialization successful.")
            return
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt} failed: {e}")
            if attempt == max_retries:
                if "postgresql" in settings.DATABASE_URL.lower():
                    logger.warning(
                        "PostgreSQL is unreachable locally. Automatically enabling SQLite async fallback "
                        "('sqlite+aiosqlite:///task_harness.db') so the pipeline operates without crashing."
                    )
                    from pathlib import Path
                    db_path = Path(__file__).resolve().parent.parent.parent / "task_harness.db"
                    fallback_url = f"sqlite+aiosqlite:///{db_path}"
                    
                    fallback_engine = create_async_engine(fallback_url, echo=False, future=True)
                    engine = fallback_engine
                    async_session_factory.configure(bind=fallback_engine)

                    async with engine.begin() as conn:
                        await conn.run_sync(Base.metadata.create_all)

                    async with async_session_factory() as session:
                        await seed_agents(session)

                    logger.info(f"Local SQLite fallback active and verified: {fallback_url}")
                    return
                logger.error("Exceeded max retries connecting to database.")
                raise
            await asyncio.sleep(delay_seconds)

