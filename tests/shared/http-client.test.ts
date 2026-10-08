import { describe, it, expect, vi } from 'vitest'
import axios from 'axios'
import { httpRequest } from '@/shared/utils/http-client'

vi.mock('axios', () => ({
  default: vi.fn(),
}))

vi.mock('@/shared/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

describe('httpRequest', () => {
  it('should return success=true on 200 response', async () => {
    vi.mocked(axios).mockResolvedValue({ status: 200, data: { ok: true } } as any)

    const result = await httpRequest('https://example.com')

    expect(result.success).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ ok: true })
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('should return success=true even on 500 response', async () => {
    vi.mocked(axios).mockResolvedValue({ status: 500, data: 'error' } as any)

    const result = await httpRequest('https://example.com')

    expect(result.success).toBe(true)
    expect(result.status).toBe(500)
  })

  it('should return success=false on axios error', async () => {
    const error = new Error('Connection refused') as any
    error.code = 'ECONNREFUSED'
    vi.mocked(axios).mockRejectedValue(error)

    const result = await httpRequest('https://example.com')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Connection refused')
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('should detect timeout error specifically', async () => {
    const error = new Error('timeout') as any
    error.code = 'ECONNABORTED'
    vi.mocked(axios).mockRejectedValue(error)

    const result = await httpRequest('https://example.com', { timeoutMs: 5000 })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Timeout after 5000ms')
  })
})