import asyncio
import os
import sys
from pathlib import Path
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Put backend on path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

TEST_DB_FILE = Path(__file__).resolve().parent / "test_harness.db"
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["GEMINI_API_KEY"] = ""
os.environ["GOOGLE_API_KEY"] = ""

from app.config import settings
from app.db.models import Agent, Base
import app.db.session as session_module
import app.events.event_bus as bus_module
import app.orchestration.graph as graph_module
import app.orchestration.router_node as router_module

test_engine = create_async_engine(
    TEST_DB_URL,
    echo=False,
    future=True,
)

test_session_factory = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class MockRedisPubSub:
    """Mock Redis client for offline unit tests."""

    def __init__(self):
        self.published = []

    async def publish(self, channel, message):
        self.published.append((channel, message))
        return 1

    async def ping(self):
        return True

    def pubsub(self):
        return self

    async def subscribe(self, channel):
        pass

    async def unsubscribe(self, channel):
        pass

    async def close(self):
        pass

    async def listen(self):
        if False:
            yield None


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db(monkeypatch):
    """Initializes test database schema and seeded agents for tests."""
    monkeypatch.setattr(session_module, "engine", test_engine)
    monkeypatch.setattr(session_module, "async_session_factory", test_session_factory)
    monkeypatch.setattr(graph_module, "async_session_factory", test_session_factory)
    monkeypatch.setattr(router_module, "async_session_factory", test_session_factory)

    mock_redis = MockRedisPubSub()
    monkeypatch.setattr(bus_module.event_bus, "get_client", lambda: asyncio.sleep(0, result=mock_redis))

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed agents
    async with test_session_factory() as session:
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

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await test_engine.dispose()
    if TEST_DB_FILE.exists():
        try:
            TEST_DB_FILE.unlink()
        except Exception:
            pass
