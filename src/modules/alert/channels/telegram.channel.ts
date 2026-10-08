import axios from 'axios'
import { logger } from '@/shared/utils/logger'

export interface TelegramPayload {
  chatId: string
  text: string
  parseMode?: 'HTML' | 'Markdown'
}

export async function sendTelegram(payload: TelegramPayload): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    logger.warn('TELEGRAM_BOT_TOKEN not configured')
    return false
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    logger.info(`Telegram sending to ${payload.chatId} via ${url.slice(0, 40)}...`)
    const response = await axios.post(
      url,
      {
        chat_id: payload.chatId,
        text: payload.text,
        parse_mode: payload.parseMode,
        disable_web_page_preview: true,
      },
      { timeout: 10000 }
    )
    logger.info(`Telegram sent OK to ${payload.chatId}: ${response.data?.ok}`)
    return true
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : JSON.stringify(err)
    logger.error(`Telegram send failed to ${payload.chatId}: ${errMsg}`, err)
    console.error('[TELEGRAM ERROR]', {
      chatId: payload.chatId,
      tokenPrefix: botToken.slice(0, 10) + '...',
      error: errMsg,
    })
    return false
  }
}

export function buildAlertTelegram(data: {
  monitorName: string
  target: string
  status: 'UP' | 'DOWN' | 'WARNING'
  message: string
  timestamp: string
}): string {
  const emoji = data.status === 'DOWN' ? '🚨' : data.status === 'UP' ? '✅' : '⚠️'
  const statusText = data.status === 'DOWN' ? 'DOWN' : data.status === 'UP' ? 'UP' : 'WARNING'

  return `${emoji} <b>[Monalertics] ${data.monitorName} is ${statusText}</b>

<b>Monitor:</b> ${data.monitorName}
<b>Target:</b> ${data.target}
<b>Status:</b> ${statusText}
<b>Message:</b> ${data.message}
<b>Time:</b> ${data.timestamp}

— Monalertics`
}