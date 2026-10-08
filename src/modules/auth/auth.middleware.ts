import { NextRequest, NextResponse } from 'next/server'
import { authService } from './auth.service'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string
    email: string
    role: 'USER' | 'ADMIN'
  }
}

export async function requireAuth(
  req: NextRequest
): Promise<{ userId: string; email: string; role: 'USER' | 'ADMIN' } | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)
  const payload = authService.verifyToken(token)
  if (!payload) {
    return null
  }

  return { userId: payload.userId, email: payload.email, role: payload.role }
}

export async function requireAdmin(
  req: NextRequest
): Promise<{ userId: string; email: string; role: 'ADMIN' } | null> {
  const auth = await requireAuth(req)
  if (!auth || auth.role !== 'ADMIN') {
    return null
  }
  return { userId: auth.userId, email: auth.email, role: 'ADMIN' }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
