import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { createSession, ensureAdminExists, ensureAuthSchema, verifyPassword } from '@/lib/auth'

function getLoginInfraError(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    const msg = error.message || ''

    if (msg.includes('Environment variable not found: DATABASE_URL')) {
      return 'Database is not configured. Set DATABASE_URL and run Prisma migrations.'
    }

    if (msg.includes("Can't reach database server")) {
      return 'Database is unreachable. Verify your local database is running.'
    }

    return 'Database initialization failed. Verify DATABASE_URL and database availability.'
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2021: table does not exist, P2022: column does not exist
    if (error.code === 'P2021' || error.code === 'P2022') {
      return 'Database schema is outdated. Run Prisma migrations before logging in.'
    }
  }

  if (error instanceof Error) {
    const msg = error.message || ''

    if (msg.includes('column') && msg.includes('does not exist')) {
      return 'Database schema is outdated. Run Prisma migrations before logging in.'
    }

    if (msg.includes('relation') && msg.includes('does not exist')) {
      return 'Database schema is outdated. Run Prisma migrations before logging in.'
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    await ensureAuthSchema()
    await ensureAdminExists()
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await createSession(user.id)

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    })
  } catch (error) {
    const infraError = getLoginInfraError(error)
    if (infraError) {
      return NextResponse.json({ error: infraError }, { status: 503 })
    }

    console.error('Login failed:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
