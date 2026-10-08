import { prisma } from '@/shared/db/prisma'
import { RegisterInput, LoginInput } from './auth.types'

export class AuthRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          include: {
            workspace: {
              include: { subscription: { include: { plan: true } } },
            },
          },
        },
      },
    })
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            workspace: {
              include: { subscription: { include: { plan: true } } },
            },
          },
        },
      },
    })
  }

  async create(data: RegisterInput & { passwordHash: string }) {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        name: data.name,
      },
    })
  }

  async markEmailVerified(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    })
  }

  async updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })
  }

  async updateName(userId: string, name: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { name },
    })
  }
}

export const authRepository = new AuthRepository()
