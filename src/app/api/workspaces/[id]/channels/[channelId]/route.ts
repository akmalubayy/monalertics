import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { alertRepository } from '@/modules/alert/alert.repository'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'
import { z } from 'zod'

/**
 * Validasi keanggotaan user pada workspace.
 */
async function requireMembership(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  })
}

/**
 * PATCH /api/workspaces/[id]/channels/[channelId]
 * Update name + target channel.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; channelId: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id: workspaceId, channelId } = await ctx.params
  if (!(await requireMembership(auth.userId, workspaceId))) {
    return unauthorizedResponse()
  }

  try {
    const body = await req.json()
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      target: z.string().min(1).optional(),
    })
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const channel = await alertRepository.findChannelById(channelId)
    if (!channel || channel.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Channel tidak ditemukan' }, { status: 404 })
    }

    const cfg = (channel.config ?? {}) as Record<string, unknown>
    const config: Record<string, unknown> = { ...cfg }
    if (parsed.data.target) {
      if (channel.type === 'EMAIL') {
        config.address = parsed.data.target
      } else if (channel.type === 'TELEGRAM') {
        config.chatId = parsed.data.target
      } else if (channel.type === 'DISCORD') {
        config.webhookUrl = parsed.data.target
      }
    }

    const updated = await prisma.notificationChannel.update({
      where: { id: channelId },
      data: {
        name: parsed.data.name ?? channel.name,
        config: config as any,
      },
    })

    logger.info(`Channel updated: ${updated.type} → ${updated.name}`)
    return NextResponse.json({ ok: true, channel: updated })
  } catch (err) {
    logger.error('Update channel failed', err)
    return NextResponse.json({ error: 'Gagal update channel' }, { status: 500 })
  }
}

/**
 * DELETE /api/workspaces/[id]/channels/[channelId]
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; channelId: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id: workspaceId, channelId } = await ctx.params
  if (!(await requireMembership(auth.userId, workspaceId))) {
    return unauthorizedResponse()
  }

  try {
    await prisma.notificationChannel.delete({
      where: { id: channelId },
    })
    logger.info(`Channel deleted: ${channelId}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('Delete channel failed', err)
    return NextResponse.json({ error: 'Gagal menghapus channel' }, { status: 500 })
  }
}
