import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict, Optional
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger("task_harness.event_bus")


class EventBus:
    """
    Redis Pub/Sub Event Bus with transparent In-Memory fallback.
    Channel naming:
      - task-events:{task_id} (per task)
      - task-events:all (system-wide broadcast)
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis: Optional[aioredis.Redis] = None
        self._redis_available: Optional[bool] = None
        self._subscribers: Dict[str, set] = {}

    async def get_client(self) -> Optional[aioredis.Redis]:
        if not self.redis_url or self._redis_available is False:
            return None
        if self._redis is None:
            try:
                self._redis = aioredis.from_url(
                    self.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=1.5,
                )
                await self._redis.ping()
                self._redis_available = True
                logger.info("Connected to Redis Pub/Sub successfully.")
            except Exception as e:
                logger.info(
                    f"Redis unavailable ({e}). Using In-Memory event bus."
                )
                self._redis_available = False
                self._redis = None
        return self._redis

    async def publish_event(self, task_id: str, payload: Dict[str, Any]) -> None:
        """
        Publishes an event to both the task-specific channel and the global channel.
        Works seamlessly via Redis if connected, or In-Memory fallback.
        """
        task_channel = f"task-events:{task_id}"
        global_channel = "task-events:all"
        message_json = json.dumps(payload)

        # 1. Try Redis publish if available
        client = await self.get_client()
        if client:
            try:
                await client.publish(task_channel, message_json)
                await client.publish(global_channel, message_json)
            except Exception as e:
                logger.warning(f"Redis publish error: {e}. Delivering via in-memory bus.")

        # 2. In-memory queue distribution (ensures zero dropped events for connected WebSockets)
        for channel in (task_channel, global_channel):
            if channel in self._subscribers:
                for q in list(self._subscribers[channel]):
                    await q.put(payload)

        logger.info(
            f"Published event '{payload.get('event_type')}' seq={payload.get('sequence_no')} to {task_channel}",
            extra={"task_id": task_id},
        )

    async def subscribe_task(
        self, task_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Subscribes to a specific task channel and yields parsed event dictionaries.
        """
        channel_name = f"task-events:{task_id}"
        async for item in self._subscribe_channel(channel_name):
            yield item

    async def subscribe_all(self) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Subscribes to all task events (task-events:all).
        """
        channel_name = "task-events:all"
        async for item in self._subscribe_channel(channel_name):
            yield item

    async def _subscribe_channel(self, channel_name: str) -> AsyncGenerator[Dict[str, Any], None]:
        client = await self.get_client()
        if client:
            pubsub = client.pubsub()
            await pubsub.subscribe(channel_name)
            logger.info(f"Subscribed to Redis channel: {channel_name}")
            try:
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        try:
                            data = json.loads(message["data"])
                            yield data
                        except Exception as e:
                            logger.error(f"Error parsing Redis message: {e}")
            finally:
                await pubsub.unsubscribe(channel_name)
                await pubsub.close()
                logger.info(f"Unsubscribed from Redis channel: {channel_name}")
        else:
            # In-Memory fallback subscriber
            q: asyncio.Queue = asyncio.Queue()
            if channel_name not in self._subscribers:
                self._subscribers[channel_name] = set()
            self._subscribers[channel_name].add(q)
            logger.info(f"Subscribed to In-Memory event channel: {channel_name}")
            try:
                while True:
                    data = await q.get()
                    yield data
            finally:
                self._subscribers[channel_name].discard(q)
                if not self._subscribers[channel_name]:
                    del self._subscribers[channel_name]
                logger.info(f"Unsubscribed from In-Memory channel: {channel_name}")

    async def close(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.close()
            except Exception:
                pass
            self._redis = None


# Global event bus singleton
event_bus = EventBus()
