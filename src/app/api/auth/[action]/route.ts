import { NextRequest, NextResponse } from 'next/server'
import { registerSchema, loginSchema } from '@/modules/auth/auth.types'
import { authService } from '@/modules/auth/auth.service'
import { logger } from '@/shared/utils/logger'

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params

  try {
    const body = await req.json()

    if (action === 'register') {
      const parsed = registerSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const user = await authService.register(parsed.data)
      return NextResponse.json({ ok: true, user }, { status: 201 })
    }

    if (action === 'login') {
      const parsed = loginSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const result = await authService.login(parsed.data)
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 404 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error(`Auth ${action} failed`, err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
