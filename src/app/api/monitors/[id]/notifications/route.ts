import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { z } from 'zod'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

const attachSchema = z.object({
  channelId: z.string().uuid(),
})

async function checkMonitorAccess(userId: string, monitorId: string) {
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    select: { workspaceId: true },
  })
  if (!monitor) return null
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: monitor.workspaceId } },
  })
  return membership ? monitor : null
}

/**
 * GET /api/monitors/[id]/notifications
 * Daftar channel yang terpasang ke monitor ini.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id } = await ctx.params
  const access = await checkMonitorAccess(auth.userId, id)
  if (!access) return unauthorizedResponse()

  try {
    const configs = await prisma.notificationConfig.findMany({
      where: { monitorId: id },
    })
    // Ambil detail channel terkait
    const channelIds = configs.map((c) => c.target)
    const channels = await prisma.notificationChannel.findMany({
      where: { id: { in: channelIds } },
    })
    const channelMap = new Map(channels.map((c) => [c.id, c]))

    const attached = configs.map((c) => {
      const ch = channelMap.get(c.target)
      return {
        id: c.id,
        channelId: c.target,
        channelType: c.channelType,
        channelName: ch?.name ?? '(channel dihapus)',
        isActive: c.isActive,
        exists: !!ch,
      }
    })

    return NextResponse.json({ ok: true, notifications: attached })
  } catch (err) {
    logger.error('List monitor notifications failed', err)
    return NextResponse.json({ error: 'Gagal memuat notifikasi' }, { status: 500 })
  }
}

/**
 * POST /api/monitors/[id]/notifications
 * Pasang channel ke monitor.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id } = await ctx.params
  const access = await checkMonitorAccess(auth.userId, id)
  if (!access) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = attachSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Pastikan channel milik workspace yang sama
    const channel = await prisma.notificationChannel.findUnique({
      where: { id: parsed.data.channelId },
    })
    if (!channel || channel.workspaceId !== access.workspaceId) {
      return NextResponse.json({ error: 'Channel tidak ditemukan' }, { status: 404 })
    }

    // Cegah duplikat
    const existing = await prisma.notificationConfig.findFirst({
      where: { monitorId: id, target: channel.id },
    })
    if (existing) {
      return NextResponse.json({ error: 'Channel sudah terpasang' }, { status: 409 })
    }

    const config = await prisma.notificationConfig.create({
      data: {
        monitorId: id,
        channelType: channel.type,
        target: channel.id,
        isActive: true,
      },
    })

    logger.info(`Channel ${channel.name} attached to monitor ${id}`)
    return NextResponse.json({ ok: true, notification: config }, { status: 201 })
  } catch (err) {
    logger.error('Attach notification failed', err)
    return NextResponse.json({ error: 'Gagal memasang channel' }, { status: 500 })
  }
}
