import { z } from 'zod'

export const notificationConfigSchema = z.object({
  monitorId: z.string().uuid(),
  channelType: z.enum(['EMAIL', 'TELEGRAM', 'DISCORD']),
  target: z.string().min(1),
})

export const createNotificationConfigSchema = notificationConfigSchema.extend({
  isActive: z.boolean().default(true),
})

export type CreateNotificationConfigInput = z.infer<typeof createNotificationConfigSchema>
export type NotificationChannelType = 'EMAIL' | 'TELEGRAM' | 'DISCORD'

// Workspace channels (Phase 1)
export const createChannelSchema = z.object({
  type: z.enum(['EMAIL', 'TELEGRAM', 'DISCORD']),
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  target: z.string().min(1, 'Target wajib diisi'),
  // optional extra fields for specific providers
  botToken: z.string().optional(),
})

export type CreateChannelInput = z.infer<typeof createChannelSchema>
