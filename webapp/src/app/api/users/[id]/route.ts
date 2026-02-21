import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthenticatedUser, hashPassword } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthenticatedUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        projects: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            targetDomain: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthenticatedUser()
  if (!authUser || authUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { name, email, password, role } = body

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(password && { passwordHash: hashPassword(password) }),
        ...(role && { role })
      }
    })

    return NextResponse.json(user)
  } catch (error: unknown) {
    console.error('Failed to update user:', error)

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthenticatedUser()
  if (!authUser || authUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Failed to delete user:', error)

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
