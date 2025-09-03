import { describe, it, expect, vi } from 'vitest'

// swr mutate モック
const mutateMock = vi.fn()
vi.mock('swr', () => ({
  __esModule: true,
  default: vi.fn(),
  mutate: (...args: any[]) => mutateMock(...args)
}))

// apiClient 失敗モック (呼び出し毎に reject)
const patchErr = new Error('patch failed')
const deleteErr = new Error('delete failed')
vi.mock('../client', () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(async () => { throw patchErr }),
    delete: vi.fn(async () => { throw deleteErr })
  }
}))

describe('todos optimistic rollback on failure', () => {
  it('toggleComplete rollback sequence', async () => {
    const { toggleComplete } = await import('../todos')
    mutateMock.mockReset()
    await expect(toggleComplete('t1', true)).rejects.toThrow(patchErr)
    // 最初: 楽観 (updater 関数付き), 最後: rollback (引数1のみ)
    expect(mutateMock.mock.calls[0][0]).toBe('todos')
    expect(typeof mutateMock.mock.calls[0][1]).toBe('function')
    const last = mutateMock.mock.calls.at(-1)!
    expect(last[0]).toBe('todos')
    expect(last.length).toBe(1)
  })

  it('updateTodo rollback sequence', async () => {
    const { updateTodo } = await import('../todos')
    const { apiClient } = await import('../client')
    ;(apiClient as any).patch = vi.fn(async () => { throw patchErr })
    mutateMock.mockReset()
    await expect(updateTodo('t1', { title: 'New' })).rejects.toThrow()
    expect(mutateMock.mock.calls[0][0]).toBe('todos')
    expect(typeof mutateMock.mock.calls[0][1]).toBe('function')
    const last = mutateMock.mock.calls.at(-1)!
    expect(last[0]).toBe('todos')
    expect(last.length).toBe(1)
  })

  it('deleteTodo rollback sequence', async () => {
    const { deleteTodo } = await import('../todos')
    const { apiClient } = await import('../client')
    ;(apiClient as any).delete = vi.fn(async () => { throw deleteErr })
    mutateMock.mockReset()
    await expect(deleteTodo('t1')).rejects.toThrow()
    expect(mutateMock.mock.calls[0][0]).toBe('todos')
    expect(typeof mutateMock.mock.calls[0][1]).toBe('function')
    const last = mutateMock.mock.calls.at(-1)!
    expect(last[0]).toBe('todos')
    expect(last.length).toBe(1)
  })
})
