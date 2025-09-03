"use client";
import { useState } from "react";
import type { Todo } from "@/lib/api/types";
import { TodoList } from "@/components/todos/TodoList";
import { Modal } from "@/components/ui/Modal";
import { TodoForm } from "@/components/todos/TodoForm";

export default function TaskBoard() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);

  return (
    <div className="mx-auto max-w-3xl p-8 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-neutral-900 to-neutral-500 bg-clip-text text-transparent dark:from-neutral-100 dark:to-neutral-400">Tasks</h1>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-neutral-900 to-neutral-800 text-neutral-50 dark:from-neutral-100 dark:to-neutral-200 dark:text-neutral-900 px-5 py-2 text-sm font-medium shadow-sm hover:shadow transition-all active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        ><span className="text-base leading-none">＋</span><span>New</span></button>
      </header>
      <TodoList onEdit={(t) => setEditing(t)} />

      <Modal
        title="Create Todo"
        open={creating}
        onClose={() => setCreating(false)}
      >
        <TodoForm mode="create" onDone={() => setCreating(false)} />
      </Modal>

      <Modal
        title="Edit Todo"
        open={!!editing}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <TodoForm mode="edit" initial={editing} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </div>
  );
}
