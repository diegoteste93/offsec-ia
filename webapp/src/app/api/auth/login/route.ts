import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createSession, ensureAdminExists, verifyPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
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
    console.error('Login failed:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
