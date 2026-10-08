import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { prisma } from '@/shared/db/prisma'

/**
 * GET /api/notification-channels
 * Daftar semua channel milik workspace user (resolved dari token).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  try {
    // Cari workspace pertama milik user
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: auth.userId },
      select: { workspaceId: true },
    })
    if (!membership) {
      return NextResponse.json({ ok: true, channels: [] })
    }

    const channels = await prisma.notificationChannel.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      ok: true,
      channels: channels.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        isActive: c.isActive,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Gagal memuat channels' }, { status: 500 })
  }
}
