import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { monitorService } from '@/modules/monitor/monitor.service'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

/**
 * POST /api/monitors/[id]/check
 * Jalankan pemeriksaan manual segera (uptime/SSL/domain sesuai tipe monitor).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id } = await ctx.params

  const monitor = await prisma.monitor.findUnique({ where: { id } })
  if (!monitor) {
    return NextResponse.json({ error: 'Monitor tidak ditemukan' }, { status: 404 })
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId: auth.userId, workspaceId: monitor.workspaceId },
    },
  })
  if (!membership) return unauthorizedResponse()

  try {
    let result: Record<string, unknown> = {}

    switch (monitor.type) {
      case 'UPTIME':
        result = await monitorService.checkUptime({
          id: monitor.id,
          target: monitor.target,
          lastStatus: monitor.lastStatus,
        })
        break
      case 'SSL':
        result = await monitorService.checkSSL({
          id: monitor.id,
          target: monitor.target,
          lastStatus: monitor.lastStatus,
        })
        break
      case 'DOMAIN':
        result = await monitorService.checkDomain({
          id: monitor.id,
          target: monitor.target,
          lastStatus: monitor.lastStatus,
        })
        break
      default:
        return NextResponse.json({ error: 'Tipe monitor tidak dikenal' }, { status: 400 })
    }

    // Ambil status terbaru
    const updated = await prisma.monitor.findUnique({
      where: { id },
      select: { lastStatus: true, lastCheckedAt: true },
    })

    logger.info(`Manual check: ${monitor.target} (${monitor.type})`)
    return NextResponse.json({ ok: true, result, monitor: updated })
  } catch (err) {
    logger.error('Manual check failed', err)
    return NextResponse.json({ error: 'Gagal menjalankan pemeriksaan' }, { status: 500 })
  }
}
