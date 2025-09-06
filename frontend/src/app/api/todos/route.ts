import { NextRequest } from 'next/server'

// プロキシ先 FastAPI ベース URL (例: http://localhost:8000)
const backend = process.env.BACKEND_API_BASE || 'http://localhost:80'

async function forward(r: Response) {
  if (r.status === 204 || r.status === 304) {
    return new Response(null, { status: r.status })
  }
  const bodyText = await r.text()
  const headers = new Headers()
  const ct = r.headers.get('content-type')
  if (ct && bodyText) headers.set('Content-Type', ct)
  return new Response(bodyText, { status: r.status, headers })
}

type UpstreamErrorPayload = { detail: { type: string; backend: string; message?: string; [k: string]: unknown } }

export async function GET() {
  try {
    const r = await fetch(`${backend}/api/todos`)
    return forward(r)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[proxy][GET /api/todos] upstream error', backend, message)
    const payload: UpstreamErrorPayload = { detail: { type: 'upstream_unreachable', backend, message } }
    return new Response(JSON.stringify(payload), { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  try {
    const r = await fetch(`${backend}/api/todos`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' }
    })
    return forward(r)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[proxy][POST /api/todos] upstream error', backend, message)
    const payload: UpstreamErrorPayload = { detail: { type: 'upstream_unreachable', backend, message } }
    return new Response(JSON.stringify(payload), { status: 502 })
  }
}
