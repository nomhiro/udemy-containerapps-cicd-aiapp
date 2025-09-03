from __future__ import annotations
from typing import Dict, List
from domain.models.todo import Todo
from domain.repositories.todo_repository import TodoRepository

class DuplicateTodoIdError(Exception):
    def __init__(self, todo_id: str):
        self.todo_id = todo_id

class InMemoryTodoRepository(TodoRepository):
    def __init__(self):
        """メモリ上にTodoを保持する簡易実装。テスト / ローカル用。"""
        self._items: Dict[str, Todo] = {}

    def add(self, todo: Todo) -> Todo:
        """新規追加。ID 重複時は DuplicateTodoIdError。シンプルな辞書登録。"""
        if todo.id in self._items:
            raise DuplicateTodoIdError(todo.id)
        self._items[todo.id] = todo
        return todo

    def list(self) -> List[Todo]:
        """全件取得。"""
        return list(self._items.values())

    def get(self, todo_id: str):
        """ID 取得。存在しなければ None。"""
        return self._items.get(todo_id)

    def save(self, todo: Todo) -> Todo:
        """更新（存在しない場合も upsert 的に保持）。"""
        self._items[todo.id] = todo
        return todo

    def delete(self, todo_id: str) -> bool:
        """削除。存在した場合 True。"""
        return self._items.pop(todo_id, None) is not None
