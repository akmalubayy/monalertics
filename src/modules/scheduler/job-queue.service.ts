import { prisma } from '@/shared/db/prisma'
import { JobType, JobStatus } from '@prisma/client'

export class JobQueueService {
  async enqueue(type: JobType, payload: Record<string, unknown>, scheduledAt?: Date) {
    return prisma.job.create({
      data: {
        type,
        payload: payload as never,
        scheduledAt: scheduledAt ?? new Date(),
      },
    })
  }

  async claimDueJobs(limit = 20) {
    // Claim jobs atomik: ambil jobs PENDING yang scheduled_at <= now
    const now = new Date()
    const jobs = await prisma.job.findMany({
      where: {
        status: JobStatus.PENDING,
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    })

    const claimed: typeof jobs = []
    for (const job of jobs) {
      const updated = await prisma.job.updateMany({
        where: { id: job.id, status: JobStatus.PENDING },
        data: { status: JobStatus.PROCESSING, startedAt: new Date() },
      })
      if (updated.count > 0) claimed.push(job)
    }
    return claimed
  }

  async complete(jobId: string) {
    return prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.COMPLETED, completedAt: new Date() },
    })
  }

  async fail(jobId: string, error: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) return

    const attempts = job.attempts + 1
    if (attempts >= job.maxAttempts) {
      return prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          error,
          attempts,
        },
      })
    }
    // Retry dengan backoff eksponensial
    const backoffSeconds = Math.pow(2, attempts) * 60
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PENDING,
        attempts,
        error,
        scheduledAt: new Date(Date.now() + backoffSeconds * 1000),
      },
    })
  }

  async cleanupOldJobs(retentionDays = 30) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    return prisma.job.deleteMany({
      where: {
        status: { in: [JobStatus.COMPLETED, JobStatus.FAILED] },
        completedAt: { lt: cutoff },
      },
    })
  }
}

export const jobQueue = new JobQueueService()
