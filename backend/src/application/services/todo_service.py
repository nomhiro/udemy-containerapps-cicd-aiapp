from __future__ import annotations
from typing import List
from domain.models.todo import Todo
from domain.repositories.todo_repository import TodoRepository

class TodoService:
    def __init__(self, repo: TodoRepository):
        """サービス層コンストラクタ。

        引数:
            repo: TodoRepository 実装（永続化の抽象）
        """
        self._repo = repo

    def create(self, todo: Todo) -> Todo:
        """Todoを新規作成して保存する。重複IDならリポジトリ側が例外を送出。"""
        return self._repo.add(todo)

    def list(self) -> List[Todo]:
        """全Todo一覧を取得する。"""
        return self._repo.list()

    def get(self, todo_id: str) -> Todo | None:
        """ID で単一Todoを取得。存在しなければ None。"""
        return self._repo.get(todo_id)

    def update_partial(self, todo_id: str, **changes) -> Todo | None:
        """指定IDのTodoを部分更新する。

        変更可能フィールドのみ適用し、更新があれば updatedAt を現在時刻に更新する。
        存在しなければ None を返す。
        """
        todo = self._repo.get(todo_id)
        if not todo:
            return None
        mutable_fields = {"title", "description", "priority", "dueDate", "tags"}
        updated = False
        for k, v in changes.items():
            if k in mutable_fields and v is not None:
                setattr(todo, k, v)
                updated = True
        if updated:
            from datetime import datetime, timezone
            todo.updatedAt = datetime.now(timezone.utc)
            todo = self._repo.save(todo)
        return todo

    def complete(self, todo_id: str) -> Todo | None:
        """Todo を完了状態へ。状態が変わった場合のみ updatedAt を更新。

        存在しなければ None。
        """
        todo = self._repo.get(todo_id)
        if not todo:
            return None
        if not todo.completed:
            todo.mark_completed()
            from datetime import datetime, timezone
            todo.updatedAt = datetime.now(timezone.utc)
            todo = self._repo.save(todo)
        return todo

    def reopen(self, todo_id: str) -> Todo | None:
        """Todo を未完了状態へ戻す。状態が変わった時のみ updatedAt 更新。"""
        todo = self._repo.get(todo_id)
        if not todo:
            return None
        if todo.completed:
            todo.reopen()
            from datetime import datetime, timezone
            todo.updatedAt = datetime.now(timezone.utc)
            todo = self._repo.save(todo)
        return todo

    def delete(self, todo_id: str) -> bool:
        """指定IDのTodoを削除。存在した場合 True、なければ False。"""
        return self._repo.delete(todo_id)
