from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class Todo(BaseModel):
    id: str
    userId: str
    title: str
    description: Optional[str] = None
    priority: str = Field(pattern="^(low|normal|high|urgent)$")
    dueDate: Optional[datetime] = None
    tags: List[str] = []
    completed: bool = False
    createdAt: datetime
    updatedAt: datetime
