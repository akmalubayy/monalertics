import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

/**
 * GET /api/billing/plans
 * List all active plans.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        priceMonthly: true,
        maxMonitors: true,
        minIntervalSeconds: true,
        supportsTelegram: true,
        supportsDiscord: true,
      },
    })

    return NextResponse.json({
      ok: true,
      plans,
    })
  } catch (err) {
    logger.error('Failed to list plans', err)
    return NextResponse.json({ error: 'Failed to list plans' }, { status: 500 })
  }
}
