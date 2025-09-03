export type ApiError = {
  detail: { type: string; [k: string]: unknown }
}

// クライアント側は常に Next.js の API ルート (/api/...) を叩く。
// Next.js サーバ内で FastAPI へプロキシするため baseUrl は空にして同一オリジン相対パス。
const baseUrl = ''
if (process.env.NODE_ENV !== 'production') {
  console.log('[api] baseUrl (relative)')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = baseUrl + path
  if (process.env.NODE_ENV !== 'production') {
    console.log('[api] request', url, init?.method || 'GET')
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })
  if (!res.ok) {
    let body: unknown
    try { body = await res.json() } catch { /* ignore */ }
    const err: ApiError = (body as ApiError) || { detail: { type: 'unknown_error', status: res.status } }
    throw err
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' })
}
