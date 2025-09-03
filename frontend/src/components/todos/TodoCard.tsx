import React from 'react'
import { toggleComplete, deleteTodo } from '@/lib/api/todos'
import type { Todo } from '@/lib/api/types'
import { useState } from 'react'

interface Props { todo: Todo; onEdit: (t: Todo) => void }

export function TodoCard({ todo, onEdit }: Props) {
  const [pending, setPending] = useState(false)
  return (
    <li className="group relative rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950 p-4 flex items-start justify-between gap-4 shadow-sm hover:shadow-md transition-shadow backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-neutral-900/60">
      <div className="flex items-start gap-3 min-w-0">
        <button
          aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
          className={`mt-1 h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-semibold transition-colors ${todo.completed ? 'bg-green-500 border-green-500 text-white' : 'border-neutral-400 hover:border-neutral-600 dark:border-neutral-600 dark:hover:border-neutral-400'}`}
          disabled={pending}
          onClick={async () => { setPending(true); try { await toggleComplete(todo.id, !todo.completed) } finally { setPending(false) } }}
        >{todo.completed ? '✓' : ''}</button>
        <div className="space-y-1 min-w-0">
          <p className={`font-medium tracking-tight text-neutral-900 dark:text-neutral-100 truncate ${todo.completed ? 'line-through text-neutral-400 dark:text-neutral-500' : ''}`}>{todo.title}</p>
          <div className="text-[11px] flex flex-wrap gap-2 items-center text-neutral-500 dark:text-neutral-400">
            <PriorityBadge priority={todo.priority} />
            {todo.dueDate && <span className="inline-flex items-center gap-1"><span className="i-lucide-calendar text-[12px]" />due {new Date(todo.dueDate).toLocaleDateString()}</span>}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 dark:text-neutral-500">{new Date(todo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="text-xs px-3 py-1.5 rounded-full bg-neutral-900/90 text-white dark:bg-neutral-200 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white shadow-sm disabled:opacity-50"
          onClick={() => onEdit(todo)}
          disabled={pending}
        >Edit</button>
        <button
          className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-sm disabled:opacity-50"
          onClick={async () => { setPending(true); try { await deleteTodo(todo.id) } finally { setPending(false) } }}
          disabled={pending}
        >Del</button>
      </div>
      {pending && <div className="absolute inset-0 rounded-xl bg-white/40 dark:bg-black/30 backdrop-blur-[2px] animate-pulse" />}
    </li>
  )
}

export function PriorityBadge({ priority }: { priority: Todo['priority'] }) {
  const color: Record<Todo['priority'], string> = {
    low: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200',
    normal: 'bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-100',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-700 dark:text-orange-100',
    urgent: 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100'
  }
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize tracking-wide shadow-inner ${color[priority]}`}>{priority}</span>
}
