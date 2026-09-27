from contextlib import asynccontextmanager
import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_tasks import router as tasks_router
from app.api.ws_gateway import router as ws_router
from app.config import settings
from app.db.session import engine, init_db_with_retry
from app.events.event_bus import event_bus

# Configure structured logging with task_id support
class TaskIdFormatter(logging.Formatter):
    def format(self, record):
        if not hasattr(record, "task_id"):
            record.task_id = "-"
        return super().format(record)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(
    TaskIdFormatter(
        "%(asctime)s [%(levelname)s] [task_id=%(task_id)s] %(name)s: %(message)s"
    )
)

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    handlers=[handler],
)
logger = logging.getLogger("task_harness.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context:
    - Runs DB startup retry logic to prevent container startup order failures.
    - Tests Redis connectivity.
    - Gracefully disposes connections on shutdown.
    """
    logger.info("Initializing Interactive Multi-Agent Task Harness...")

    # Startup database connection with retry
    try:
        await init_db_with_retry(max_retries=15, delay_seconds=2.0)
    except Exception as e:
        logger.error(f"Critical error connecting to database on startup: {e}")

    # Initialize Event Bus
    if settings.REDIS_URL:
        try:
            client = await event_bus.get_client()
            if client:
                await client.ping()
                logger.info("Redis Pub/Sub connection established successfully.")
        except Exception as e:
            logger.info(f"Redis not available ({e}). Using In-Memory Event Bus.")
    else:
        logger.info("Event Bus: In-Memory (Zero external dependencies, ideal for single-instance & demo).")

    yield

    # Shutdown
    logger.info("Shutting down Task Harness...")
    await event_bus.close()
    await engine.dispose()
    logger.info("All database and Redis connections closed.")


app = FastAPI(
    title="Interactive Multi-Agent Task Harness API",
    description="Backend orchestration engine for Bit N Build (Problem Statement 05)",
    version="1.0.0",
    lifespan=lifespan,
)

raw_origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
exact_origins = [o for o in raw_origins if o != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=exact_origins,
    allow_origin_regex=".*" if not exact_origins else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API and WebSocket routes
app.include_router(tasks_router, tags=["Tasks"])
app.include_router(ws_router, tags=["WebSocket"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "Interactive Multi-Agent Task Harness API",
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "websocket": "/ws/tasks",
    }
