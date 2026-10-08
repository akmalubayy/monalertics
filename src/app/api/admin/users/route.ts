import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/modules/auth/auth.middleware'
import { prisma } from '@/shared/db/prisma'
import { logger } from '@/shared/utils/logger'
import bcrypt from 'bcryptjs'

/**
 * GET /api/admin/users
 * List all users with their workspaces and plans.
 * Admin only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth) return forbiddenResponse()

  try {
    // Get all users with memberships, workspaces, and subscriptions
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            workspace: {
              select: {
                id: true,
                name: true,
                subscription: {
                  select: {
                    id: true,
                    plan: {
                      select: {
                        id: true,
                        name: true,
                        displayName: true,
                        priceMonthly: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      ok: true,
      users: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        workspaces: u.memberships.map((m: any) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          role: m.role,
          plan: m.workspace.subscription?.plan || null,
        })),
      })),
    })
  } catch (err) {
    logger.error('Admin: Failed to list users', err)
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
  }
}

/**
 * POST /api/admin/users
 * Create new user
 * Admin only.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth) return forbiddenResponse()

  try {
    const body = await req.json()
    const { email, name, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password diperlukan' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        passwordHash,
        role: 'USER',
      },
    })

    logger.info(`Admin created user: ${user.email}`)

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    }, { status: 201 })
  } catch (err) {
    logger.error('Admin: Failed to create user', err)
    return NextResponse.json({ error: 'Gagal membuat user' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/users/{userId}
 * Update user (name, role)
 * Admin only.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth) return forbiddenResponse()

  try {
    const url = new URL(req.url)
    const userId = url.pathname.split('/').pop()
    const body = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID diperlukan' }, { status: 400 })
    }

    const { name, role } = body

    // Validate role
    if (role && !['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }

    // Update user
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
      },
    })

    logger.info(`Admin updated user: ${userId}`)

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        createdAt: updated.createdAt,
      },
    })
  } catch (err) {
    logger.error('Admin: Failed to update user', err)
    return NextResponse.json({ error: 'Gagal update user' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/{userId}
 * Delete user
 * Admin only.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth) return forbiddenResponse()

  try {
    const url = new URL(req.url)
    const userId = url.pathname.split('/').pop()

    if (!userId) {
      return NextResponse.json({ error: 'User ID diperlukan' }, { status: 400 })
    }

    // Prevent self-deletion
    if (userId === auth.userId) {
      return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 })
    }

    // Delete user (cascade: memberships, monitors, checks, etc)
    await prisma.user.delete({
      where: { id: userId },
    })

    logger.info(`Admin deleted user: ${userId}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('Admin: Failed to delete user', err)
    return NextResponse.json({ error: 'Gagal menghapus user' }, { status: 500 })
  }
}
