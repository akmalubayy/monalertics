import { prisma } from '@/shared/db/prisma'
import { monitorRepository } from './monitor.repository'
import { CreateMonitorInput, UpdateMonitorInput } from './monitor.types'
import { httpRequest } from '@/shared/utils/http-client'
import { eventBus, EVENTS } from '@/shared/kernel/event-bus'
import { logger } from '@/shared/utils/logger'
// side-effect import — register alert handler for MONITOR_STATUS_CHANGED
import '@/modules/alert/alert.service'
import { getSSLExpiry } from './ssl-checker.service'
import { getDomainExpiry } from './domain-checker.service'

/**
 * Normalisasi target untuk keperluan HTTP/SSL check.
 * - Bila target sudah mengandung protokol (http://, https://), kembalikan apa adanya
 * - Bila target adalah hostname polos (mis. "google.com"), tambahkan https://
 * - Bila target adalah path/host tanpa protokol, tambahkan https://
 */
function ensureProtocol(target: string, defaultProtocol: 'http' | 'https' = 'https'): string {
  const trimmed = target.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `${defaultProtocol}://${trimmed}`
}

/**
 * Normalisasi target untuk keperluan domain/WHOIS check.
 * - Buang protokol (http://, https://)
 * - Buang path setelah domain
 * - Buang port
 * - Kembalikan hostname polos (mis. "google.com")
 */
function ensureHostname(target: string): string {
  return target
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .trim()
    .toLowerCase()
}


export class MonitorService {
  async create(workspaceId: string, data: CreateMonitorInput) {
    return monitorRepository.create(workspaceId, data)
  }

  async findById(id: string) {
    return monitorRepository.findById(id)
  }

  async findManyByWorkspace(workspaceId: string) {
    return monitorRepository.findManyByWorkspace(workspaceId)
  }

  async update(id: string, data: UpdateMonitorInput) {
    return monitorRepository.update(id, data)
  }

  async delete(id: string) {
    return monitorRepository.delete(id)
  }

  async checkUptime(monitor: { id: string; target: string; lastStatus: string }) {
    // Tambah https:// otomatis bila target belum memiliki protokol
    const checkTarget = ensureProtocol(monitor.target)
    const result = await httpRequest(checkTarget, { timeoutMs: 15000 })
    const isUp =
      result.success && result.status !== undefined && result.status >= 200 && result.status < 400
    const status = isUp ? 'UP' : 'DOWN'
    const prevStatus = monitor.lastStatus
    const statusChanged = prevStatus !== status && prevStatus !== 'UNKNOWN'

    // Save check
    await monitorRepository.createCheck({
      monitorId: monitor.id,
      status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.status,
      errorMessage: result.error,
    })

    await monitorRepository.markChecked(monitor.id, status)

    // Handle incident (new DOWN or resolved)
    if (statusChanged) {
      if (status === 'DOWN') {
        await this.openIncident(monitor.id, result.error || `HTTP ${result.status}`)
      } else if (status === 'UP') {
        await this.resolveIncident(monitor.id)
      }
    }

    // Emit event untuk notifikasi: status changed ATAU monitor baru first check jadi DOWN
    const isFirstCheckDown = prevStatus === 'UNKNOWN' && status === 'DOWN'
    if (statusChanged || isFirstCheckDown) {
      await eventBus.emit(EVENTS.MONITOR_STATUS_CHANGED, {
        monitorId: monitor.id,
        prevStatus,
        newStatus: status,
        target: checkTarget,
      })
    }

    await eventBus.emit(EVENTS.MONITOR_CHECK_COMPLETED, {
      monitorId: monitor.id,
      status,
      responseTimeMs: result.responseTimeMs,
    })

    logger.info(`Uptime check: ${checkTarget} → ${status} (${result.responseTimeMs}ms)`)
    return { status, responseTimeMs: result.responseTimeMs }
  }

  async checkSSL(monitor: { id: string; target: string; lastStatus: string }) {
    // Tambah https:// otomatis bila target belum memiliki protokol
    const checkTarget = ensureProtocol(monitor.target, 'https')
    try {
      const info = await getSSLExpiry(checkTarget)
      if (!info) {
        await monitorRepository.createCheck({
          monitorId: monitor.id,
          status: 'UNKNOWN',
          errorMessage: 'Failed to retrieve SSL info',
        })
        return { status: 'UNKNOWN' as const }
      }

      const daysUntilExpiry = Math.floor(
        (info.validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      const status = daysUntilExpiry <= 7 ? 'WARNING' : 'UP'

      // Simpan info SSL ke settings monitor & catatan check
      const sslSummary = `SSL valid s/d ${info.validTo.toISOString().slice(0, 10)} (${daysUntilExpiry} hari lagi, Issuer: ${info.issuer})`

      const existingSettings = (
        typeof monitor === 'object' && monitor !== null && 'settings' in monitor
          ? (monitor as { settings?: Record<string, unknown> }).settings ?? {}
          : {}
      ) as Record<string, unknown>

      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          settings: {
            ...existingSettings,
            ssl: {
              validFrom: info.validFrom.toISOString(),
              validTo: info.validTo.toISOString(),
              issuer: info.issuer,
              subject: info.subject,
              daysUntilExpiry,
            },
          },
        },
      })

      await monitorRepository.createCheck({
        monitorId: monitor.id,
        status,
        errorMessage: sslSummary,
      })
      await monitorRepository.markChecked(monitor.id, status)

      if (status === 'WARNING') {
        await eventBus.emit(EVENTS.MONITOR_STATUS_CHANGED, {
          monitorId: monitor.id,
          prevStatus: monitor.lastStatus,
          newStatus: status,
          target: checkTarget,
          daysUntilExpiry,
        })
      }

      logger.info(`SSL check: ${checkTarget} → ${status} (expires in ${daysUntilExpiry}d)`)
      return { status, daysUntilExpiry }
    } catch (err) {
      logger.error(`SSL check failed: ${checkTarget}`, err)
      await monitorRepository.createCheck({
        monitorId: monitor.id,
        status: 'DOWN',
        errorMessage: err instanceof Error ? err.message : 'SSL check failed',
      })
      return { status: 'DOWN' as const }
    }
  }

  async checkDomain(monitor: { id: string; target: string; lastStatus: string }) {
    // Domain check pakai hostname saja — buang protokol, path, port bila ada
    const checkTarget = ensureHostname(monitor.target)
    try {
      const info = await getDomainExpiry(checkTarget)
      if (!info?.expiryDate) {
        await monitorRepository.createCheck({
          monitorId: monitor.id,
          status: 'UNKNOWN',
          errorMessage: 'Failed to retrieve WHOIS info',
        })
        return { status: 'UNKNOWN' as const }
      }

      const daysUntilExpiry = Math.floor(
        (info.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      const status = daysUntilExpiry <= 30 ? 'WARNING' : 'UP'

      // Simpan info domain ke settings monitor & catatan check
      const domainSummary = `Domain expires ${info.expiryDate.toISOString().slice(0, 10)} (${daysUntilExpiry} hari lagi${info.registrar ? `, Registrar: ${info.registrar}` : ''})`

      const existingSettings = (
        typeof monitor === 'object' && monitor !== null && 'settings' in monitor
          ? (monitor as { settings?: Record<string, unknown> }).settings ?? {}
          : {}
      ) as Record<string, unknown>

      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          settings: {
            ...existingSettings,
            domain: {
              expiryDate: info.expiryDate.toISOString(),
              registrar: info.registrar,
              daysUntilExpiry,
            },
          },
        },
      })

      await monitorRepository.createCheck({
        monitorId: monitor.id,
        status,
        errorMessage: domainSummary,
      })
      await monitorRepository.markChecked(monitor.id, status)

      if (status === 'WARNING') {
        await eventBus.emit(EVENTS.MONITOR_STATUS_CHANGED, {
          monitorId: monitor.id,
          prevStatus: monitor.lastStatus,
          newStatus: status,
          target: monitor.target,
          daysUntilExpiry,
        })
      }

      logger.info(`Domain check: ${monitor.target} → ${status} (expires in ${daysUntilExpiry}d)`)
      return { status, daysUntilExpiry }
    } catch (err) {
      logger.error(`Domain check failed for ${checkTarget}: ${err instanceof Error ? err.message : err}`);
      // Jika tidak ada WHOIS, beri status UNKNOWN dan catatan khusus
      await monitorRepository.createCheck({
        monitorId: monitor.id,
        status: 'UNKNOWN',
        errorMessage: err instanceof Error ? err.message : 'Domain WHOIS unavailable',
      });
      return { status: 'UNKNOWN' as const };
    }
  }

  private async openIncident(monitorId: string, cause: string) {
    const existing = await prisma.incident.findFirst({
      where: { monitorId, resolvedAt: null },
    })
    if (existing) return existing

    const incident = await prisma.incident.create({
      data: { monitorId, cause, severity: 'CRITICAL' },
    })
    await eventBus.emit(EVENTS.INCIDENT_STARTED, incident)
    return incident
  }

  private async resolveIncident(monitorId: string) {
    const open = await prisma.incident.findFirst({
      where: { monitorId, resolvedAt: null },
    })
    if (!open) return null

    const now = new Date()
    const resolved = await prisma.incident.update({
      where: { id: open.id },
      data: {
        resolvedAt: now,
        durationSeconds: Math.floor((now.getTime() - open.startedAt.getTime()) / 1000),
      },
    })
    await eventBus.emit(EVENTS.INCIDENT_RESOLVED, resolved)
    return resolved
  }
}

export const monitorService = new MonitorService()
