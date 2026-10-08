import { prisma } from '@/shared/db/prisma'

export interface PlanLimits {
  maxMonitors: number
  minIntervalSeconds: number
  retentionDays: number
  supportsTelegram: boolean
  supportsDiscord: boolean
  maxScreenshots: number
  supportsStatusPage: boolean
}

export class BillingService {
  async getPlanForWorkspace(workspaceId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    })
    return subscription ?? null
  }

  async getLimits(workspaceId: string): Promise<PlanLimits | null> {
    const sub = await this.getPlanForWorkspace(workspaceId)
    if (!sub) return null
    return {
      maxMonitors: sub.plan.maxMonitors,
      minIntervalSeconds: sub.plan.minIntervalSeconds,
      retentionDays: sub.plan.retentionDays,
      supportsTelegram: sub.plan.supportsTelegram,
      supportsDiscord: sub.plan.supportsDiscord,
      maxScreenshots: sub.plan.maxScreenshots,
      supportsStatusPage: sub.plan.supportsStatusPage,
    }
  }

  async canCreateMonitor(workspaceId: string): Promise<{ allowed: boolean; reason?: string }> {
    const limits = await this.getLimits(workspaceId)
    if (!limits) return { allowed: true } // default allow jika tidak ada subscription

    const count = await prisma.monitor.count({ where: { workspaceId } })
    if (count >= limits.maxMonitors) {
      return { allowed: false, reason: `Batas monitor (${limits.maxMonitors}) tercapai` }
    }
    return { allowed: true }
  }

  async listPlans() {
    return prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } })
  }
}

export const billingService = new BillingService()