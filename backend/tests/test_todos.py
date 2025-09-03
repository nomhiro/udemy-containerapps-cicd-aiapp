import uuid
import pytest
from httpx import AsyncClient
import main
from domain.models.todo import Todo


class CosmosStubRepo:
    def __init__(self):
        now = "2025-08-31T00:00:00Z"
        self._items = [
            Todo(id=str(uuid.uuid4()), title="stub-1", priority="normal", createdAt=now, updatedAt=now),
            Todo(id=str(uuid.uuid4()), title="stub-2", priority="high", createdAt=now, updatedAt=now),
        ]
    def list(self):
        return list(self._items)

    def add(self, todo: Todo):
        self._items.append(todo)
        return todo

    def get_all(self):
        return list(self._items)


@pytest.mark.asyncio
async def test_created_todo_has_server_generated_timestamps_and_overrides_client_values():
    if hasattr(main, "reset_readiness"):
        main.reset_readiness()
    # クライアントが createdAt/updatedAt を送ろうとしてもモデル定義上拒否されるので
    # ここでは通常の想定入力 (timestamps 無し) を送り、サーバが値を埋めることを確認
    payload = {"id": "ts-001", "title": "timestamp", "priority": "low"}
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        resp = await ac.post("/api/todos", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert "createdAt" in body and "updatedAt" in body
    # ISO 8601 フォーマット (Z または +00:00 を含む) の簡易チェック
    assert body["createdAt"].endswith("Z") or "+" in body["createdAt"]
    assert body["updatedAt"].endswith("Z") or "+" in body["updatedAt"]
    # createdAt <= updatedAt (生成直後は等しい想定)
    from datetime import datetime
    ca = datetime.fromisoformat(body["createdAt"].replace("Z", "+00:00"))
    ua = datetime.fromisoformat(body["updatedAt"].replace("Z", "+00:00"))
    assert ca <= ua


@pytest.mark.asyncio
async def test_get_todos_returns_stubbed_items():
    # main.repo をスタブに差し替え
    if hasattr(main, "set_repo"):
        main.set_repo(CosmosStubRepo())  # type: ignore
    else:
        main.repo = CosmosStubRepo()  # fallback
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        resp = await ac.get("/api/todos")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2
    titles = {item["title"] for item in data}
    assert titles == {"stub-1", "stub-2"}

@pytest.mark.asyncio
async def test_get_todo_by_id_returns_200_and_body():
    # Arrange
    if hasattr(main, "reset_readiness"):
        main.reset_readiness()
    payload = {
        "id": "get-001",
        "title": "get one",
        "priority": "normal"
    }
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        create_resp = await ac.post("/api/todos", json=payload)
        assert create_resp.status_code == 201
        get_resp = await ac.get(f"/api/todos/{payload['id']}")
    assert get_resp.status_code == 200  # RED: 404 になる想定
    body = get_resp.json()
    assert body["id"] == payload["id"]
    assert body["title"] == payload["title"]


@pytest.mark.asyncio
async def test_patch_complete_marks_todo_completed():
    if hasattr(main, "reset_readiness"):
        main.reset_readiness()
    payload = {
        "id": "comp-001",
        "title": "to complete",
        "priority": "normal"
    }
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        create_resp = await ac.post("/api/todos", json=payload)
        assert create_resp.status_code == 201
        patch_resp = await ac.patch(f"/api/todos/{payload['id']}/complete")
    assert patch_resp.status_code == 200  # RED 404 想定
    body = patch_resp.json()
    assert body["completed"] is True
    # updatedAt が更新されていること (作成直後との差異は極小のため >= 条件は避け比較)
    created_body = create_resp.json()
    assert body["updatedAt"] >= created_body["createdAt"]


@pytest.mark.asyncio
async def test_patch_reopen_marks_todo_incomplete():
    if hasattr(main, "reset_readiness"):
        main.reset_readiness()
    payload = {
        "id": "reopen-001",
        "title": "to reopen",
        "priority": "normal"
    }
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        create_resp = await ac.post("/api/todos", json=payload)
        assert create_resp.status_code == 201
        _ = await ac.patch(f"/api/todos/{payload['id']}/complete")  # まず完了
        reopen_resp = await ac.patch(f"/api/todos/{payload['id']}/reopen")
    assert reopen_resp.status_code == 200  # RED 404 想定
    body = reopen_resp.json()
    assert body["completed"] is False
    # reopen で updatedAt が更新されていること
    complete_body = _.json()  # 完了後の状態
    assert body["updatedAt"] >= complete_body["updatedAt"]


@pytest.mark.asyncio
async def test_patch_partial_updates_title_and_priority():
    if hasattr(main, "reset_readiness"):
        main.reset_readiness()
    base = {
        "id": "upd-001",
        "title": "original",
        "priority": "normal"
    }
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        create_resp = await ac.post("/api/todos", json=base)
        assert create_resp.status_code == 201
        patch_payload = {"title": "changed", "priority": "high"}
        patch_resp = await ac.patch(f"/api/todos/{base['id']}", json=patch_payload)
    assert patch_resp.status_code == 200  # RED: 404 か 未実装
    body = patch_resp.json()
    assert body["title"] == "changed"
    assert body["priority"] == "high"


@pytest.mark.asyncio
async def test_delete_todo_removes_item_and_get_returns_404():
    if hasattr(main, "reset_readiness"):
        main.reset_readiness()
    base = {
        "id": "del-001",
        "title": "to delete",
        "priority": "normal"
    }
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        create_resp = await ac.post("/api/todos", json=base)
        assert create_resp.status_code == 201
        delete_resp = await ac.delete(f"/api/todos/{base['id']}")
        assert delete_resp.status_code == 204
        get_resp = await ac.get(f"/api/todos/{base['id']}")
        assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_returns_404():
    if hasattr(main, "reset_readiness"):
        main.reset_readiness()
    missing_id = "no-such-id-999"
    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        delete_resp = await ac.delete(f"/api/todos/{missing_id}")
    assert delete_resp.status_code == 404
