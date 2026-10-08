import { prisma } from '@/shared/db/prisma'
import { JobType, JobStatus } from '@prisma/client'
import { logger } from '@/shared/utils/logger'
import { monitorRepository } from '@/modules/monitor/monitor.repository'

export class SchedulerService {
  /**
   * Dijalankan via cPanel cron → GET /api/cron/run
   * atau via internal timer. Membuat job check untuk monitor yang jatuh tempo.
   */
  async scheduleChecks(): Promise<number> {
    const due = await monitorRepository.findDueForCheck()
    let created = 0

    for (const monitor of due) {
      // Hindari duplikasi: skip jika job PENDING/PROCESSING masih ada
      const existing = await prisma.job.findFirst({
        where: {
          type: this.jobTypeForMonitor(monitor.type),
          status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
          payload: { path: ['monitorId'], equals: monitor.id } as never,
        },
      })
      if (existing) continue

      await prisma.job.create({
        data: {
          type: this.jobTypeForMonitor(monitor.type),
          payload: { monitorId: monitor.id } as never,
          scheduledAt: new Date(),
        },
      })
      created++
    }

    logger.info(`Scheduled ${created} check jobs (due: ${due.length})`)
    return created
  }

  private jobTypeForMonitor(monitorType: string): JobType {
    switch (monitorType) {
      case 'UPTIME':
        return JobType.UPTIME_CHECK
      case 'SSL':
        return JobType.SSL_CHECK
      case 'DOMAIN':
        return JobType.DOMAIN_CHECK
      default:
        return JobType.UPTIME_CHECK
    }
  }
}

export const schedulerService = new SchedulerService()
