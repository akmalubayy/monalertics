import { z } from 'zod'

export const createMonitorSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  type: z.enum(['UPTIME', 'SSL', 'DOMAIN'], {
    message: 'Tipe harus UPTIME, SSL, atau DOMAIN',
  }),
  target: z.string().min(1, 'Target wajib diisi'),
  intervalSeconds: z
    .number()
    .int()
    .refine((v) => [60, 300, 900, 1800, 3600].includes(v), {
      message: 'Interval harus 60, 300, 900, 1800, atau 3600 detik',
    })
    .default(300),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
})

export const updateMonitorSchema = createMonitorSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>

export interface MonitorSettings {
  expectedStatusCodes?: number[] // e.g. [200..299]
  timeoutMs?: number // request timeout
  followRedirects?: boolean
  expiryWarningDays?: number[] // e.g. [30, 14, 7, 3, 1]
  responseThresholdMs?: number // slow threshold
}
