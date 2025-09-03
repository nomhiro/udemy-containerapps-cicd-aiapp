import pytest
from httpx import AsyncClient
from fastapi import status
import main

@pytest.mark.asyncio
async def test_create_todo_duplicate_id_returns_409():
    payload = {
        "id": "dup-001",
        "title": "first",
        "priority": "normal",
        "tags": [],
        "completed": False
    }
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        first = await ac.post("/api/todos", json=payload)
        second = await ac.post("/api/todos", json=payload)
    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_409_CONFLICT
    body = second.json()
    assert body.get("detail", {}).get("type") == "duplicate_todo_id"
    assert body.get("detail", {}).get("id") == payload["id"]
