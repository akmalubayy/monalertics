import { describe, it, expect, vi } from 'vitest'
import { getWorkspaceAnalytics } from '@/modules/monitor/analytics.service'

vi.mock('@/shared/db/prisma', () => ({
  prisma: {
    monitor: { findMany: vi.fn() },
    monitorCheck: { findMany: vi.fn() },
    incident: { count: vi.fn() },
  },
}))

import { prisma } from '@/shared/db/prisma'

describe('analyticsService.getWorkspaceAnalytics', () => {
  it('should return zeroed analytics when no monitors', async () => {
    vi.mocked(prisma.monitor.findMany).mockResolvedValue([])
    vi.mocked(prisma.incident.count).mockResolvedValue(0)

    const result = await getWorkspaceAnalytics('ws-1', 24)

    expect(result.totalChecks).toBe(0)
    expect(result.uptimePercent).toBe(0)
    expect(result.series).toEqual([])
    expect(result.openIncidents).toBe(0)
  })

  it('should aggregate checks by hour bucket', async () => {
    const now = Date.now()
    const checks = [
      { status: 'UP', responseTimeMs: 100, checkedAt: new Date(now) },
      { status: 'UP', responseTimeMs: 200, checkedAt: new Date(now + 10 * 60 * 1000) },
      { status: 'DOWN', responseTimeMs: 0, checkedAt: new Date(now + 20 * 60 * 1000) },
    ]

    vi.mocked(prisma.monitor.findMany).mockResolvedValue([{ id: 'mon-1' }] as any)
    vi.mocked(prisma.monitorCheck.findMany).mockResolvedValue(checks as any)
    vi.mocked(prisma.incident.count).mockResolvedValue(1)

    const result = await getWorkspaceAnalytics('ws-1', 24)

    expect(result.totalChecks).toBe(3)
    expect(result.upChecks).toBe(2)
    expect(result.downChecks).toBe(1)
    expect(result.uptimePercent).toBeCloseTo(66.67, 1)
    expect(result.avgResponseMs).toBe(100)
    expect(result.totalIncidents).toBe(1)
    expect(result.series.length).toBe(1) // same hour bucket
    expect(result.series[0].checks).toBe(3)
    expect(result.series[0].up).toBe(2)
    expect(result.series[0].down).toBe(1)
  })

  it('should split checks into different hour buckets', async () => {
    const now = Date.now()
    const checks = [
      { status: 'UP', responseTimeMs: 100, checkedAt: new Date(now - 60 * 60 * 1000) },
      { status: 'UP', responseTimeMs: 200, checkedAt: new Date(now) },
    ]

    vi.mocked(prisma.monitor.findMany).mockResolvedValue([{ id: 'mon-1' }] as any)
    vi.mocked(prisma.monitorCheck.findMany).mockResolvedValue(checks as any)
    vi.mocked(prisma.incident.count).mockResolvedValue(0)

    const result = await getWorkspaceAnalytics('ws-1', 24)

    expect(result.series.length).toBe(2)
    expect(result.series[0].checks).toBe(1)
    expect(result.series[1].checks).toBe(1)
  })

  it('should handle null responseTimeMs gracefully', async () => {
    vi.mocked(prisma.monitor.findMany).mockResolvedValue([{ id: 'mon-1' }] as any)
    vi.mocked(prisma.monitorCheck.findMany).mockResolvedValue([
      { status: 'UP', responseTimeMs: null, checkedAt: new Date() },
    ] as any)
    vi.mocked(prisma.incident.count).mockResolvedValue(0)

    const result = await getWorkspaceAnalytics('ws-1', 24)

    expect(result.avgResponseMs).toBe(0)
    expect(result.totalChecks).toBe(1)
  })

  it('should count open incidents separately from total', async () => {
    vi.mocked(prisma.monitor.findMany).mockResolvedValue([{ id: 'mon-1' }] as any)
    vi.mocked(prisma.monitorCheck.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.incident.count)
      .mockResolvedValueOnce(5) // total
      .mockResolvedValueOnce(2) // open

    const result = await getWorkspaceAnalytics('ws-1', 24)

    expect(result.totalIncidents).toBe(5)
    expect(result.openIncidents).toBe(2)
  })
})