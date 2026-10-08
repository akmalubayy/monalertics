import axios from 'axios'
import { ScreenshotProvider, ScreenshotResult } from './provider.interface'
import { logger } from '@/shared/utils/logger'

/**
 * Provider generik untuk layanan screenshot pihak ketiga.
 * Contoh: ScreenshotOne, Urlbox, ScreenshotAPI, dll.
 *
 * Endpoint harus mengembalikan gambar mentah (binary) atau JSON { url }.
 */
export class ExternalApiProvider implements ScreenshotProvider {
  readonly name = 'external'
  private endpoint?: string
  private apiKey?: string

  constructor(endpoint?: string, apiKey?: string) {
    this.endpoint = endpoint
    this.apiKey = apiKey
  }

  async capture(
    url: string,
    options?: { width?: number; height?: number }
  ): Promise<ScreenshotResult> {
    if (!this.endpoint) {
      return { success: false, error: 'SCREENSHOT_ENDPOINT not configured' }
    }

    try {
      const res = await axios.get(this.endpoint, {
        params: {
          url,
          width: options?.width ?? 1280,
          height: options?.height ?? 720,
          ...(this.apiKey ? { access_key: this.apiKey } : {}),
        },
        responseType: 'arraybuffer',
        timeout: 60000,
      })

      const buffer = Buffer.from(res.data)
      return {
        success: true,
        imageBuffer: buffer,
        imageBase64: buffer.toString('base64'),
      }
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? `External screenshot API error: ${err.response?.status ?? err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown error'
      logger.error(`External screenshot failed: ${msg}`)
      return { success: false, error: msg }
    }
  }
}
