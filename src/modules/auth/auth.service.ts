import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '@/shared/config/env'
import { authRepository } from './auth.repository'
import { RegisterInput, LoginInput } from './auth.types'
import { logger } from '@/shared/utils/logger'

export interface AuthUser {
  id: string
  email: string
  name: string | null
}

export interface AuthTokenPayload {
  userId: string
  email: string
  role: 'USER' | 'ADMIN'
}

export class AuthService {
  private readonly SALT_ROUNDS = 12

  async register(input: RegisterInput) {
    const existing = await authRepository.findByEmail(input.email)
    if (existing) {
      throw new Error('Email sudah terdaftar')
    }

    const passwordHash = await bcrypt.hash(input.password, this.SALT_ROUNDS)
    const user = await authRepository.create({ ...input, passwordHash })

    logger.info(`User registered: ${user.email}`)
    return { id: user.id, email: user.email, name: user.name }
  }

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email)
    if (!user) {
      throw new Error('Email atau password salah')
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash)
    if (!valid) {
      throw new Error('Email atau password salah')
    }

    const token = this.generateToken({ userId: user.id, email: user.email, role: user.role })
    logger.info(`User logged in: ${user.email}`)

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    }
  }

  generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions)
  }

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload
    } catch {
      return null
    }
  }

  async getProfile(userId: string) {
    const user = await authRepository.findById(userId)
    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      memberships: user.memberships.map((m) => ({
        role: m.role,
        workspace: {
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          plan: m.workspace.subscription?.plan ?? null,
        },
      })),
    }
  }

  async updateProfile(userId: string, data: { name: string }) {
    const updated = await authRepository.updateName(userId, data.name)
    return { id: updated.id, email: updated.email, name: updated.name }
  }

  async changePassword(userId: string, data: {
    currentPassword: string
    newPassword: string
  }) {
    const user = await authRepository.findById(userId)
    if (!user) throw new Error('User tidak ditemukan')

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash)
    if (!valid) throw new Error('Password saat ini salah')

    const passwordHash = await bcrypt.hash(data.newPassword, this.SALT_ROUNDS)
    await authRepository.updatePassword(userId, passwordHash)

    logger.info(`Password changed for ${user.email}`)
    return true
  }
}

export const authService = new AuthService()
