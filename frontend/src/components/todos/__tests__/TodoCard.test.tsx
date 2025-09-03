import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { TodoCard } from '../TodoCard'

vi.mock('@/lib/api/todos', () => ({
  toggleComplete: vi.fn(() => Promise.resolve()),
  deleteTodo: vi.fn(() => Promise.resolve())
}))

const baseTodo = {
  id: 't1',
  title: 'Test Todo',
  description: null,
  priority: 'normal',
  dueDate: null,
  tags: null,
  completed: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

describe('TodoCard', () => {
  it('renders title', () => {
    render(<TodoCard todo={baseTodo as any} onEdit={() => {}} />)
    expect(screen.getByText('Test Todo')).toBeInTheDocument()
  })

  it('calls onEdit when Edit clicked', () => {
    const onEdit = vi.fn()
    render(<TodoCard todo={baseTodo as any} onEdit={onEdit} />)
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalled()
  })
})
