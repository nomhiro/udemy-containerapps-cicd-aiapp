from fastapi import FastAPI, HTTPException, status, Path, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging
from pydantic import BaseModel, Field
from datetime import datetime
from domain.models.todo import Todo, PRIORITY_PATTERN
from infrastructure.repositories.in_memory_todo_repository import InMemoryTodoRepository, DuplicateTodoIdError
from application.services.todo_service import TodoService
import os
from dotenv import load_dotenv

# .env 読み込み (存在しない場合は無視)
load_dotenv()

try:
    from azure.cosmos import CosmosClient, PartitionKey  # type: ignore
except Exception:  # モジュール未インストール時でも他機能継続
    CosmosClient = None  # type: ignore
    PartitionKey = None  # type: ignore

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # アプリ起動時に Cosmos 初期化を試行 (条件を満たす場合のみ)
    try_init_cosmos_repository()
    yield

app = FastAPI(title="Todo API", lifespan=lifespan)

_readiness = {"ready": False}

repo = InMemoryTodoRepository()
service = TodoService(repo)

logger = logging.getLogger("todo-api")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


def try_init_cosmos_repository():
    """環境変数設定時に Cosmos DB へ接続しリポジトリ差し替え。

    スキップ条件:
      - PYTEST 実行中 (単体テストは in-memory を利用)
      - COSMOS_DISABLE=1 が指定
      - 接続情報 (COSMOS_CONNECTION_STRING または COSMOS_ENDPOINT+COSMOS_KEY) 不足
      - azure-cosmos 未インストール
    成功時: CosmosTodoRepository を set_repo し readiness を ready に。
    失敗時: ログ出力のみ / readiness は変更しない。
    """
    if os.getenv("COSMOS_DISABLE") == "1" or "PYTEST_CURRENT_TEST" in os.environ:
        logger.info("Cosmos initialization skipped (test or disabled).")
        return
    if getattr(repo, "is_ready", False):  # 既に ready リポジトリが注入済みなら無視
        return
    if CosmosClient is None:
        logger.info("azure-cosmos パッケージ未利用のため Cosmos 初期化をスキップします。")
        return

    conn_str = os.getenv("COSMOS_CONNECTION_STRING")
    endpoint = os.getenv("COSMOS_ENDPOINT")
    key = os.getenv("COSMOS_KEY")
    database_name = os.getenv("COSMOS_DATABASE", "TodoApp")
    container_name = os.getenv("COSMOS_CONTAINER", "Todos")
    partition_key_path = os.getenv("COSMOS_PARTITION_KEY", "/id")

    if not (conn_str or (endpoint and key)):
        logger.info("Cosmos 環境変数が未設定のため初期化をスキップします。")
        return

    try:
        if conn_str:
            client = CosmosClient.from_connection_string(conn_str)
        else:
            client = CosmosClient(endpoint, credential=key)

        # DB / Container を存在しなければ作成 (学習/開発用途)。本番は存在前提・RBAC利用推奨。
        db = client.create_database_if_not_exists(id=database_name)
        container = db.create_container_if_not_exists(
            id=container_name,
            partition_key=PartitionKey(path=partition_key_path),
            offer_throughput=400,
        )
        from infrastructure.repositories.cosmos_todo_repository import CosmosTodoRepository  # 遅延 import
        cosmos_repo = CosmosTodoRepository(container=container)
        set_repo(cosmos_repo)
        logger.info("Cosmos repository initialized (db=%s container=%s)", database_name, container_name)
    except Exception as e:  # noqa: BLE001
        logger.exception("Cosmos 初期化に失敗: %s", e)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """422 Validation エラーを統一フォーマットにラップするハンドラ。

    レスポンス形式:
    {
      "detail": {
         "type": "validation_error",
         "errors": [ { "field": "priority", "message": "Input should match pattern...", "errorType": "pattern_mismatch" }, ... ]
      }
    }
    """
    errors = []
    for e in exc.errors():  # Pydantic v2 構造
        loc = e.get("loc", [])
        field = loc[-1] if isinstance(loc, (list, tuple)) and loc else str(loc)
        errors.append({
            "field": field,
            "message": e.get("msg"),
            "errorType": e.get("type"),
        })
    return JSONResponse(status_code=422, content={
        "detail": {"type": "validation_error", "errors": errors}
    })


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTPException を統一フォーマット `{detail:{...}}` で返却。

    既に detail が dict で type キーなどを持つ場合はそのままラップ維持。
    文字列 / その他は標準化。
    """
    base = exc.detail
    if isinstance(base, dict):
        detail = base
    else:
        detail = {"type": "http_error", "message": str(base)}
    detail.setdefault("status", exc.status_code)
    return JSONResponse(status_code=exc.status_code, content={"detail": detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """想定外例外の捕捉。スタックはログのみ・レスポンスは汎用 500。"""
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={
        "detail": {"type": "internal_server_error", "message": "Internal Server Error"}
    })


def set_repo(new_repo):  # type: ignore
    """テスト用にリポジトリ実装を差し替えるヘルパー。Cosmosスタブ注入などで使用。"""
    global repo, service
    repo = new_repo
    service = TodoService(repo)
    if getattr(repo, "is_ready", False):  # readiness フラグ伝播
        _readiness["ready"] = True


def reset_readiness():
    """テストでの初期化用。リポジトリを再生成し readiness を false に戻す。"""
    _readiness["ready"] = False
    # repo も初期化 (テスト用)
    global repo, service
    repo = InMemoryTodoRepository()
    service = TodoService(repo)

@app.get("/health")
async def health():
    """Liveness チェック用エンドポイント。"""
    return {"status": "ok"}

@app.get("/health/ready")
async def readiness():
    """Readiness チェック用エンドポイント。依存リソース準備状況を返す。"""
    return {"status": "ready" if _readiness["ready"] else "not-ready"}

# NOTE: 後で Cosmos 接続成功時に _readiness["ready"] = True を設定するフックを追加予定

class CreateTodoModel(BaseModel):
    """クライアントから受け取る作成ペイロード (サーバ側で id / createdAt / updatedAt を生成)。"""
    id: str | None = None  # クライアントが指定しなければサーバ生成
    title: str
    description: str | None = None
    priority: str = Field(pattern=PRIORITY_PATTERN)
    dueDate: datetime | None = None
    tags: list[str] = []


@app.post("/api/todos", status_code=status.HTTP_201_CREATED)
async def create_todo(body: CreateTodoModel):
    """Todo作成。ID重複時は 409 を返す。タイムスタンプと未指定IDはサーバ生成。"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    import uuid
    todo = Todo(
        id=body.id or str(uuid.uuid4()),
        title=body.title,
        description=body.description,
        priority=body.priority,
        dueDate=body.dueDate,
        tags=body.tags,
        completed=False,
        createdAt=now,
        updatedAt=now,
    )
    try:
        return service.create(todo)
    except DuplicateTodoIdError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"type": "duplicate_todo_id", "id": e.todo_id})


@app.get("/api/todos")
async def list_todos():
    """Todo 一覧取得。"""
    return service.list()

@app.get("/api/todos/{todo_id}")
async def get_todo(todo_id: str = Path(..., description="Todo ID")):
    """ID 指定取得。存在しない場合 404。"""
    todo = service.get(todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail={"type": "not_found", "id": todo_id})
    return todo

@app.patch("/api/todos/{todo_id}/complete")
async def complete_todo(todo_id: str):
    """完了操作。既に完了でも成功扱い。"""
    todo = service.complete(todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail={"type": "not_found", "id": todo_id})
    return todo

@app.patch("/api/todos/{todo_id}/reopen")
async def reopen_todo(todo_id: str):
    """未完了へ戻す操作。既に未完了でも成功扱い。"""
    todo = service.reopen(todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail={"type": "not_found", "id": todo_id})
    return todo

class PartialUpdateModel(BaseModel):
    """部分更新で受け付けるフィールド。None の項目は無視。"""
    title: str | None = None
    description: str | None = None
    priority: str | None = Field(default=None, pattern=PRIORITY_PATTERN)
    dueDate: datetime | None = None
    tags: list[str] | None = None

@app.patch("/api/todos/{todo_id}")
async def update_partial(todo_id: str, body: PartialUpdateModel):
    """部分更新エンドポイント。変更されたフィールドのみ更新。"""
    updated = service.update_partial(todo_id, **{k: v for k, v in body.model_dump().items() if v is not None})
    if not updated:
        raise HTTPException(status_code=404, detail={"type": "not_found", "id": todo_id})
    return updated

@app.delete("/api/todos/{todo_id}", status_code=204)
async def delete_todo(todo_id: str):
    """削除エンドポイント。存在しなければ 404。成功時 204 (body 無し)。"""
    ok = service.delete(todo_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"type": "not_found", "id": todo_id})
    return None




