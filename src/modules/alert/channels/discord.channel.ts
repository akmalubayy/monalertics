import axios from 'axios'
import { logger } from '@/shared/utils/logger'

export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  timestamp?: string
  footer?: { text: string }
}

export interface DiscordPayload {
  webhookUrl: string
  content?: string
  embeds?: DiscordEmbed[]
}

export async function sendDiscord(payload: DiscordPayload): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {}
    if (payload.content) body.content = payload.content
    if (payload.embeds && payload.embeds.length > 0) body.embeds = payload.embeds
    await axios.post(payload.webhookUrl, body, { timeout: 10000 })
    logger.info(`Discord webhook sent`)
    return true
  } catch (err) {
    logger.error(`Discord send failed`, err)
    return false
  }
}

export function buildAlertDiscord(data: {
  monitorName: string
  target: string
  status: 'UP' | 'DOWN' | 'WARNING'
  message: string
  timestamp: string
}): { embeds: DiscordEmbed[] } {
  const color =
    data.status === 'DOWN' ? 0xdc2626 : data.status === 'UP' ? 0x16a34a : 0xd97706
  const statusText = data.status === 'DOWN' ? 'DOWN' : data.status === 'UP' ? 'UP' : 'WARNING'

  return {
    embeds: [
      {
        title: `Monalertics Alert: ${data.monitorName} is ${statusText}`,
        color,
        fields: [
          { name: 'Monitor', value: data.monitorName, inline: true },
          { name: 'Target', value: data.target, inline: true },
          { name: 'Status', value: statusText, inline: true },
          { name: 'Message', value: data.message },
        ],
        timestamp: data.timestamp,
        footer: { text: 'Monalertics — Website, Domain & SSL Monitoring' },
      },
    ],
  }
}