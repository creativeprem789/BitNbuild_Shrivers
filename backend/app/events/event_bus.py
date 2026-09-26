import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict, Optional
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger("task_harness.event_bus")


class EventBus:
    """
    Redis Pub/Sub Event Bus for real-time task state transitions.
    Channel naming:
      - task-events:{task_id} (per task)
      - task-events:all (system-wide broadcast)
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis: Optional[aioredis.Redis] = None

    async def get_client(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._redis

    async def publish_event(self, task_id: str, payload: Dict[str, Any]) -> None:
        """
        Publishes an event to both the task-specific channel and the global channel.
        This must be called immediately AFTER committing the DB record.
        """
        try:
            client = await self.get_client()
            message = json.dumps(payload)
            task_channel = f"task-events:{task_id}"
            global_channel = "task-events:all"

            await client.publish(task_channel, message)
            await client.publish(global_channel, message)
            logger.info(
                f"Published event '{payload.get('event_type')}' seq={payload.get('sequence_no')} to {task_channel}",
                extra={"task_id": task_id},
            )
        except Exception as e:
            logger.warning(
                f"Failed to publish event to Redis (task_id={task_id}): {e}",
                extra={"task_id": task_id},
            )

    async def subscribe_task(
        self, task_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Subscribes to a specific task channel and yields parsed event dictionaries.
        """
        client = await self.get_client()
        pubsub = client.pubsub()
        channel_name = f"task-events:{task_id}"
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

    async def subscribe_all(self) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Subscribes to all task events (task-events:all).
        """
        client = await self.get_client()
        pubsub = client.pubsub()
        channel_name = "task-events:all"
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

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.close()
            self._redis = None


# Global event bus singleton
event_bus = EventBus()
