import { describe, it, expect, vi, beforeEach } from 'vitest'
import { monitorService } from '@/modules/monitor/monitor.service'
import { monitorRepository } from '@/modules/monitor/monitor.repository'
import { httpRequest } from '@/shared/utils/http-client'
import { getSSLExpiry } from '@/modules/monitor/ssl-checker.service'
import { getDomainExpiry } from '@/modules/monitor/domain-checker.service'
import { eventBus, EVENTS } from '@/shared/kernel/event-bus'

vi.mock('@/modules/monitor/monitor.repository', () => ({
  monitorRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findManyByWorkspace: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    markChecked: vi.fn(),
    createCheck: vi.fn(),
    getRecentChecks: vi.fn(),
    getUptimeStats: vi.fn(),
    findDueForCheck: vi.fn(),
  },
}))

vi.mock('@/shared/utils/http-client', () => ({
  httpRequest: vi.fn(),
}))

vi.mock('@/modules/monitor/ssl-checker.service', () => ({
  getSSLExpiry: vi.fn(),
}))

vi.mock('@/modules/monitor/domain-checker.service', () => ({
  getDomainExpiry: vi.fn(),
}))

vi.mock('@/shared/kernel/event-bus', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
  },
  EVENTS: {
    MONITOR_STATUS_CHANGED: 'monitor.status_changed',
    MONITOR_CHECK_COMPLETED: 'monitor.check_completed',
    INCIDENT_STARTED: 'incident.started',
    INCIDENT_RESOLVED: 'incident.resolved',
  },
}))

vi.mock('@/shared/db/prisma', () => ({
  prisma: {
    incident: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/shared/db/prisma'

describe('MonitorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkUptime', () => {
    it('should mark UP when HTTP 200 and emit check completed', async () => {
      vi.mocked(httpRequest).mockResolvedValue({
        success: true,
        status: 200,
        responseTimeMs: 120,
        data: 'OK',
      })

      const result = await monitorService.checkUptime({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'UNKNOWN',
      })

      expect(result.status).toBe('UP')
      expect(result.responseTimeMs).toBe(120)
      expect(monitorRepository.createCheck).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'UP', statusCode: 200 })
      )
      expect(monitorRepository.markChecked).toHaveBeenCalledWith('mon-1', 'UP')
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTS.MONITOR_CHECK_COMPLETED,
        expect.objectContaining({ monitorId: 'mon-1', status: 'UP' })
      )
    })

    it('should mark DOWN when HTTP 500', async () => {
      vi.mocked(httpRequest).mockResolvedValue({
        success: true,
        status: 500,
        responseTimeMs: 50,
        error: 'HTTP 500',
      })

      const result = await monitorService.checkUptime({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'UNKNOWN',
      })

      expect(result.status).toBe('DOWN')
      expect(monitorRepository.createCheck).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DOWN', statusCode: 500 })
      )
    })

    it('should mark DOWN when connection fails', async () => {
      vi.mocked(httpRequest).mockResolvedValue({
        success: false,
        responseTimeMs: 1000,
        error: 'Connection timeout',
      })

      const result = await monitorService.checkUptime({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'UNKNOWN',
      })

      expect(result.status).toBe('DOWN')
    })

    it('should open incident and emit status changed when UP → DOWN', async () => {
      vi.mocked(httpRequest).mockResolvedValue({
        success: false,
        responseTimeMs: 1000,
        error: 'Connection timeout',
      })
      vi.mocked(prisma.incident.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.incident.create).mockResolvedValue({ id: 'inc-1' } as any)

      await monitorService.checkUptime({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'UP',
      })

      expect(prisma.incident.create).toHaveBeenCalled()
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTS.MONITOR_STATUS_CHANGED,
        expect.objectContaining({
          monitorId: 'mon-1',
          prevStatus: 'UP',
          newStatus: 'DOWN',
        })
      )
    })

    it('should resolve incident and emit status changed when DOWN → UP', async () => {
      vi.mocked(httpRequest).mockResolvedValue({
        success: true,
        status: 200,
        responseTimeMs: 100,
      })
      const now = new Date()
      vi.mocked(prisma.incident.findFirst).mockResolvedValue({
        id: 'inc-1',
        startedAt: new Date(now.getTime() - 60 * 60 * 1000),
      } as any)
      vi.mocked(prisma.incident.update).mockResolvedValue({ id: 'inc-1' } as any)

      await monitorService.checkUptime({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'DOWN',
      })

      expect(prisma.incident.update).toHaveBeenCalled()
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTS.MONITOR_STATUS_CHANGED,
        expect.objectContaining({
          monitorId: 'mon-1',
          prevStatus: 'DOWN',
          newStatus: 'UP',
        })
      )
    })

    it('should not emit status changed when status unchanged', async () => {
      vi.mocked(httpRequest).mockResolvedValue({
        success: true,
        status: 200,
        responseTimeMs: 100,
      })

      await monitorService.checkUptime({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'UP',
      })

      expect(eventBus.emit).not.toHaveBeenCalledWith(
        EVENTS.MONITOR_STATUS_CHANGED,
        expect.anything()
      )
    })
  })

  describe('checkSSL', () => {
    it('should mark UP when SSL expiry > 7 days', async () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      vi.mocked(getSSLExpiry).mockResolvedValue({
        hostname: 'example.com',
        validFrom: new Date(),
        validTo: future,
        issuer: 'Test CA',
        subject: 'example.com',
      })

      const result = await monitorService.checkSSL({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'UP',
      })

      expect(result.status).toBe('UP')
      expect(monitorRepository.createCheck).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'UP' })
      )
    })

    it('should mark WARNING when SSL expires <= 7 days', async () => {
      const nearFuture = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      vi.mocked(getSSLExpiry).mockResolvedValue({
        hostname: 'example.com',
        validFrom: new Date(),
        validTo: nearFuture,
        issuer: 'Test CA',
        subject: 'example.com',
      })

      const result = await monitorService.checkSSL({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'UP',
      })

      expect(result.status).toBe('WARNING')
      expect(result.daysUntilExpiry).toBeLessThanOrEqual(5)
      expect(result.daysUntilExpiry).toBeGreaterThanOrEqual(4)
      expect(eventBus.emit).toHaveBeenCalledWith(
        EVENTS.MONITOR_STATUS_CHANGED,
        expect.anything()
      )
    })

    it('should mark UNKNOWN when SSL info not retrieved', async () => {
      vi.mocked(getSSLExpiry).mockResolvedValue(null)

      const result = await monitorService.checkSSL({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'UP',
      })

      expect(result.status).toBe('UNKNOWN')
    })

    it('should mark DOWN on SSL check error', async () => {
      vi.mocked(getSSLExpiry).mockRejectedValue(new Error('Connection refused'))

      const result = await monitorService.checkSSL({
        id: 'mon-1',
        target: 'https://example.com',
        lastStatus: 'UP',
      })

      expect(result.status).toBe('DOWN')
      expect(monitorRepository.createCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          errorMessage: 'Connection refused',
        })
      )
    })
  })

  describe('checkDomain', () => {
    it('should mark UP when domain expires > 30 days', async () => {
      const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      vi.mocked(getDomainExpiry).mockResolvedValue({
        domain: 'example.com',
        expiryDate: future,
      })

      const result = await monitorService.checkDomain({
        id: 'mon-1',
        target: 'example.com',
        lastStatus: 'UP',
      })

      expect(result.status).toBe('UP')
    })

    it('should mark WARNING when domain expires <= 30 days', async () => {
      const nearFuture = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
      vi.mocked(getDomainExpiry).mockResolvedValue({
        domain: 'example.com',
        expiryDate: nearFuture,
      })

      const result = await monitorService.checkDomain({
        id: 'mon-1',
        target: 'example.com',
        lastStatus: 'UP',
      })

      expect(result.status).toBe('WARNING')
      expect(result.daysUntilExpiry).toBe(20)
    })

    it('should mark UNKNOWN when WHOIS info not retrieved', async () => {
      vi.mocked(getDomainExpiry).mockResolvedValue({ domain: 'example.com', expiryDate: null })

      const result = await monitorService.checkDomain({
        id: 'mon-1',
        target: 'example.com',
        lastStatus: 'UP',
      })

      expect(result.status).toBe('UNKNOWN')
    })
  })
})
