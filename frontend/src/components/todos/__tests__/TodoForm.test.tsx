import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TodoForm } from '../TodoForm'

// NOTE: 引数無しで定義すると Vitest の型推論で Parameters が [] となり
// mock.calls[0][0] などのアクセスで TS2493 (タプル長 0) が発生するため
// ダミー引数を明示してパラメータタプル長を確保する。
// createTodo(data)
const createTodoMock = vi.fn(async (_data: any) => ({
  id: 'n1',
  title: 'A',
  completed: false,
  priority: 'normal',
  createdAt: 'c',
  updatedAt: 'u'
}))
// updateTodo(id, data)
const updateTodoMock = vi.fn(async (_id: any, _data: any) => ({}))
vi.mock('@/lib/api/todos', () => ({
  createTodo: function() { return (createTodoMock as any).apply(this, arguments as any) },
  updateTodo: function() { return (updateTodoMock as any).apply(this, arguments as any) }
}))

describe('TodoForm', () => {
  afterEach(() => {
    createTodoMock.mockReset()
    updateTodoMock.mockReset()
  })
  it('shows validation error when title empty', async () => {
    const onDone = vi.fn()
    render(<TodoForm mode="create" onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    // Zod の最小文字数エラー (英語メッセージ想定) 部分一致
    await waitFor(() => {
      expect(screen.getByText(/Title is required/i)).toBeInTheDocument()
    })
    expect(onDone).not.toHaveBeenCalled()
  })

  it('submits and calls onDone when valid', async () => {
    const onDone = vi.fn()
    render(<TodoForm mode="create" onDone={onDone} />)
  fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Task A' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('accepts title length 200 but rejects 201', async () => {
    const base = 'x'.repeat(199)
    const onDone = vi.fn()
    render(<TodoForm mode="create" onDone={onDone} />)
    // 200 OK
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: base + 'y' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())

    // リセット後 201 NG
    onDone.mockReset()
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: base + 'yz' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => {
      expect(screen.getByText(/200/i)).toBeInTheDocument() // Zod の max 200 文言 (数値含有で緩め一致)
    })
    expect(onDone).not.toHaveBeenCalled()
  })

  it('accepts description length 1000 but rejects 1001', async () => {
    const desc1000 = 'd'.repeat(1000)
    const onDone = vi.fn()
    render(<TodoForm mode="create" onDone={onDone} />)
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: desc1000 } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())

    // 1001 文字
    onDone.mockReset()
    const desc1001 = desc1000 + 'x'
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: desc1001 } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => {
      expect(screen.getByText(/1000/i)).toBeInTheDocument()
    })
    expect(onDone).not.toHaveBeenCalled()
  })

  it('transforms tags input to trimmed array (create)', async () => {
    const onDone = vi.fn()
    render(<TodoForm mode="create" onDone={onDone} />)
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Task' } })
    fireEvent.change(screen.getByLabelText(/Tags/i), { target: { value: '  a, b ,c , ' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(createTodoMock).toHaveBeenCalled()
    const arg = createTodoMock.mock.calls[0]?.[0] as any
    expect(arg.tags).toEqual(['a','b','c'])
  })

  it('omits tags when empty or only commas', async () => {
    const onDone = vi.fn()
    render(<TodoForm mode="create" onDone={onDone} />)
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Task' } })
    fireEvent.change(screen.getByLabelText(/Tags/i), { target: { value: ', , ,  ' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  const arg = createTodoMock.mock.calls[0]?.[0] as any
    expect(arg.tags).toBeUndefined()
  })

  it('transforms dueDate input to ISO (create)', async () => {
    const onDone = vi.fn()
    render(<TodoForm mode="create" onDone={onDone} />)
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Task' } })
    const dt = '2025-09-03T10:15'
    fireEvent.change(screen.getByLabelText(/Due Date/i), { target: { value: dt } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const arg = createTodoMock.mock.calls[0]?.[0] as any
    expect(arg.dueDate).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:.+Z/) // ISO 形式
    expect(() => new Date(arg.dueDate).toISOString()).not.toThrow()
  })

  it('omits dueDate when empty', async () => {
    const onDone = vi.fn()
    render(<TodoForm mode="create" onDone={onDone} />)
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Task' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const arg = createTodoMock.mock.calls[0]?.[0] as any
    expect(arg.dueDate).toBeUndefined()
  })

  it('transforms tags & dueDate on update mode', async () => {
    const onDone = vi.fn()
    const initial: any = { id: 't1', title: 'Old', completed: false, priority: 'normal', createdAt: 'c', updatedAt: 'u' }
    render(<TodoForm mode="edit" initial={initial} onDone={onDone} />)
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'New Title' } })
    fireEvent.change(screen.getByLabelText(/Tags/i), { target: { value: 'x , y' } })
    fireEvent.change(screen.getByLabelText(/Due Date/i), { target: { value: '2025-09-03T11:30' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(updateTodoMock).toHaveBeenCalled()
    const payload = updateTodoMock.mock.calls[0]?.[1] as any
    expect(payload.tags).toEqual(['x','y'])
    expect(payload.dueDate).toMatch(/T\d{2}:\d{2}:.+Z/) // タイムゾーン差異を吸収
  })
})
