import pytest
from httpx import AsyncClient
from fastapi import status

from main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get("/health")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_readiness_initially_not_ready():
    # 明示的に初期化 (他テストの副作用防止)
    import main as main_module
    if hasattr(main_module, "reset_readiness"):
        main_module.reset_readiness()
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get("/health/ready")
    # 最初は ready を false にして失敗させる (RED)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json().get("status") == "not-ready"


@pytest.mark.asyncio
async def test_create_todo_returns_201_and_body():
    import main as main_module
    if hasattr(main_module, "reset_readiness"):
        main_module.reset_readiness()
    payload = {
        "id": "todo_001",
        "title": "学習",
        "priority": "high",
        "tags": ["azure"],
        "completed": False
    }
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.post("/api/todos", json=payload)
    assert resp.status_code == status.HTTP_201_CREATED
    body = resp.json()
    assert body["id"] == payload["id"]
    assert body["title"] == payload["title"]
    assert body["priority"] == "high"
    # サーバ側で createdAt / updatedAt を生成
    assert "createdAt" in body and "updatedAt" in body


@pytest.mark.asyncio
async def test_readiness_becomes_ready_after_cosmos_stub_repo_injection():
    import main as main_module

    # 初期状態リセット
    if hasattr(main_module, "reset_readiness"):
        main_module.reset_readiness()

    class CosmosStubReadyRepo(main_module.InMemoryTodoRepository):
        def __init__(self):
            super().__init__()
            self.is_ready = True

    # set_repo が無い段階では AttributeError になり RED になる想定
    if hasattr(main_module, "set_repo"):
        main_module.set_repo(CosmosStubReadyRepo())
    else:
        # まだ未実装なのでここでアサート (RED)
        pytest.fail("set_repo が未実装のため readiness を ready に更新できません")

    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json().get("status") == "ready"
