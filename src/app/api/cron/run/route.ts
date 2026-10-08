import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/shared/config/env'
import { logger } from '@/shared/utils/logger'
import { schedulerService } from '@/modules/scheduler/scheduler.service'
import { jobQueue } from '@/modules/scheduler/job-queue.service'
import { monitorService } from '@/modules/monitor/monitor.service'
import { prisma } from '@/shared/db/prisma'

export const dynamic = 'force-dynamic'

/**
 * Cron endpoint — dipanggil oleh cPanel cron setiap menit.
 * GET /api/cron/run?secret=CRON_SECRET
 *
 * Alur:
 * 1. Schedule jobs untuk monitor yang jatuh tempo.
 * 2. Claim & proses jobs PENDING.
 * 3. Cleanup jobs lama.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const startTime = Date.now()
  const stats = { scheduled: 0, processed: 0, succeeded: 0, failed: 0, cleanedUp: 0 }

  try {
    // 1. Schedule due checks
    stats.scheduled = await schedulerService.scheduleChecks()

    // 2. Process pending jobs
    const jobs = await jobQueue.claimDueJobs(25)
    for (const job of jobs) {
      stats.processed++
      try {
        await processJob(job.id, job.type, job.payload as Record<string, unknown>)
        await jobQueue.complete(job.id)
        stats.succeeded++
      } catch (err) {
        stats.failed++
        const msg = err instanceof Error ? err.message : 'Unknown error'
        await jobQueue.fail(job.id, msg)
        logger.error(`Job ${job.id} (${job.type}) failed: ${msg}`)
      }
    }

    // 3. Cleanup old jobs
    const cleanup = await jobQueue.cleanupOldJobs(30)
    stats.cleanedUp = cleanup.count

    const durationMs = Date.now() - startTime
    logger.info(`Cron run completed in ${durationMs}ms`, stats)

    return NextResponse.json({ ok: true, durationMs, stats })
  } catch (err) {
    logger.error('Cron run failed', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function processJob(
  jobId: string,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  const monitorId = payload.monitorId as string
  if (!monitorId) throw new Error('Missing monitorId in job payload')

  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } })
  if (!monitor) throw new Error(`Monitor ${monitorId} not found`)
  if (!monitor.isActive) return

  switch (type) {
    case 'UPTIME_CHECK':
      await monitorService.checkUptime({
        id: monitor.id,
        target: monitor.target,
        lastStatus: monitor.lastStatus,
      })
      break
    case 'SSL_CHECK':
      await monitorService.checkSSL({
        id: monitor.id,
        target: monitor.target,
        lastStatus: monitor.lastStatus,
      })
      break
    case 'DOMAIN_CHECK':
      await monitorService.checkDomain({
        id: monitor.id,
        target: monitor.target,
        lastStatus: monitor.lastStatus,
      })
      break
    default:
      throw new Error(`Unknown job type: ${type}`)
  }
}