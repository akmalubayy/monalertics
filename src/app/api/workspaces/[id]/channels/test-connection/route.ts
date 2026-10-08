import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { alertRepository } from '@/modules/alert/alert.repository'
import { alertService } from '@/modules/alert/alert.service'
import { prisma } from '@/shared/db/prisma'

/**
 * POST /api/workspaces/[id]/channels/test-connection
 * Body: { channelId: string }
 * Uji koneksi ke channel tanpa mengirim pesan.
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
  const { channelId } = body as { channelId: string }
  if (!channelId) {
    return NextResponse.json({ error: 'channelId diperlukan' }, { status: 400 })
  }

  const channel = await alertRepository.findChannelById(channelId)
  if (!channel || channel.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Channel tidak ditemukan' }, { status: 404 })
  }

  const result = await alertService.testConnection({
    type: channel.type,
    name: channel.name,
    config: channel.config,
  })

  return NextResponse.json({ ok: result.ok, error: result.error })
}
