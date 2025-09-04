"use client";
import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createTodo, updateTodo } from '@/lib/api/todos'
import type { Todo } from '@/lib/api/types'
import { useState } from 'react'

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  // priority は常に必須 (default: normal) として undefined 許容避ける
  priority: z.enum(['low','normal','high','urgent']).catch('normal'),
  dueDate: z.string().optional(),
  tags: z.string().optional() // カンマ区切り入力 → 配列化
}).strict()

type Values = z.infer<typeof schema>

interface Props {
  mode: 'create' | 'edit'
  initial?: Todo
  onDone: () => void
}

export function TodoForm({ mode, initial, onDone }: Props) {
  const { register, handleSubmit, formState: { errors }, reset, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial ? {
      title: initial.title,
      description: initial.description ?? '',
      priority: initial.priority,
      dueDate: initial.dueDate ? initial.dueDate.substring(0,16) : '',
      tags: initial.tags?.join(',') ?? ''
    } : { title: '', priority: 'normal', description: '', dueDate: '', tags: '' }
  })
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const payload: Partial<Todo> & { title: string } = {
        title: values.title,
        description: values.description || undefined,
        priority: values.priority,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
        tags: (() => {
          if (!values.tags) return undefined
          const arr = values.tags.split(',').map(t => t.trim()).filter(Boolean)
            return arr.length ? arr : undefined
        })()
      }
      if (mode === 'create') {
        await createTodo(payload)
        reset({ title: '', description: '', priority: 'normal', dueDate: '', tags: '' })
      } else if (initial) {
        await updateTodo(initial.id, payload)
      }
      onDone()
    } catch (e: unknown) {
      const err = e as { detail?: { type?: string; errors?: Array<{ field?: string; message?: string; errorType?: string }> } }
      const detail = err.detail
      if (detail?.type === 'validation_error' && Array.isArray(detail.errors)) {
        let mapped = false
        for (const ve of detail.errors) {
          const field = ve.field as keyof Values | undefined
          if (field && field in (errors || {})) {
            setError(field, { type: ve.errorType || 'server', message: ve.message || 'Invalid value' })
            mapped = true
          } else if (field && ['title','description','priority','dueDate','tags'].includes(field)) {
            // RHF にまだ無い場合でもセット
            setError(field as keyof Values, { type: ve.errorType || 'server', message: ve.message || 'Invalid value' })
            mapped = true
          }
        }
        if (mapped) return // フィールドエラー表示に委譲
      }
      console.error('Submit failed', e)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Field label="Title *" error={errors.title?.message}>
        <input className="w-full rounded-lg border border-neutral-300/80 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/60 backdrop-blur px-3 py-2 text-sm shadow-inner outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500" disabled={submitting} {...register('title')} />
      </Field>
      <Field label="Description" error={errors.description?.message}>
        <textarea rows={3} className="w-full rounded-lg border border-neutral-300/80 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/60 backdrop-blur px-3 py-2 text-sm shadow-inner outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors resize-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500" disabled={submitting} {...register('description')} />
      </Field>
      <div className="grid grid-cols-2 gap-5">
        <Field label="Priority" error={errors.priority?.message}>
          <select className="w-full rounded-lg border border-neutral-300/80 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/60 backdrop-blur px-3 py-2 text-sm shadow-inner outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors" disabled={submitting} {...register('priority')}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        <Field label="Due Date (UTC)" error={errors.dueDate?.message}>
          <input type="datetime-local" className="w-full rounded-lg border border-neutral-300/80 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/60 backdrop-blur px-3 py-2 text-sm shadow-inner outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors" disabled={submitting} {...register('dueDate')} />
        </Field>
      </div>
      <Field label="Tags (comma separated)" error={errors.tags?.message}>
        <input className="w-full rounded-lg border border-neutral-300/80 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/60 backdrop-blur px-3 py-2 text-sm shadow-inner outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500" disabled={submitting} {...register('tags')} />
      </Field>
      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onDone} className="inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium tracking-tight text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70 transition-all focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting}>Cancel</button>
        <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-1 rounded-full px-5 py-2 text-sm font-medium tracking-tight bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900 shadow hover:bg-neutral-800 dark:hover:bg-white active:translate-y-px transition-all focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? 'Saving...' : (mode === 'create' ? 'Create' : 'Update')}
        </button>
      </div>
    </form>
  )
}

// Inline UI primitives (Tailwind utility compositions)
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  type ControlProps = { id?: string; 'aria-invalid'?: string; 'aria-describedby'?: string }
  const baseId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'field'
  let childNode = children
  if (React.isValidElement<ControlProps>(children)) {
    const props = children.props as ControlProps & { id?: string }
    childNode = React.cloneElement(children, {
      id: props.id || baseId,
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': error ? `${baseId}-error` : props['aria-describedby']
    })
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor={baseId} className="block text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-300 select-none">{label}</label>
      {childNode}
      {error && <p id={`${baseId}-error`} className="text-[11px] text-red-500 font-medium">{error}</p>}
    </div>
  )
}
