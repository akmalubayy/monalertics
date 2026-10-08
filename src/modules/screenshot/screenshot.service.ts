import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/shared/db/prisma'
import { env } from '@/shared/config/env'
import { logger } from '@/shared/utils/logger'
import { ScreenshotProvider } from './providers/provider.interface'
import { PageSpeedProvider } from './providers/pagespeed.provider'
import { ExternalApiProvider } from './providers/external-api.provider'

const SCREENSHOT_DIR = path.join(process.cwd(), 'public', 'screenshots')

export class ScreenshotService {
  private provider: ScreenshotProvider

  constructor() {
    switch (env.SCREENSHOT_PROVIDER) {
      case 'pagespeed':
        this.provider = new PageSpeedProvider(env.SCREENSHOT_API_KEY)
        break
      case 'external':
        this.provider = new ExternalApiProvider(
          process.env.SCREENSHOT_ENDPOINT,
          env.SCREENSHOT_API_KEY
        )
        break
      default:
        // Fallback ke pagespeed (tanpa API key, rate terbatas)
        this.provider = new PageSpeedProvider()
    }
  }

  async captureAndStore(monitorId: string, url: string): Promise<string | null> {
    try {
      const result = await this.provider.capture(url)
      if (!result.success || !result.imageBuffer) {
        logger.warn(`Screenshot capture failed for ${url}: ${result.error}`)
        return null
      }

      // Buat folder per monitor
      const monitorDir = path.join(SCREENSHOT_DIR, monitorId)
      await fs.mkdir(monitorDir, { recursive: true })

      const filename = `${Date.now()}.png`
      const filepath = path.join(monitorDir, filename)
      await fs.writeFile(filepath, result.imageBuffer)

      const publicPath = `/screenshots/${monitorId}/${filename}`

      const screenshot = await prisma.screenshot.create({
        data: {
          monitorId,
          url,
          imagePath: publicPath,
        },
      })

      logger.info(`Screenshot saved: ${publicPath}`)
      return screenshot.id
    } catch (err) {
      logger.error('Screenshot service error', err)
      return null
    }
  }

  async getByMonitor(monitorId: string, limit = 20) {
    return prisma.screenshot.findMany({
      where: { monitorId },
      orderBy: { capturedAt: 'desc' },
      take: limit,
    })
  }
}

export const screenshotService = new ScreenshotService()
