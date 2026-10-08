import axios from 'axios'
import { ScreenshotProvider, ScreenshotResult } from './provider.interface'
import { logger } from '@/shared/utils/logger'

/**
 * Google PageSpeed Insights API — gratis, tanpa API key untuk rate terbatas.
 * Mengembalikan screenshot versi mobile dari halaman.
 *
 * Docs: https://developers.google.com/speed/docs/insights/v5/get-started
 */
export class PageSpeedProvider implements ScreenshotProvider {
  readonly name = 'pagespeed'
  private apiKey?: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey
  }

  async capture(url: string): Promise<ScreenshotResult> {
    try {
      const params: Record<string, string> = {
        url,
        strategy: 'mobile',
        category: 'performance',
      }
      if (this.apiKey) params.key = this.apiKey

      const res = await axios.get(
        'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
        { params, timeout: 60000 }
      )

      const base64 =
        res.data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data
      if (!base64) {
        return { success: false, error: 'No screenshot in PageSpeed response' }
      }

      const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(cleanBase64, 'base64')
      return { success: true, imageBuffer: buffer, imageBase64: cleanBase64 }
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? `PageSpeed API error: ${err.response?.status ?? err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown error'
      logger.error(`PageSpeed screenshot failed: ${msg}`)
      return { success: false, error: msg }
    }
  }
}
