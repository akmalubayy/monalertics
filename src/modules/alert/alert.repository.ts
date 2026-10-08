import { prisma } from '@/shared/db/prisma'
import { CreateNotificationConfigInput, NotificationChannelType } from './alert.types'

export class AlertRepository {
  async createNotificationConfig(data: CreateNotificationConfigInput) {
    return prisma.notificationConfig.create({ data: data as never })
  }

  async findConfigsByMonitor(monitorId: string) {
    return prisma.notificationConfig.findMany({
      where: { monitorId, isActive: true },
    })
  }

  async deleteNotificationConfig(id: string) {
    return prisma.notificationConfig.delete({ where: { id } })
  }

  // ---- Workspace channels (Phase 1) ----

  async createChannel(workspaceId: string, data: {
    type: NotificationChannelType
    name: string
    config: Record<string, unknown>
  }) {
    return prisma.notificationChannel.create({
      data: { workspaceId, type: data.type as never, name: data.name, config: data.config as never },
    })
  }

  async findChannelsByWorkspace(workspaceId: string) {
    return prisma.notificationChannel.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findChannelById(id: string) {
    return prisma.notificationChannel.findUnique({ where: { id } })
  }

  async deleteChannel(id: string) {
    return prisma.notificationChannel.delete({ where: { id } })
  }

  async markVerified(id: string) {
    return prisma.notificationChannel.update({
      where: { id },
      data: { isVerified: true },
    })
  }

  async createAlert(data: {
    incidentId?: string | null
    userId?: string | null
    channelType: NotificationChannelType
    recipient: string
    content: string
  }) {
    return prisma.alert.create({
      data: {
        incidentId: data.incidentId ?? null,
        userId: data.userId ?? null,
        channelType: data.channelType as never,
        recipient: data.recipient,
        content: data.content,
      },
    })
  }

  async updateAlertStatus(id: string, status: string, error?: string) {
    return prisma.alert.update({
      where: { id },
      data: { status: status as never, sentAt: status === 'SENT' ? new Date() : null, error },
    })
  }

  async getAlertsByIncident(incidentId: string) {
    return prisma.alert.findMany({ where: { incidentId }, orderBy: { createdAt: 'desc' } })
  }

  async getRecentAlertsByWorkspace(workspaceId: string, limit = 20) {
    return prisma.alert.findMany({
      where: {
        incident: {
          monitor: { workspaceId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        incident: {
          include: {
            monitor: { select: { name: true, target: true } },
          },
        },
      },
    })
  }
}

export const alertRepository = new AlertRepository()
