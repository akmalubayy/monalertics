import { z } from 'zod'

export const captureScreenshotSchema = z.object({
  monitorId: z.string().uuid('monitorId harus UUID'),
  url: z.string().url('URL tidak valid'),
})

export const screenshotListQuerySchema = z.object({
  monitorId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type CaptureScreenshotInput = z.infer<typeof captureScreenshotSchema>