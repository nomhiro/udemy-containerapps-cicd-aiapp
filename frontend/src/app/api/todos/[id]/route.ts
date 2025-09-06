import { NextRequest } from 'next/server'

const backend = process.env.BACKEND_API_BASE || 'http://localhost:80'

async function forward(r: Response) {
  // 204 / 304 ではボディを返さない (Edge/Node ランタイムでエラー回避)
  if (r.status === 204 || r.status === 304) {
    return new Response(null, { status: r.status })
  }
  const text = await r.text()
  const headers = new Headers()
  const ct = r.headers.get('content-type')
  if (ct && text) headers.set('Content-Type', ct)
  return new Response(text, { status: r.status, headers })
}

type UpstreamError = { detail: { type: string; backend: string; id?: string; message?: string } }

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const body = await req.text()
  try {
    const r = await fetch(`${backend}/api/todos/${id}`, { method: 'PATCH', body, headers: { 'Content-Type': 'application/json' } })
    return forward(r)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[proxy][PATCH /api/todos/:id] upstream error', backend, id, message)
    const payload: UpstreamError = { detail: { type: 'upstream_unreachable', backend, id, message } }
    return new Response(JSON.stringify(payload), { status: 502 })
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const r = await fetch(`${backend}/api/todos/${id}`, { method: 'DELETE' })
    return forward(r)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[proxy][DELETE /api/todos/:id] upstream error', backend, id, message)
    const payload: UpstreamError = { detail: { type: 'upstream_unreachable', backend, id, message } }
    return new Response(JSON.stringify(payload), { status: 502 })
  }
}
