import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { monitorService } from '@/modules/monitor/monitor.service'
import { updateMonitorSchema } from '@/modules/monitor/monitor.types'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

async function checkAccess(userId: string, monitorId: string): Promise<boolean> {
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    select: { workspaceId: true },
  })
  if (!monitor) return false
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: monitor.workspaceId } },
  })
  return !!membership
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const { id } = await ctx.params
  if (!(await checkAccess(auth.userId, id))) return unauthorizedResponse()

  const monitor = await monitorService.findById(id)
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, monitor })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const { id } = await ctx.params
  if (!(await checkAccess(auth.userId, id))) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = updateMonitorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const monitor = await monitorService.update(id, parsed.data)
    return NextResponse.json({ ok: true, monitor })
  } catch (err) {
    logger.error('Update monitor failed', err)
    return NextResponse.json({ error: 'Gagal update monitor' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()
  const { id } = await ctx.params
  if (!(await checkAccess(auth.userId, id))) return unauthorizedResponse()

  try {
    await monitorService.delete(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('Delete monitor failed', err)
    return NextResponse.json({ error: 'Gagal hapus monitor' }, { status: 500 })
  }
}