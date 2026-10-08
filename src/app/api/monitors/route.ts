import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { monitorService } from '@/modules/monitor/monitor.service'
import { createMonitorSchema } from '@/modules/monitor/monitor.types'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

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

  const monitors = await monitorService.findManyByWorkspace(workspaceId)
  return NextResponse.json({ ok: true, monitors })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  try {
    const body = await req.json()
    const workspaceId = body.workspaceId
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId wajib' }, { status: 400 })
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: auth.userId, workspaceId } },
    })
    if (!membership) return unauthorizedResponse()

    // Enforce plan quota
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: { include: { plan: true } } },
    })
    const plan = workspace?.subscription?.plan
    if (plan) {
      const count = await prisma.monitor.count({ where: { workspaceId } })
      if (count >= plan.maxMonitors) {
        return NextResponse.json(
          { error: `Batas monitor paket ${plan.displayName} tercapai (${plan.maxMonitors})` },
          { status: 403 }
        )
      }
    }

    const parsed = createMonitorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const monitor = await monitorService.create(workspaceId, parsed.data)
    return NextResponse.json({ ok: true, monitor }, { status: 201 })
  } catch (err) {
    logger.error('Create monitor failed', err)
    return NextResponse.json({ error: 'Gagal membuat monitor' }, { status: 500 })
  }
}