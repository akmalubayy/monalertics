import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { monitorService } from '@/modules/monitor/monitor.service'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'

interface CsvRow {
  name: string
  target: string
  uptime: string
  ssl: string
  domain_expiry: string
  interval_minutes: string
}

interface ImportResult {
  total: number
  success: number
  failed: number
  errors: Array<{ row: number; error: string }>
  createdMonitorIds: string[]
}

/**
 * POST /api/monitors/import
 * Import monitors from CSV.
 * CSV format: name,target,uptime,ssl,domain_expiry,interval_minutes
 * uptime/ssl/domain_expiry: true/false (lowercase)
 * interval_minutes: 1, 5, 15, 30, 60
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const workspaceId = formData.get('workspaceId') as string

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId diperlukan' }, { status: 400 })
    }

    // Verify workspace access
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: auth.userId, workspaceId } },
    })
    if (!membership) return unauthorizedResponse()

    // Parse CSV
    const text = await file.text()
    const rows = parseCsv(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV kosong atau format salah' }, { status: 400 })
    }

    const result: ImportResult = {
      total: rows.length,
      success: 0,
      failed: 0,
      errors: [],
      createdMonitorIds: [],
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // row 1 = header

      try {
        // Validasi
        if (!row.name || !row.target) {
          result.failed++
          result.errors.push({ row: rowNumber, error: 'name & target wajib diisi' })
          continue
        }

        const enableUptime = row.uptime?.toLowerCase() === 'true'
        const enableSsl = row.ssl?.toLowerCase() === 'true'
        const enableDomain = row.domain_expiry?.toLowerCase() === 'true'

        if (!enableUptime && !enableSsl && !enableDomain) {
          result.failed++
          result.errors.push({ row: rowNumber, error: 'Minimal 1 tipe monitor harus diaktifkan' })
          continue
        }

        const intervalMinutes = parseInt(row.interval_minutes || '5', 10)
        const intervalSeconds = intervalMinutes * 60

        if (![60, 300, 900, 1800, 3600].includes(intervalSeconds)) {
          result.failed++
          result.errors.push({
            row: rowNumber,
            error: 'interval_minutes harus 1, 5, 15, 30, atau 60',
          })
          continue
        }

        // Buat monitor sesuai tipe yang diaktifkan
        if (enableUptime) {
          const m = await monitorService.create(workspaceId, {
            name: `${row.name} - Uptime`,
            type: 'UPTIME',
            target: row.target,
            intervalSeconds,
            settings: {},
          })
          result.createdMonitorIds.push(m.id)
          result.success++
        }

        if (enableSsl) {
          const m = await monitorService.create(workspaceId, {
            name: `${row.name} - SSL`,
            type: 'SSL',
            target: row.target,
            intervalSeconds,
            settings: {},
          })
          result.createdMonitorIds.push(m.id)
          result.success++
        }

        if (enableDomain) {
          const m = await monitorService.create(workspaceId, {
            name: `${row.name} - Domain`,
            type: 'DOMAIN',
            target: row.target,
            intervalSeconds,
            settings: {},
          })
          result.createdMonitorIds.push(m.id)
          result.success++
        }
      } catch (err) {
        result.failed++
        result.errors.push({
          row: rowNumber,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    logger.info(`CSV import: ${result.success} success, ${result.failed} failed`)

    // Auto-check all newly created monitors
    if (result.createdMonitorIds.length > 0) {
      performAutoChecks(result.createdMonitorIds).catch((err) => {
        logger.error('Auto-check failed after import', err)
      })
    }

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    logger.error('CSV import failed', err)
    return NextResponse.json(
      { error: 'Gagal import CSV' },
      { status: 500 }
    )
  }
}

async function performAutoChecks(monitorIds: string[]) {
  for (const monitorId of monitorIds) {
    try {
      const monitor = await prisma.monitor.findUnique({
        where: { id: monitorId },
      })

      if (!monitor) continue

      // Call appropriate check method from monitorService
      if (monitor.type === 'UPTIME') {
        await monitorService.checkUptime(monitor)
      } else if (monitor.type === 'SSL') {
        await monitorService.checkSSL(monitor)
      } else if (monitor.type === 'DOMAIN') {
        await monitorService.checkDomain(monitor)
      }

      logger.info(`Auto-check completed for monitor ${monitorId}`)
    } catch (err) {
      logger.error(`Auto-check failed for monitor ${monitorId}`, err)
    }
  }
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) return []

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim())
    const row: any = {}
    header.forEach((key, idx) => {
      row[key] = values[idx] || ''
    })
    rows.push(row as CsvRow)
  }

  return rows
}
