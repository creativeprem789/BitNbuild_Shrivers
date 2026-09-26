import asyncio
import json
import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.events.event_bus import event_bus

logger = logging.getLogger("task_harness.api.ws")

router = APIRouter()


@router.websocket("/ws/tasks")
async def websocket_tasks_endpoint(
    websocket: WebSocket,
    task_id: Optional[str] = Query(default=None),
    subscribe: Optional[str] = Query(default=None),
):
    """
    Real-time WebSocket event streaming gateway.
    
    Subscription Protocol:
    1. Query parameters:
       /ws/tasks?task_id=<uuid>
       /ws/tasks?subscribe=all
    2. Or send JSON message upon connection:
       {"subscribe": "all"} OR {"subscribe": "<task_id>"} OR {"task_id": "<task_id>"}

    Forwarding Rule:
    Relays Redis Pub/Sub events VERBATIM to the frontend without any data transformation,
    preserving the exact contract shapes:
      task.created   { task_id, description, sequence_no }
      task.routed    { task_id, agent_id, confidence, reason, sequence_no }
      task.handoff   { task_id, from_agent, to_agent, reason, sequence_no }
      task.blocked   { task_id, agent_id, reason, sequence_no }
      task.completed { task_id, duration_ms, sequence_no }
    """
    await websocket.accept()
    logger.info("WebSocket client connected.")

    # Determine initial target channel from query params
    target_subscription: Optional[str] = subscribe or task_id

    # If not provided via query, wait briefly for initial message from client
    if not target_subscription:
        try:
            # Wait up to 3 seconds for initial subscription message
            init_msg = await asyncio.wait_for(websocket.receive_text(), timeout=3.0)
            try:
                data = json.loads(init_msg)
                target_subscription = data.get("subscribe") or data.get("task_id") or "all"
            except Exception:
                target_subscription = init_msg.strip()
        except asyncio.TimeoutError:
            target_subscription = "all"
        except WebSocketDisconnect:
            logger.info("Client disconnected during handshake.")
            return

    logger.info(f"Client subscribed to: {target_subscription}")

    # Start event listener loop
    async def listen_and_forward():
        try:
            if target_subscription == "all":
                stream = event_bus.subscribe_all()
            else:
                stream = event_bus.subscribe_task(target_subscription)

            async for event_payload in stream:
                # Forward verbatim without modifying payload shape
                await websocket.send_text(json.dumps(event_payload))
        except WebSocketDisconnect:
            logger.info(f"WebSocket client disconnected from stream: {target_subscription}")
        except Exception as e:
            logger.warning(f"Error in WebSocket streaming loop: {e}")

    # Start incoming messages listener loop (handles client heartbeats, pings, or subscription changes)
    async def receive_client_messages():
        try:
            while True:
                msg = await websocket.receive_text()
                if msg == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    forward_task = asyncio.create_task(listen_and_forward())
    receive_task = asyncio.create_task(receive_client_messages())

    done, pending = await asyncio.wait(
        [forward_task, receive_task],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    logger.info("WebSocket connection closed cleanly.")
