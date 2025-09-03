import { useTodos } from '@/lib/api/todos'
import { TodoCard } from './TodoCard'
import type { Todo } from '@/lib/api/types'

interface Props { onEdit: (t: Todo) => void }

export function TodoList({ onEdit }: Props) {
  const { todos, isLoading, error } = useTodos()
  if (isLoading) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading...</p>
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">Failed to load</p>
  if (!todos?.length) return <p className="text-sm text-neutral-500 dark:text-neutral-400">No todos yet.</p>
  return (
    <ul className="space-y-2">
      {todos.map(t => <TodoCard key={t.id} todo={t} onEdit={onEdit} />)}
    </ul>
  )
}
