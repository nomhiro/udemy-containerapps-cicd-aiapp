import { describe, it, expect, vi, beforeEach } from 'vitest'

// 動的 import でモック設定後に読み込む
const originalFetch = global.fetch

interface FetchCall {
  url: string | URL | Request
  init?: RequestInit
}

let calls: FetchCall[] = []

function mockFetch(responses: Array<{ status: number; body?: any }>) {
  let i = 0
  global.fetch = vi.fn(async (url: any, init?: any) => {
    const r = responses[Math.min(i, responses.length - 1)]
    i++
    calls.push({ url, init })
    return new Response(r.body !== undefined ? JSON.stringify(r.body) : undefined, {
      status: r.status,
      headers: { 'Content-Type': 'application/json' }
    }) as any
  })
}

describe('apiClient', () => {
  beforeEach(() => {
    calls = []
    global.fetch = originalFetch
  })

  it('returns JSON body on success', async () => {
    mockFetch([{ status: 200, body: { hello: 'world' } }])
    const { apiClient } = await import('../client')
    const data = await apiClient.get<{ hello: string }>('/api/test')
    expect(data.hello).toBe('world')
    expect(calls[0].url).toBe('/api/test')
  })

  it('returns undefined for 204', async () => {
    mockFetch([{ status: 204 }])
    const { apiClient } = await import('../client')
    const res = await apiClient.delete('/api/none')
    expect(res).toBeUndefined()
  })

  it('throws ApiError shape on error with JSON', async () => {
    mockFetch([{ status: 400, body: { detail: { type: 'bad_request', reason: 'x' } } }])
    const { apiClient } = await import('../client')
    await expect(apiClient.get('/api/bad')).rejects.toMatchObject({ detail: { type: 'bad_request' } })
  })
})
