import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { alertRepository } from '@/modules/alert/alert.repository'
import { alertService } from '@/modules/alert/alert.service'
import { prisma } from '@/shared/db/prisma'

/**
 * POST /api/workspaces/[id]/channels/send-message
 * Body: { channelIds: string[], customTitle?: string, customMessage?: string }
 * Kirim pesan uji coba ke beberapa channel sekaligus.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id: workspaceId } = await ctx.params

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: auth.userId, workspaceId } },
  })
  if (!membership) return unauthorizedResponse()

  const body = await req.json()
  const { channelIds, customTitle, customMessage } = body as {
    channelIds: string[]
    customTitle?: string
    customMessage?: string
  }

  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    return NextResponse.json({ error: 'channelIds wajib diisi array' }, { status: 400 })
  }

  const results: Record<string, { ok: boolean; error?: string }> = {}
  for (const id of channelIds) {
    const channel = await alertRepository.findChannelById(id)
    if (!channel || channel.workspaceId !== workspaceId) {
      results[id] = { ok: false, error: 'Channel tidak ditemukan' }
      continue
    }
    const res = await alertService.testChannel({
      type: channel.type,
      name: channel.name,
      config: channel.config,
      customTitle,
      customMessage,
    })
    results[id] = res
  }

  return NextResponse.json({ results })
}
