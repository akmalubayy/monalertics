import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { getWorkspaceAnalytics } from '@/modules/monitor/analytics.service'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

/**
 * GET /api/analytics?workspaceId=...&hours=24
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId wajib' }, { status: 400 })
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: auth.userId, workspaceId } },
  })
  if (!membership) return unauthorizedResponse()

  const hoursParam = Number(req.nextUrl.searchParams.get('hours') ?? '24')
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 && hoursParam <= 720 ? hoursParam : 24

  try {
    const analytics = await getWorkspaceAnalytics(workspaceId, hours)
    return NextResponse.json({ ok: true, analytics })
  } catch (err) {
    logger.error('Analytics failed', err)
    return NextResponse.json({ error: 'Gagal memuat analytics' }, { status: 500 })
  }
}
