import pytest
from httpx import AsyncClient

import main
from domain.models.todo import Todo

# RED: CosmosTodoRepository がまだ存在しない状態で import しようとし失敗させる
from infrastructure.repositories.cosmos_todo_repository import CosmosTodoRepository  # type: ignore # noqa: F401


@pytest.mark.asyncio
async def test_cosmos_repo_add_and_list_with_fake_container():
    class FakeContainer:
        def __init__(self):
            self.items = []

        def create_item(self, body: dict):
            self.items.append(body)
            return body

        def query_items(self, query: str, parameters=None, enable_cross_partition_query=True):  # noqa: D401
            # 単純に全件返す
            for it in self.items:
                yield it

    fake_container = FakeContainer()
    # Repo が readiness を示す is_ready を持つ想定
    from infrastructure.repositories.cosmos_todo_repository import CosmosTodoRepository  # type: ignore
    repo = CosmosTodoRepository(container=fake_container)
    main.set_repo(repo)  # readiness フラグも更新される想定

    todo = Todo(
        id="c1",
        title="cosmos",
        priority="normal",
        createdAt="2025-08-31T00:00:00Z",
        updatedAt="2025-08-31T00:00:00Z",
    )
    repo.add(todo)

    async with AsyncClient(app=main.app, base_url="http://test") as ac:
        list_resp = await ac.get("/api/todos")
        ready_resp = await ac.get("/health/ready")

    assert list_resp.status_code == 200
    data = list_resp.json()
    assert any(item["id"] == "c1" for item in data)
    assert ready_resp.json().get("status") == "ready"
