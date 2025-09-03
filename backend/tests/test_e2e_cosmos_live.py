"""Live Cosmos DB E2E テスト (任意実行)。

実行条件:
  - 環境変数 COSMOS_CONNECTION_STRING または (COSMOS_ENDPOINT & COSMOS_KEY) が設定済み
  - pytest 起動時に `--run-live-cosmos` オプションを付与 (誤実行防止)

内容:
  1. 起動済み FastAPI アプリ (main) の Cosmos リポジトリを再初期化 (startup フックと同等)
  2. /api/todos へ作成→取得→一覧→完了→再オープン→部分更新→削除 のフル操作
  3. 後片付けでテスト ID プレフィックスのドキュメントを削除

注意:
  - 本テストは実リソース課金が発生する可能性があるため CI ではデフォルト無効
  - 失敗時も cleanup を試行
"""

import os
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
import main


def _live_cosmos_available() -> bool:
    if os.getenv("COSMOS_CONNECTION_STRING") or (os.getenv("COSMOS_ENDPOINT") and os.getenv("COSMOS_KEY")):
        return True
    return False


def pytest_addoption(parser):  # type: ignore
    parser.addoption(
        "--run-live-cosmos",
        action="store_true",
        default=False,
        help="Run tests that hit a real Cosmos DB instance",
    )


def pytest_runtest_setup(item):  # type: ignore
    if "live_cosmos" in item.keywords and not item.config.getoption("--run-live-cosmos"):
        pytest.skip("--run-live-cosmos が指定されていないためスキップ")


@pytest.mark.live_cosmos
@pytest.mark.asyncio
async def test_live_cosmos_e2e_crud():
    if not _live_cosmos_available():
        pytest.skip("Cosmos 接続情報が無いためスキップ")

    # 強制的に Cosmos 再初期化 (既に readiness ready ならそのまま)
    main.reset_readiness()
    main.try_init_cosmos_repository()  # type: ignore[attr-defined]

    test_id = f"e2e-{uuid.uuid4()}"
    base_url = "http://test"

    # httpx の新しい推奨スタイル (Deprecation Warning 回避)
    transport = ASGITransport(app=main.app)
    async with AsyncClient(transport=transport, base_url=base_url) as ac:
        # Create
        create_payload = {
            "id": test_id,
            "title": "live cosmos create",
            "priority": "normal",
            "tags": ["e2e", "cosmos"],
        }
        r = await ac.post("/api/todos", json=create_payload)
        assert r.status_code == 201, r.text
        # Get
        r = await ac.get(f"/api/todos/{test_id}")
        assert r.status_code == 200
        assert r.json()["id"] == test_id
        # List
        r = await ac.get("/api/todos")
        assert r.status_code == 200
        assert any(t["id"] == test_id for t in r.json())
        # Complete
        r = await ac.patch(f"/api/todos/{test_id}/complete")
        assert r.status_code == 200
        assert r.json()["completed"] is True
        # Reopen
        r = await ac.patch(f"/api/todos/{test_id}/reopen")
        assert r.status_code == 200
        assert r.json()["completed"] is False
        # Partial update
        r = await ac.patch(f"/api/todos/{test_id}", json={"title": "updated title", "priority": "high"})
        assert r.status_code == 200
        body = r.json()
        assert body["title"] == "updated title"
        assert body["priority"] == "high"
        # Delete
        r = await ac.delete(f"/api/todos/{test_id}")
        assert r.status_code == 204
        # Confirm not found
        r = await ac.get(f"/api/todos/{test_id}")
        assert r.status_code == 404

    # Cleanup (prefix で残骸削除)
    try:
        repo = main.repo  # type: ignore[attr-defined]
        container = getattr(repo, "_c", None)
        if container:
            # 期限切れを避けつつテスト生成分のみ
            to_delete = []
            for doc in container.query_items("SELECT * FROM c WHERE STARTSWITH(c.id, @p)", parameters=[{"name": "@p", "value": "e2e-"}]):
                to_delete.append(doc)
            for d in to_delete:
                try:
                    container.delete_item(d, partition_key=d.get("id"))
                except Exception:  # noqa: BLE001
                    pass
    except Exception:  # noqa: BLE001
        pass
