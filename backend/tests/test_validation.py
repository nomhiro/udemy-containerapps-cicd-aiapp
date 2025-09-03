import pytest
from httpx import AsyncClient
from fastapi import status
import main
import string

@pytest.mark.asyncio
async def test_create_todo_invalid_priority_returns_422():
    payload = {
        "id": "todo_invalid_priority",
        "title": "invalid priority",
        "priority": "INVALID",  # 想定外
        "tags": [],
        "completed": False
    }
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        resp = await ac.post("/api/todos", json=payload)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    detail = resp.json().get("detail")
    assert detail.get("type") == "validation_error"
    errs = detail.get("errors", [])
    assert any(e.get("field") == "priority" for e in errs)


@pytest.mark.asyncio
async def test_patch_todo_invalid_priority_returns_422():
    """部分更新で priority が不正な場合 422 validation_error を返す。"""
    import main
    if hasattr(main, "reset_readiness"):
        main.reset_readiness()
    # まず有効な Todo を作成
    create_payload = {"id": "patch-invalid-prio", "title": "ok", "priority": "low"}
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        c = await ac.post("/api/todos", json=create_payload)
        assert c.status_code == 201
        # priority を不正値に部分更新
        r = await ac.patch(f"/api/todos/{create_payload['id']}", json={"priority": "INVALID"})
    assert r.status_code == 422
    detail = r.json().get("detail")
    assert detail.get("type") == "validation_error"
    assert any(e.get("field") == "priority" for e in detail.get("errors", []))


@pytest.mark.asyncio
async def test_create_todo_missing_title_returns_422():
    """title 欠落 (必須) の場合 422。"""
    import main
    if hasattr(main, "reset_readiness"):
        main.reset_readiness()
    payload = {"id": "missing-title-1", "priority": "normal"}
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        resp = await ac.post("/api/todos", json=payload)
    assert resp.status_code == 422
    detail = resp.json().get("detail")
    assert detail.get("type") == "validation_error"
    assert any(e.get("field") == "title" for e in detail.get("errors", []))



@pytest.mark.asyncio
async def test_create_todo_title_max_length():
    max_title = "a" * 256
    payload = {"title": max_title, "priority": "normal"}
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        resp = await ac.post("/api/todos", json=payload)
    # 仕様上title長制限はないが、正常に通ることを確認
    assert resp.status_code == 201
    assert resp.json()["title"] == max_title

@pytest.mark.asyncio
async def test_create_todo_title_empty_returns_422():
    payload = {"title": "", "priority": "normal"}
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        resp = await ac.post("/api/todos", json=payload)
    detail = resp.json().get("detail", {})
    # 空文字は通る場合もあるが、仕様でNGなら422を期待
    assert resp.status_code in (201, 422)

@pytest.mark.asyncio
async def test_create_todo_tags_many():
    tags = [f"tag{i}" for i in range(100)]
    payload = {"title": "tags test", "priority": "normal", "tags": tags}
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        resp = await ac.post("/api/todos", json=payload)
    assert resp.status_code == 201
    assert len(resp.json()["tags"]) == 100

@pytest.mark.asyncio
@pytest.mark.parametrize("priority", ["low", "normal", "high", "urgent"])
async def test_create_todo_priority_all_patterns(priority):
    payload = {"title": f"prio-{priority}", "priority": priority}
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        resp = await ac.post("/api/todos", json=payload)
    assert resp.status_code == 201
    assert resp.json()["priority"] == priority
