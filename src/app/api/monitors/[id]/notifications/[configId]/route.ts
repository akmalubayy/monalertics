import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

async function checkConfigAccess(userId: string, configId: string) {
  const config = await prisma.notificationConfig.findUnique({
    where: { id: configId },
    include: { monitor: { select: { workspaceId: true } } },
  })
  if (!config) return null
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: config.monitor.workspaceId },
    },
  })
  return membership ? config : null
}

/**
 * DELETE /api/monitors/[id]/notifications/[configId]
 * Lepas channel dari monitor.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; configId: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id, configId } = await ctx.params
  const config = await checkConfigAccess(auth.userId, configId)
  if (!config || config.monitorId !== id) {
    return NextResponse.json({ error: 'Notifikasi tidak ditemukan' }, { status: 404 })
  }

  try {
    await prisma.notificationConfig.delete({ where: { id: configId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('Delete notification failed', err)
    return NextResponse.json({ error: 'Gagal melepas channel' }, { status: 500 })
  }
}
