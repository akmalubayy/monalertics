import { prisma } from '@/shared/db/prisma'
import { Prisma } from '@prisma/client'
import { CreateMonitorInput, UpdateMonitorInput } from './monitor.types'

export class MonitorRepository {
  async create(workspaceId: string, data: CreateMonitorInput) {
    return prisma.monitor.create({
      data: {
        workspaceId,
        name: data.name,
        type: data.type,
        target: data.target,
        intervalSeconds: data.intervalSeconds,
        settings: (data.settings ?? {}) as Prisma.InputJsonValue,
      },
    })
  }

  async findById(id: string) {
    return prisma.monitor.findUnique({
      where: { id },
      include: {
        notificationConfigs: true,
        checks: { orderBy: { checkedAt: 'desc' }, take: 10 },
      },
    })
  }

  async findManyByWorkspace(workspaceId: string) {
    return prisma.monitor.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findDueForCheck(now: Date = new Date()) {
    // Temukan monitor yang sudah jatuh tempo untuk di-check
    // lastCheckedAt + intervalSeconds <= now
    const all = await prisma.monitor.findMany({
      where: { isActive: true },
    })
    return all.filter((m) => {
      if (!m.lastCheckedAt) return true
      const nextCheck = new Date(m.lastCheckedAt.getTime() + m.intervalSeconds * 1000)
      return nextCheck <= now
    })
  }

  async update(id: string, data: UpdateMonitorInput) {
    return prisma.monitor.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type as never }),
        ...(data.target !== undefined && { target: data.target }),
        ...(data.intervalSeconds !== undefined && { intervalSeconds: data.intervalSeconds }),
        ...(data.settings !== undefined && { settings: data.settings as Prisma.InputJsonValue }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
  }

  async delete(id: string) {
    return prisma.monitor.delete({ where: { id } })
  }

  async markChecked(id: string, lastStatus: string) {
    return prisma.monitor.update({
      where: { id },
      data: { lastCheckedAt: new Date(), lastStatus: lastStatus as never },
    })
  }

  async createCheck(data: {
    monitorId: string
    status: string
    responseTimeMs?: number
    statusCode?: number
    errorMessage?: string
    screenshotId?: string
  }) {
    return prisma.monitorCheck.create({
      data: {
        monitorId: data.monitorId,
        status: data.status as never,
        responseTimeMs: data.responseTimeMs,
        statusCode: data.statusCode,
        errorMessage: data.errorMessage,
        screenshotId: data.screenshotId,
      },
    })
  }

  async getRecentChecks(monitorId: string, limit = 50) {
    return prisma.monitorCheck.findMany({
      where: { monitorId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
    })
  }

  async getUptimeStats(monitorId: string, sinceDate: Date) {
    const checks = await prisma.monitorCheck.findMany({
      where: { monitorId, checkedAt: { gte: sinceDate } },
    })

    const total = checks.length
    const up = checks.filter((c) => c.status === 'UP').length
    const avgResponseTime =
      checks.length > 0
        ? checks.reduce((sum, c) => sum + (c.responseTimeMs ?? 0), 0) / checks.length
        : 0

    return {
      total,
      up,
      down: total - up,
      uptimePercent: total > 0 ? (up / total) * 100 : 0,
      avgResponseTimeMs: Math.round(avgResponseTime),
    }
  }
}

export const monitorRepository = new MonitorRepository()
