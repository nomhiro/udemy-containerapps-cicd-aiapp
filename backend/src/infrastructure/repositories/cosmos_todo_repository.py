from __future__ import annotations
from typing import List, Any
from fastapi.encoders import jsonable_encoder
from domain.models.todo import Todo
from domain.repositories.todo_repository import TodoRepository
from .in_memory_todo_repository import DuplicateTodoIdError

try:  # 型ヒント用 (azure-cosmos が無いテスト環境でも失敗しない)
    from azure.cosmos.exceptions import CosmosHttpResponseError  # type: ignore
except Exception:  # pragma: no cover
    CosmosHttpResponseError = Exception  # type: ignore

class CosmosTodoRepository(TodoRepository):
    def __init__(self, container: Any):
        """Cosmos DB コンテナを利用したTodoリポジトリ実装（簡易版）。

        container: Azure Cosmos のコンテナオブジェクト (SDK stub / 本物どちらも想定)
        """
        self._c = container
        # readiness 判定用フラグ
        self.is_ready = True

    def add(self, todo: Todo) -> Todo:
        """新規追加。ID 重複は DuplicateTodoIdError。

        優先: create_item で直接追加 → 409 (Conflict) なら重複と判定。
        FakeContainer 等で create_item 以外メソッドが無い場合は従来挙動。
        """
        create = getattr(self._c, "create_item", None)
        if not create:
            # フォールバック (テスト用フェイク)
            for _ in self._c.query_items(
                "SELECT * FROM c WHERE c.id = @id",
                parameters=[{"name": "@id", "value": todo.id}],
                enable_cross_partition_query=True,
            ):
                raise DuplicateTodoIdError(todo.id)
            self._c.create_item(todo.model_dump())
            return todo
        try:
            doc = jsonable_encoder(todo.model_dump())
            create(doc)
        except CosmosHttpResponseError as e:  # type: ignore
            # azure-cosmos Conflict -> status_code 409 or sub_status
            if getattr(e, "status_code", None) == 409:
                raise DuplicateTodoIdError(todo.id)
            raise
        return todo

    def list(self) -> List[Todo]:
        """全件取得。規模拡大時は paging / continuation token 対応が必要。

        NOTE: 現状は SELECT *。本番では必要フィールド限定 & continuation token を活用。
        """
        return [
            Todo(**doc)
            for doc in self._c.query_items(
                "SELECT * FROM c",
                enable_cross_partition_query=True,
            )
        ]

    def get(self, todo_id: str):
        """ID 取得。存在しなければ None。point read 優先。"""
        read_item = getattr(self._c, "read_item", None)
        if read_item:
            try:
                doc = read_item(item=todo_id, partition_key=todo_id)
                return Todo(**doc)
            except Exception:  # NotFound 等は None 返却
                return None
        # フォールバック (フェイクコンテナ)
        for doc in self._c.query_items(
            "SELECT * FROM c WHERE c.id = @id",
            parameters=[{"name": "@id", "value": todo_id}],
            enable_cross_partition_query=True,
        ):
            return Todo(**doc)
        return None

    def save(self, todo: Todo) -> Todo:
        """更新 (簡易 upsert)。本来は replace_item / upsert_item を利用。"""
        # Cosmos では create_item は重複 id で 409 となるため upsert_item を利用
        try:
            upsert = getattr(self._c, "upsert_item", None)
            doc = jsonable_encoder(todo.model_dump())
            if upsert:
                upsert(doc)
            else:  # フォールバック (古いSDK) - 楽観的に create -> 失敗時は置換を試行
                try:
                    self._c.create_item(doc)
                except Exception:
                    replace = getattr(self._c, "replace_item", None)
                    if replace:
                        replace(item=todo.id, body=doc)
                    else:
                        raise
        except Exception:
            # 本実装では詳細ロギングは上位レイヤ (サービス/ハンドラ) に委譲想定
            raise
        return todo

    def delete(self, todo_id: str) -> bool:
        """削除。存在すれば True。point delete 優先。"""
        delete_item = getattr(self._c, "delete_item", None)
        if delete_item:
            try:
                delete_item(item=todo_id, partition_key=todo_id)
                return True
            except Exception:
                return False
        # フォールバック: クエリして削除 (フェイク用)
        to_delete = []
        for doc in self._c.query_items(
            "SELECT * FROM c WHERE c.id = @id",
            parameters=[{"name": "@id", "value": todo_id}],
            enable_cross_partition_query=True,
        ):
            to_delete.append(doc)
        for d in to_delete:
            try:
                self._c.delete_item(d, partition_key=d.get("id"))
            except Exception:
                pass
        return len(to_delete) > 0
