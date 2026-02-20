import { cookies } from 'next/headers'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import prisma from '@/lib/prisma'

const SESSION_COOKIE = 'redamon_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 // 24h
const ADMIN_EMAIL = 'admin@local'
const ADMIN_NAME = 'Administrator'
const ADMIN_DEFAULT_PASSWORD = 'Mudar123@'

let authSchemaChecked = false

function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || randomBytes(16).toString('hex')
  const hash = scryptSync(password, actualSalt, 64).toString('hex')
  return `${actualSalt}:${hash}`
}

function isPasswordHashFormatValid(stored: string | null | undefined): stored is string {
  if (!stored || typeof stored !== 'string') return false
  const [salt, hash] = stored.split(':')
  return Boolean(salt && hash)
}

function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!isPasswordHashFormatValid(stored)) return false

  const [salt, originalHash] = stored.split(':')
  const hashBuffer = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'hex')
  const originalBuffer = Buffer.from(originalHash, 'hex')
  if (hashBuffer.length !== originalBuffer.length) return false
  return timingSafeEqual(hashBuffer, originalBuffer)
}

export async function ensureAuthSchema() {
  if (authSchemaChecked) return

  await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`)

  await prisma.$executeRawUnsafe(`
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "UserRole" DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS "session_token" TEXT,
  ADD COLUMN IF NOT EXISTS "session_expires_at" TIMESTAMP(3);
`)

  await prisma.$executeRawUnsafe(`
UPDATE "users"
SET
  "password_hash" = COALESCE("password_hash", 'LEGACY_INVALID'),
  "role" = COALESCE("role", 'USER'::"UserRole");
`)

  await prisma.$executeRawUnsafe(`
ALTER TABLE "users"
  ALTER COLUMN "password_hash" SET NOT NULL,
  ALTER COLUMN "role" SET NOT NULL,
  ALTER COLUMN "role" SET DEFAULT 'USER';
`)

  await prisma.$executeRawUnsafe(`
CREATE UNIQUE INDEX IF NOT EXISTS "users_session_token_key" ON "users"("session_token");
`)

  authSchemaChecked = true
}

export async function ensureAdminExists() {
  await ensureAuthSchema()
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })

  if (!admin) {
    return prisma.user.create({
      data: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash: hashPassword(ADMIN_DEFAULT_PASSWORD),
        role: 'ADMIN'
      }
    })
  }

  if (!isPasswordHashFormatValid(admin.passwordHash) || admin.role !== 'ADMIN') {
    return prisma.user.update({
      where: { id: admin.id },
      data: {
        name: admin.name || ADMIN_NAME,
        passwordHash: hashPassword(ADMIN_DEFAULT_PASSWORD),
        role: 'ADMIN'
      }
    })
  }

  return admin
}

export async function createSession(userId: string) {
  await ensureAuthSchema()
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
  await ensureAuthSchema()
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
  await ensureAuthSchema()
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

export { hashPassword, verifyPassword, SESSION_COOKIE, isPasswordHashFormatValid }
