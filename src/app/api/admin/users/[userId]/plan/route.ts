import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/modules/auth/auth.middleware'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'
import { z } from 'zod'

const changePlanSchema = z.object({
  planId: z.string().min(1, 'Plan ID diperlukan'),
})

/**
 * PATCH /api/admin/users/[userId]/plan
 * Change workspace plan for a user (first workspace).
 * Body: { planId: string }
 * Admin only.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdmin(req)
  if (!auth) return forbiddenResponse()

  const { userId } = await ctx.params

  try {
    const body = await req.json()
    const parsed = changePlanSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Get user's first workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'User tidak memiliki workspace' },
        { status: 404 }
      )
    }

    // Verify plan exists
    const plan = await prisma.plan.findUnique({
      where: { id: parsed.data.planId },
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Update or create subscription
    const subscription = await prisma.subscription.upsert({
      where: { workspaceId: membership.workspaceId },
      update: { planId: parsed.data.planId, status: 'ACTIVE' },
      create: {
        workspaceId: membership.workspaceId,
        planId: parsed.data.planId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        plan: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    })

    logger.info(`Admin: Changed plan for user ${userId} to ${plan.name}`)

    return NextResponse.json({
      ok: true,
      subscription,
    })
  } catch (err) {
    logger.error('Admin: Failed to change plan', err)
    return NextResponse.json(
      { error: 'Gagal mengubah plan' },
      { status: 500 }
    )
  }
}
