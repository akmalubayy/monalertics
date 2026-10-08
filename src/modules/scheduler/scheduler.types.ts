import { z } from 'zod'

export const jobPayloadSchema = z.object({
  monitorId: z.string().uuid('monitorId harus UUID'),
})

export type JobPayload = z.infer<typeof jobPayloadSchema>
