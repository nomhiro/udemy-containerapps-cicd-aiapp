import { describe, it, expect, vi, beforeEach } from 'vitest'

const mutateMock = vi.fn()
vi.mock('swr', () => ({
  __esModule: true,
  default: vi.fn(),
  mutate: (...args: any[]) => mutateMock(...args)
}))

vi.mock('../client', () => ({
  apiClient: {
    post: vi.fn(async () => ({ id: 'new1', title: 'X', completed: false, priority: 'normal', createdAt: 'c', updatedAt: 'u' })),
    patch: vi.fn(async () => ({ id: 't1', title: 'T1', completed: true, priority: 'normal', createdAt: 'c', updatedAt: 'u2' })),
    delete: vi.fn(async () => undefined)
  }
}))

describe('todos optimistic mutations', () => {
  beforeEach(() => {
    mutateMock.mockReset()
  })

  it('createTodo prepends item via mutate', async () => {
    const { createTodo } = await import('../todos')
    await createTodo({ title: 'X' })
    expect(mutateMock).toHaveBeenCalledTimes(1)
    expect(mutateMock.mock.calls[0][0]).toBe('todos')
    const updater = mutateMock.mock.calls[0][1]
    const updated = updater([])
    expect(updated[0].id).toBe('new1')
  })

  it('toggleComplete optimistic then commit', async () => {
    const { toggleComplete } = await import('../todos')
    await toggleComplete('t1', true)
    expect(mutateMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(mutateMock.mock.calls[0][0]).toBe('todos')
  })

  it('deleteTodo optimistic then commit', async () => {
    const { deleteTodo } = await import('../todos')
    await deleteTodo('t1')
    expect(mutateMock).toHaveBeenCalled()
    expect(mutateMock.mock.calls[0][0]).toBe('todos')
  })
})
