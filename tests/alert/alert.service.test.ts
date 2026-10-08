import { describe, it, expect, vi, beforeEach } from 'vitest'
import { alertService } from '@/modules/alert/alert.service'
import { alertRepository } from '@/modules/alert/alert.repository'
import { sendEmail, buildAlertEmail } from '@/modules/alert/channels/email.channel'
import { sendTelegram, buildAlertTelegram } from '@/modules/alert/channels/telegram.channel'
import { sendDiscord, buildAlertDiscord } from '@/modules/alert/channels/discord.channel'
import { eventBus, EVENTS } from '@/shared/kernel/event-bus'

// Mock dependencies
vi.mock('@/modules/alert/alert.repository', () => ({
  alertRepository: {
    createAlert: vi.fn(),
    updateAlertStatus: vi.fn(),
  },
}))

vi.mock('@/modules/alert/channels/email.channel', () => ({
  sendEmail: vi.fn(),
  buildAlertEmail: vi.fn(() => ({
    subject: 'Test Subject',
    html: '<p>Test</p>',
    text: 'Test',
  })),
}))

vi.mock('@/modules/alert/channels/telegram.channel', () => ({
  sendTelegram: vi.fn(),
  buildAlertTelegram: vi.fn(() => 'Telegram text'),
}))

vi.mock('@/modules/alert/channels/discord.channel', () => ({
  sendDiscord: vi.fn(),
  buildAlertDiscord: vi.fn(() => ({ embeds: [] })),
}))

vi.mock('@/shared/db/prisma', () => {
  const mockDb = {
    monitor: { findUnique: vi.fn(), findMany: vi.fn() },
    notificationConfig: { findMany: vi.fn() },
    notificationChannel: { findUnique: vi.fn(), findMany: vi.fn() },
    incident: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
  }
  return { prisma: mockDb }
})

import { prisma } from '@/shared/db/prisma'

describe('AlertService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendAlert', () => {
    it('should send EMAIL alert and log success', async () => {
      vi.mocked(sendEmail).mockResolvedValue(true)

      const result = await alertService.sendAlert({
        incidentId: 'inc-1',
        channelType: 'EMAIL',
        recipient: 'test@example.com',
        monitorName: 'Test Monitor',
        target: 'https://example.com',
        status: 'DOWN',
        message: 'Site is down',
      })

      expect(result).toBe(true)
      expect(sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test',
      })
      expect(alertRepository.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentId: 'inc-1',
          channelType: 'EMAIL',
          recipient: 'test@example.com',
        })
      )
    })

    it('should return false when EMAIL send fails', async () => {
      vi.mocked(sendEmail).mockResolvedValue(false)

      const result = await alertService.sendAlert({
        incidentId: 'inc-1',
        channelType: 'EMAIL',
        recipient: 'test@example.com',
        monitorName: 'Test Monitor',
        target: 'https://example.com',
        status: 'DOWN',
        message: 'Site is down',
      })

      expect(result).toBe(false)
    })

    it('should send TELEGRAM alert successfully', async () => {
      vi.mocked(sendTelegram).mockResolvedValue(true)

      const result = await alertService.sendAlert({
        incidentId: 'inc-1',
        channelType: 'TELEGRAM',
        recipient: '123456789',
        monitorName: 'Test Monitor',
        target: 'https://example.com',
        status: 'UP',
        message: 'Site is back up',
      })

      expect(result).toBe(true)
      expect(sendTelegram).toHaveBeenCalledWith({
        chatId: '123456789',
        text: 'Telegram text',
        parseMode: 'HTML',
      })
    })

    it('should send DISCORD alert successfully', async () => {
      vi.mocked(sendDiscord).mockResolvedValue(true)

      const result = await alertService.sendAlert({
        incidentId: 'inc-1',
        channelType: 'DISCORD',
        recipient: 'https://discord.com/webhook/123',
        monitorName: 'Test Monitor',
        target: 'https://example.com',
        status: 'WARNING',
        message: 'SSL expires soon',
      })

      expect(result).toBe(true)
      expect(sendDiscord).toHaveBeenCalledWith({
        webhookUrl: 'https://discord.com/webhook/123',
        embeds: [],
      })
    })
  })

  describe('notifyMonitorStatusChanged', () => {
    it('should send alert when monitor goes DOWN', async () => {
      const mockMonitor = {
        id: 'mon-1',
        name: 'Test Monitor',
        notificationConfigs: [
          { id: 'nc-1', target: 'ch-1', channelType: 'EMAIL', isActive: true },
        ],
        workspace: {
          subscription: {
            plan: { supportsTelegram: false, supportsDiscord: false },
          },
        },
      }
      const mockChannel = {
        id: 'ch-1',
        type: 'EMAIL',
        isActive: true,
        config: { address: 'admin@example.com' },
      }

      vi.mocked(prisma.monitor.findUnique).mockResolvedValue(mockMonitor as any)
      vi.mocked(prisma.notificationChannel.findMany).mockResolvedValue([mockChannel] as any)
      vi.mocked(sendEmail).mockResolvedValue(true)

      await alertService.notifyMonitorStatusChanged({
        monitorId: 'mon-1',
        prevStatus: 'UP',
        newStatus: 'DOWN',
        target: 'https://example.com',
      })

      expect(sendEmail).toHaveBeenCalled()
    })

    it('should send alert when monitor goes UP (resolved)', async () => {
      const mockMonitor = {
        id: 'mon-1',
        name: 'Test Monitor',
        notificationConfigs: [
          { id: 'nc-1', target: 'ch-1', channelType: 'EMAIL', isActive: true },
        ],
        workspace: {
          subscription: {
            plan: { supportsTelegram: false, supportsDiscord: false },
          },
        },
      }
      const mockChannel = {
        id: 'ch-1',
        type: 'EMAIL',
        isActive: true,
        config: { address: 'admin@example.com' },
      }

      vi.mocked(prisma.monitor.findUnique).mockResolvedValue(mockMonitor as any)
      vi.mocked(prisma.notificationChannel.findMany).mockResolvedValue([mockChannel] as any)
      vi.mocked(sendEmail).mockResolvedValue(true)

      await alertService.notifyMonitorStatusChanged({
        monitorId: 'mon-1',
        prevStatus: 'DOWN',
        newStatus: 'UP',
        target: 'https://example.com',
      })

      expect(sendEmail).toHaveBeenCalled()
    })

    it('should send alert when SSL expiry WARNING', async () => {
      const mockMonitor = {
        id: 'mon-1',
        name: 'Test Monitor',
        notificationConfigs: [
          { id: 'nc-1', target: 'ch-1', channelType: 'EMAIL', isActive: true },
        ],
        workspace: {
          subscription: {
            plan: { supportsTelegram: false, supportsDiscord: false },
          },
        },
      }
      const mockChannel = {
        id: 'ch-1',
        type: 'EMAIL',
        isActive: true,
        config: { address: 'admin@example.com' },
      }

      vi.mocked(prisma.monitor.findUnique).mockResolvedValue(mockMonitor as any)
      vi.mocked(prisma.notificationChannel.findMany).mockResolvedValue([mockChannel] as any)
      vi.mocked(sendEmail).mockResolvedValue(true)

      await alertService.notifyMonitorStatusChanged({
        monitorId: 'mon-1',
        prevStatus: 'UP',
        newStatus: 'WARNING',
        target: 'https://example.com',
        daysUntilExpiry: 5,
      })

      expect(sendEmail).toHaveBeenCalled()
    })

    it('should not send alert if no notification configs', async () => {
      const mockMonitor = {
        id: 'mon-1',
        name: 'Test Monitor',
        notificationConfigs: [],
        workspace: {
          subscription: {
            plan: { supportsTelegram: false, supportsDiscord: false },
          },
        },
      }

      vi.mocked(prisma.monitor.findUnique).mockResolvedValue(mockMonitor as any)
      vi.mocked(prisma.notificationChannel.findMany).mockResolvedValue([])

      await alertService.notifyMonitorStatusChanged({
        monitorId: 'mon-1',
        prevStatus: 'UP',
        newStatus: 'DOWN',
        target: 'https://example.com',
      })

      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('should skip if monitor not found', async () => {
      vi.mocked(prisma.monitor.findUnique).mockResolvedValue(null)

      await alertService.notifyMonitorStatusChanged({
        monitorId: 'mon-1',
        prevStatus: 'UP',
        newStatus: 'DOWN',
        target: 'https://example.com',
      })

      expect(sendEmail).not.toHaveBeenCalled()
    })
  })
})
