import { prisma } from '@/shared/db/prisma'
import { alertRepository } from './alert.repository'
import { sendEmail, buildAlertEmail } from './channels/email.channel'
import { sendTelegram, buildAlertTelegram } from './channels/telegram.channel'
import { sendDiscord, buildAlertDiscord } from './channels/discord.channel'
import { eventBus, EVENTS } from '@/shared/kernel/event-bus'
import { logger } from '@/shared/utils/logger'

export class AlertService {
  async sendAlert(data: {
    incidentId: string | null
    channelType: 'EMAIL' | 'TELEGRAM' | 'DISCORD'
    recipient: string
    monitorName: string
    target: string
    status: 'UP' | 'DOWN' | 'WARNING'
    message: string
    screenshotUrl?: string
  }) {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

    let success = false
    let content = ''

    switch (data.channelType) {
      case 'EMAIL': {
        const { subject, html, text } = buildAlertEmail({
          monitorName: data.monitorName,
          target: data.target,
          status: data.status,
          message: data.message,
          timestamp,
          screenshotUrl: data.screenshotUrl,
        })
        content = subject
        success = await sendEmail({ to: data.recipient, subject, html, text })
        break
      }
      case 'TELEGRAM': {
        content = buildAlertTelegram({
          monitorName: data.monitorName,
          target: data.target,
          status: data.status,
          message: data.message,
          timestamp,
        })
        success = await sendTelegram({ chatId: data.recipient, text: content, parseMode: 'HTML' })
        break
      }
      case 'DISCORD': {
        const payload = buildAlertDiscord({
          monitorName: data.monitorName,
          target: data.target,
          status: data.status,
          message: data.message,
          timestamp,
        })
        content = JSON.stringify(payload)
        success = await sendDiscord({ webhookUrl: data.recipient, content: `🚨 Alert`, embeds: payload.embeds })
        break
      }
    }

    // Log alert
    await alertRepository.createAlert({
      incidentId: data.incidentId,
      channelType: data.channelType,
      recipient: data.recipient,
      content,
    })

    if (success) {
      logger.info(`Alert sent: ${data.channelType} → ${data.recipient}`)
    } else {
      logger.error(`Alert failed: ${data.channelType} → ${data.recipient}`)
    }

    return success
  }

  async notifyMonitorStatusChanged(event: {
    monitorId: string
    prevStatus: string
    newStatus: string
    target: string
    daysUntilExpiry?: number
  }) {
    // Ambil monitor + configs + incident
    const monitor = await prisma.monitor.findUnique({
      where: { id: event.monitorId },
      include: {
        notificationConfigs: true,
        workspace: { include: { subscription: { include: { plan: true } } } },
        incidents: { where: { resolvedAt: null }, take: 1 },
      },
    })
    if (!monitor) return

    const isResolved = event.prevStatus === 'DOWN' && event.newStatus === 'UP'
    const isExpiryWarning = event.newStatus === 'WARNING' && event.daysUntilExpiry !== undefined

    const activeConfigs = monitor.notificationConfigs.filter((c) => c.isActive)
    const openIncident = monitor.incidents?.[0]
    const incidentId = openIncident?.id ?? null

    // Filter berdasarkan plan
    const plan = monitor.workspace.subscription?.plan
    const supportsTelegram = plan?.supportsTelegram ?? false
    const supportsDiscord = plan?.supportsDiscord ?? false

    // Ambil detail channel (target = channelId)
    const channelIds = activeConfigs.map((c) => c.target)
    const channels = await prisma.notificationChannel.findMany({
      where: { id: { in: channelIds } },
    })
    const channelMap = new Map(channels.map((c) => [c.id, c]))

    logger.info(`Processing ${activeConfigs.length} active alert configs for monitor ${event.monitorId}, incidentId=${incidentId}`)
    logger.info(`Plan support: Telegram=${supportsTelegram}, Discord=${supportsDiscord}`)

    for (let i = 0; i < activeConfigs.length; i++) {
      const config = activeConfigs[i]
      logger.info(`[Alert ${i+1}/${activeConfigs.length}] Type: ${config.channelType}`)
      
      if (config.channelType === 'TELEGRAM' && !supportsTelegram) {
        logger.warn(`Skip TELEGRAM: plan does not support`)
        continue
      }
      if (config.channelType === 'DISCORD' && !supportsDiscord) {
        logger.warn(`Skip DISCORD: plan does not support`)
        continue
      }

      const channel = channelMap.get(config.target)
      if (!channel || !channel.isActive) {
        logger.warn(`Channel not found or inactive`)
        continue
      }

      // Resolve recipient dari config channel
      const cfg = (channel.config ?? {}) as Record<string, string>
      let recipient = ''
      if (config.channelType === 'EMAIL') recipient = cfg.address ?? ''
      else if (config.channelType === 'TELEGRAM') recipient = cfg.chatId ?? ''
      else if (config.channelType === 'DISCORD') recipient = cfg.webhookUrl ?? ''
      if (!recipient) {
        logger.warn(`No recipient for ${config.channelType}`)
        continue
      }

      const status = isResolved ? 'UP' : isExpiryWarning ? 'WARNING' : 'DOWN'
      const message = isExpiryWarning
        ? `SSL/Domain expires in ${event.daysUntilExpiry} days`
        : event.newStatus === 'DOWN'
          ? `Site is down`
          : 'Site is back up'

      try {
        logger.info(`Sending alert [${i+1}] to ${config.channelType}`)
        await this.sendAlert({
          incidentId,
          channelType: config.channelType,
          recipient,
          monitorName: monitor.name,
          target: event.target,
          status,
          message,
        })
        logger.info(`Alert [${i+1}] sent`)
      } catch (err) {
        logger.error(`Alert [${i+1}] error:`, err)
      }
    }
  }

  /**
   * Cek koneksi ke channel tanpa mengirim pesan.
   */
  async testConnection(channel: {
    type: 'EMAIL' | 'TELEGRAM' | 'DISCORD'
    name: string
    config: unknown
  }): Promise<{ ok: boolean; error?: string }> {
    const cfg = (channel.config ?? {}) as Record<string, string>

    try {
      switch (channel.type) {
        case 'EMAIL': {
          const to = cfg.address
          if (!to) return { ok: false, error: 'Alamat email belum diisi' }
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(to)) return { ok: false, error: 'Format email tidak valid' }
          return { ok: true }
        }
        case 'TELEGRAM': {
          const chatId = cfg.chatId
          if (!chatId) return { ok: false, error: 'Chat ID belum diisi' }
          const botToken = process.env.TELEGRAM_BOT_TOKEN
          if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN tidak dikonfigurasi' }
          try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`)
            if (!res.ok) return { ok: false, error: `Telegram API error (${res.status})` }
            return { ok: true }
          } catch {
            return { ok: false, error: 'Gagal menghubungi Telegram API' }
          }
        }
        case 'DISCORD': {
          const webhookUrl = cfg.webhookUrl
          if (!webhookUrl) return { ok: false, error: 'Webhook URL belum diisi' }
          try {
            const res = await fetch(webhookUrl)
            if (!res.ok) return { ok: false, error: `Discord error (${res.status})` }
            const data = await res.json().catch(() => ({}))
            return { ok: true }
          } catch {
            return { ok: false, error: 'Gagal menghubungi Discord Webhook URL' }
          }
        }
        default:
          return { ok: false, error: 'Tipe channel tidak dikenal' }
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Koneksi gagal' }
    }
  }

  /**
   * Kirim pesan uji coba ke sebuah channel (Phase 1).
   * Mengembalikan { ok, error? } untuk feedback UI.
   */
  async testChannel(channel: {
    type: 'EMAIL' | 'TELEGRAM' | 'DISCORD'
    name: string
    config: unknown
    customMessage?: string
    customTitle?: string
  }): Promise<{ ok: boolean; error?: string }> {
    const cfg = (channel.config ?? {}) as Record<string, string>
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const monitorName = channel.customTitle || `Test Channel: ${channel.name}`
    const target = 'https://example.com'
    const message = channel.customMessage || 'Ini adalah pesan uji coba dari Monalertics.'

    try {
      switch (channel.type) {
        case 'EMAIL': {
          const to = cfg.address
          if (!to) return { ok: false, error: 'Alamat email belum dikonfigurasi' }
          const { subject, html, text } = buildAlertEmail({
            monitorName,
            target,
            status: 'UP',
            message,
            timestamp,
          })
          const sent = await sendEmail({ to, subject, html, text })
          return sent ? { ok: true } : { ok: false, error: 'Gagal mengirim email (cek konfigurasi SMTP)' }
        }
        case 'TELEGRAM': {
          const chatId = cfg.chatId
          if (!chatId) return { ok: false, error: 'Chat ID belum dikonfigurasi' }
          const text = buildAlertTelegram({
            monitorName,
            target,
            status: 'UP',
            message,
            timestamp,
          })
          const sent = await sendTelegram({ chatId, text, parseMode: 'HTML' })
          return sent
            ? { ok: true }
            : { ok: false, error: 'Gagal mengirim ke Telegram (cek TELEGRAM_BOT_TOKEN & chat ID)' }
        }
        case 'DISCORD': {
          const webhookUrl = cfg.webhookUrl
          if (!webhookUrl) return { ok: false, error: 'Webhook URL belum dikonfigurasi' }
          const payload = buildAlertDiscord({
            monitorName,
            target,
            status: 'UP',
            message,
            timestamp,
          })
          const sent = await sendDiscord({ webhookUrl, content: `📢 Test from Monalertics`, embeds: payload.embeds })
          return sent ? { ok: true } : { ok: false, error: 'Gagal mengirim ke Discord' }
        }
        default:
          return { ok: false, error: 'Tipe channel tidak dikenal' }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      logger.error('Test channel failed', err)
      return { ok: false, error: msg }
    }
  }
}

export const alertService = new AlertService()

// Subscribe to events
eventBus.on(EVENTS.MONITOR_STATUS_CHANGED, async (event: {
  monitorId: string
  prevStatus: string
  newStatus: string
  target: string
  daysUntilExpiry?: number
}) => {
  try {
    await alertService.notifyMonitorStatusChanged(event)
  } catch (err) {
    logger.error('Alert handler error', err)
  }
})
