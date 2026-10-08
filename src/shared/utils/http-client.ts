import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { logger } from './logger'

export interface HttpResult<T = unknown> {
  success: boolean
  status?: number
  data?: T
  responseTimeMs: number
  error?: string
}

export async function httpRequest<T = unknown>(
  url: string,
  config?: AxiosRequestConfig & { timeoutMs?: number }
): Promise<HttpResult<T>> {
  const startTime = Date.now()
  try {
    const res = await axios<T>({
      url,
      timeout: config?.timeoutMs ?? 10000,
      maxRedirects: 5,
      validateStatus: () => true, // accept all status codes
      ...config,
    })
    const responseTimeMs = Date.now() - startTime
    return {
      success: true,
      status: res.status,
      data: res.data,
      responseTimeMs,
    }
  } catch (err) {
    const responseTimeMs = Date.now() - startTime
    const axiosErr = err as AxiosError
    const message =
      axiosErr.code === 'ECONNABORTED'
        ? `Timeout after ${config?.timeoutMs ?? 10000}ms`
        : axiosErr.message || 'Unknown HTTP error'

    logger.warn(`HTTP request failed: ${url} — ${message}`)
    return {
      success: false,
      responseTimeMs,
      error: message,
    }
  }
}
