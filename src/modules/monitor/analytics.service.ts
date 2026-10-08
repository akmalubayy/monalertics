import { prisma } from '@/shared/db/prisma'

export interface AnalyticsBucket {
  label: string
  avgResponseMs: number
  checks: number
  up: number
  down: number
}

export interface WorkspaceAnalytics {
  uptimePercent: number
  totalChecks: number
  upChecks: number
  downChecks: number
  avgResponseMs: number
  totalIncidents: number
  openIncidents: number
  series: AnalyticsBucket[]
}

/**
 * Analytics untuk seluruh workspace (tenant).
 * @param workspaceId ID workspace
 * @param hours Rentang waktu ke belakang (jam), default 24
 */
export async function getWorkspaceAnalytics(
  workspaceId: string,
  hours = 24
): Promise<WorkspaceAnalytics> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const monitors = await prisma.monitor.findMany({
    where: { workspaceId },
    select: { id: true },
  })
  const monitorIds = monitors.map((m) => m.id)

  if (monitorIds.length === 0) {
    return {
      uptimePercent: 0,
      totalChecks: 0,
      upChecks: 0,
      downChecks: 0,
      avgResponseMs: 0,
      totalIncidents: 0,
      openIncidents: 0,
      series: [],
    }
  }

  const checks = await prisma.monitorCheck.findMany({
    where: { monitorId: { in: monitorIds }, checkedAt: { gte: since } },
    orderBy: { checkedAt: 'asc' },
    select: { status: true, responseTimeMs: true, checkedAt: true },
  })

  const totalChecks = checks.length
  const upChecks = checks.filter((c) => c.status === 'UP').length
  const downChecks = checks.filter((c) => c.status === 'DOWN').length
  const responseSum = checks.reduce((sum, c) => sum + (c.responseTimeMs ?? 0), 0)
  const avgResponseMs = totalChecks > 0 ? Math.round(responseSum / totalChecks) : 0
  const uptimePercent = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0

  // Bucket per jam
  const buckets = new Map<string, { sum: number; count: number; up: number; down: number; date: Date }>()
  for (const c of checks) {
    const d = new Date(c.checkedAt)
    d.setMinutes(0, 0, 0)
    const key = d.toISOString()
    const b = buckets.get(key) ?? { sum: 0, count: 0, up: 0, down: 0, date: d }
    b.sum += c.responseTimeMs ?? 0
    b.count += 1
    if (c.status === 'UP') b.up += 1
    if (c.status === 'DOWN') b.down += 1
    buckets.set(key, b)
  }

  const series: AnalyticsBucket[] = Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((b) => ({
      label: `${String(b.date.getHours()).padStart(2, '0')}:00`,
      avgResponseMs: b.count > 0 ? Math.round(b.sum / b.count) : 0,
      checks: b.count,
      up: b.up,
      down: b.down,
    }))

  const totalIncidents = await prisma.incident.count({
    where: { monitorId: { in: monitorIds }, startedAt: { gte: since } },
  })
  const openIncidents = await prisma.incident.count({
    where: { monitorId: { in: monitorIds }, resolvedAt: null },
  })

  return {
    uptimePercent: Math.round(uptimePercent * 100) / 100,
    totalChecks,
    upChecks,
    downChecks,
    avgResponseMs,
    totalIncidents,
    openIncidents,
    series,
  }
}

export const analyticsService = { getWorkspaceAnalytics }
