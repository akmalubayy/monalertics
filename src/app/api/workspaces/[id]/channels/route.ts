import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { createChannelSchema } from '@/modules/alert/alert.types'
import { alertRepository } from '@/modules/alert/alert.repository'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

/**
 * Validasi keanggotaan user pada workspace.
 */
async function requireMembership(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  })
}

/**
 * GET /api/workspaces/[id]/channels
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id: workspaceId } = await ctx.params
  if (!(await requireMembership(auth.userId, workspaceId))) {
    return unauthorizedResponse()
  }

  try {
    const channels = await alertRepository.findChannelsByWorkspace(workspaceId)
    return NextResponse.json({ ok: true, channels })
  } catch (err) {
    logger.error('List channels failed', err)
    return NextResponse.json({ error: 'Gagal mengambil channel' }, { status: 500 })
  }
}

/**
 * POST /api/workspaces/[id]/channels
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id: workspaceId } = await ctx.params
  if (!(await requireMembership(auth.userId, workspaceId))) {
    return unauthorizedResponse()
  }

  try {
    const body = await req.json()
    const parsed = createChannelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Susun config sesuai channel type
    const config: Record<string, unknown> = {}
    if (parsed.data.type === 'EMAIL') {
      config.address = parsed.data.target
    } else if (parsed.data.type === 'TELEGRAM') {
      config.chatId = parsed.data.target
      if (parsed.data.botToken) config.botToken = parsed.data.botToken
    } else if (parsed.data.type === 'DISCORD') {
      config.webhookUrl = parsed.data.target
    }

    const channel = await alertRepository.createChannel(workspaceId, {
      type: parsed.data.type,
      name: parsed.data.name,
      config,
    })

    logger.info(`Channel created: ${channel.type} → ${channel.name}`)
    return NextResponse.json({ ok: true, channel }, { status: 201 })
  } catch (err) {
    logger.error('Create channel failed', err)
    return NextResponse.json({ error: 'Gagal membuat channel' }, { status: 500 })
  }
}