from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

PRIORITY_PATTERN = "^(low|normal|high|urgent)$"

class Todo(BaseModel):
    """Todoアイテムを表すドメインモデル。

    フィールド:
        id: 一意なID（クライアント側生成想定）
        title: タイトル
        description: 詳細説明（任意）
        priority: 優先度 (low|normal|high|urgent)
        dueDate: 期限日時（任意）
        tags: タグ配列
        completed: 完了フラグ
        createdAt: 作成日時（UTC）
        updatedAt: 更新日時（UTC）
    振る舞い:
        mark_completed: 完了状態へ遷移
        reopen: 未完了状態へ戻す
    """
    id: str
    title: str
    description: Optional[str] = None
    priority: str = Field(pattern=PRIORITY_PATTERN)
    dueDate: Optional[datetime] = None
    tags: List[str] = []
    completed: bool = False
    createdAt: datetime
    updatedAt: datetime

    def mark_completed(self) -> Todo:
        """Todoを完了状態にする。

        既に完了なら何もしない。Pydanticモデルなので object.__setattr__ を使って属性を書き換える。
        戻り値: self（メソッドチェーン用）
        """
        if not self.completed:
            object.__setattr__(self, 'completed', True)
        return self

    def reopen(self) -> Todo:
        """Todoを未完了状態に戻す。

        既に未完了なら何もしない。
        戻り値: self
        """
        if self.completed:
            object.__setattr__(self, 'completed', False)
        return self
