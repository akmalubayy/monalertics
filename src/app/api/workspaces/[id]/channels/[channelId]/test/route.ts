import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { alertRepository } from '@/modules/alert/alert.repository'
import { alertService } from '@/modules/alert/alert.service'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

/**
 * POST /api/workspaces/[id]/channels/[channelId]/test
 * Kirim pesan uji coba ke channel dan tandai verified jika sukses.
 * Body: { customMessage?: string, customTitle?: string }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; channelId: string }> }
) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const { id: workspaceId, channelId } = await ctx.params

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: auth.userId, workspaceId } },
  })
  if (!membership) return unauthorizedResponse()

  const channel = await alertRepository.findChannelById(channelId)
  if (!channel || channel.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Channel tidak ditemukan' }, { status: 404 })
  }

  try {
    const body = await req.json()
    const customMessage = body.customMessage || undefined
    const customTitle = body.customTitle || undefined

    const result = await alertService.testChannel({
      type: channel.type,
      name: channel.name,
      config: channel.config,
      customMessage,
      customTitle,
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || 'Test gagal' },
        { status: 400 }
      )
    }

    // Tandai verified jika berhasil
    await alertRepository.markVerified(channelId)

    logger.info(`Channel test ok: ${channel.type} → ${channel.name}`)
    return NextResponse.json({ ok: true, message: 'Pesan uji coba berhasil dikirim' })
  } catch (err) {
    logger.error('Test channel failed', err)
    return NextResponse.json({ error: 'Gagal mengirim pesan uji coba' }, { status: 500 })
  }
}
