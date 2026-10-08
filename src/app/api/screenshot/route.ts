import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { screenshotService } from '@/modules/screenshot/screenshot.service'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  try {
    const { monitorId, url } = await req.json()
    if (!monitorId || !url) {
      return NextResponse.json({ error: 'monitorId & url wajib' }, { status: 400 })
    }

    const monitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { workspaceId: true },
    })
    if (!monitor) return NextResponse.json({ error: 'Monitor tidak ditemukan' }, { status: 404 })

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: auth.userId, workspaceId: monitor.workspaceId } },
    })
    if (!membership) return unauthorizedResponse()

    const id = await screenshotService.captureAndStore(monitorId, url)
    if (!id) {
      return NextResponse.json({ error: 'Gagal mengambil screenshot' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, screenshotId: id }, { status: 201 })
  } catch (err) {
    logger.error('Screenshot capture failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const monitorId = req.nextUrl.searchParams.get('monitorId')
  if (!monitorId) return NextResponse.json({ error: 'monitorId wajib' }, { status: 400 })

  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    select: { workspaceId: true },
  })
  if (!monitor) return NextResponse.json({ error: 'Monitor tidak ditemukan' }, { status: 404 })

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: auth.userId, workspaceId: monitor.workspaceId } },
  })
  if (!membership) return unauthorizedResponse()

  const screenshots = await screenshotService.getByMonitor(monitorId)
  return NextResponse.json({ ok: true, screenshots })
}