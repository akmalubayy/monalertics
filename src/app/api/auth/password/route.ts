import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { authService } from '@/modules/auth/auth.service'
import { updatePasswordSchema } from '@/modules/auth/auth.types'
import { logger } from '@/shared/utils/logger'

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = updatePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    await authService.changePassword(auth.userId, parsed.data)
    return NextResponse.json({ ok: true, message: 'Password berhasil diubah' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengubah password'
    logger.error('Change password failed', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
