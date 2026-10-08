import { PrismaClient } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Get all active monitors across all workspaces
    const monitors = await prisma.monitor.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        target: true,
        intervalSeconds: true,
        isActive: true,
        lastStatus: true,
        lastCheckedAt: true,
        settings: true,
      },
      orderBy: [{ lastStatus: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({
      ok: true,
      monitors: monitors.map((m) => {
        const settings = m.settings as any
        return {
          id: m.id,
          name: m.name,
          type: m.type,
          target: m.target,
          intervalSeconds: m.intervalSeconds,
          isActive: m.isActive,
          lastStatus: m.lastStatus || 'UNKNOWN',
          lastCheckedAt: m.lastCheckedAt,
          sslExpiry: settings?.ssl?.validTo || null,
          sslIssuer: settings?.ssl?.issuer || null,
          sslSubject: settings?.ssl?.subject || null,
          sslDaysUntilExpiry: settings?.ssl?.daysUntilExpiry ?? null,
          domainExpiry: settings?.domain?.expiryDate || null,
          domainRegistrar: settings?.domain?.registrar || null,
          domainDaysUntilExpiry: settings?.domain?.daysUntilExpiry ?? null,
        }
      }),
    })
  } catch (error) {
    console.error('Error fetching public monitors:', error)
    return NextResponse.json(
      { ok: false, error: 'Gagal memuat monitor' },
      { status: 500 }
    )
  }
}
