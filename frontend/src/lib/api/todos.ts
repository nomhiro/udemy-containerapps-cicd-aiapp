import useSWR, { mutate } from 'swr'
import { apiClient } from './client'
import type { Todo } from './types'

const KEY = 'todos'

export function useTodos() {
  const { data, error, isLoading } = useSWR<Todo[]>(KEY, () => apiClient.get<Todo[]>('/api/todos'))
  return { todos: data, error, isLoading }
}

export async function createTodo(input: Partial<Todo> & { title: string }) {
  const created = await apiClient.post<Todo>('/api/todos', input)
  // 追加: 既存リストへ prepend
  mutate(KEY, (prev?: Todo[]) => prev ? [created, ...prev] : [created], { revalidate: false })
  return created
}

export async function toggleComplete(id: string, toCompleted: boolean) {
  const path = `/api/todos/${id}/${toCompleted ? 'complete' : 'reopen'}`
  // 楽観的更新
  mutate(KEY, (prev?: Todo[]) => prev?.map(t => t.id === id ? { ...t, completed: toCompleted, updatedAt: new Date().toISOString() } : t), { revalidate: false })
  try {
    const updated = await apiClient.patch<Todo>(path)
    mutate(KEY, (p?: Todo[]) => p?.map(t => t.id === id ? updated : t), { revalidate: false })
  } catch (e) {
    // rollback: 再取得
    mutate(KEY)
    throw e
  }
}

export async function updateTodo(id: string, patch: Partial<Pick<Todo, 'title' | 'description' | 'priority' | 'dueDate' | 'tags'>>) {
  // 楽観的適用
  mutate(KEY, (prev?: Todo[]) => prev?.map(t => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t), { revalidate: false })
  try {
    const updated = await apiClient.patch<Todo>(`/api/todos/${id}`, patch)
    mutate(KEY, (p?: Todo[]) => p?.map(t => t.id === id ? updated : t), { revalidate: false })
    return updated
  } catch (e) {
    mutate(KEY) // rollback
    throw e
  }
}

export async function deleteTodo(id: string) {
  mutate(KEY, (prev?: Todo[]) => prev?.filter(t => t.id !== id), { revalidate: false })
  try {
    await apiClient.delete(`/api/todos/${id}`)
  } catch (e) {
    mutate(KEY)
    throw e
  }
}
