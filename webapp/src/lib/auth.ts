import { cookies } from 'next/headers'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import prisma from '@/lib/prisma'

const SESSION_COOKIE = 'redamon_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 // 24h
const ADMIN_EMAIL = 'admin@local'
const ADMIN_NAME = 'Administrator'
const ADMIN_DEFAULT_PASSWORD = 'Mudar123@'

function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || randomBytes(16).toString('hex')
  const hash = scryptSync(password, actualSalt, 64).toString('hex')
  return `${actualSalt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(':')
  if (!salt || !originalHash) return false
  const hashBuffer = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'hex')
  const originalBuffer = Buffer.from(originalHash, 'hex')
  if (hashBuffer.length !== originalBuffer.length) return false
  return timingSafeEqual(hashBuffer, originalBuffer)
}

export async function ensureAdminExists() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (admin) return admin

  return prisma.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash: hashPassword(ADMIN_DEFAULT_PASSWORD),
      role: 'ADMIN'
    }
  })
}

export async function createSession(userId: string) {
  const token = randomBytes(48).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await prisma.user.update({
    where: { id: userId },
    data: {
      sessionToken: token,
      sessionExpiresAt: expiresAt
    }
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt
  })
}

export async function clearSession(token?: string) {
  const cookieStore = await cookies()
  const currentToken = token || cookieStore.get(SESSION_COOKIE)?.value

  if (currentToken) {
    await prisma.user.updateMany({
      where: { sessionToken: currentToken },
      data: { sessionToken: null, sessionExpiresAt: null }
    })
  }

  cookieStore.delete(SESSION_COOKIE)
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const user = await prisma.user.findFirst({
    where: {
      sessionToken: token,
      sessionExpiresAt: { gt: new Date() }
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  })

  if (!user) {
    cookieStore.delete(SESSION_COOKIE)
    return null
  }

  return user
}

export { hashPassword, verifyPassword, SESSION_COOKIE }
