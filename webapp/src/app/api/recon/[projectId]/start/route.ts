import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const RECON_ORCHESTRATOR_URL = process.env.RECON_ORCHESTRATOR_URL
const WEBAPP_URL = process.env.WEBAPP_URL

interface RouteParams {
  params: Promise<{ projectId: string }>
}

function getOrchestratorBaseUrl() {
  return (RECON_ORCHESTRATOR_URL || 'http://127.0.0.1:8010').replace(/\/$/, '')
}

function getWebappBaseUrl(request: NextRequest) {
  if (WEBAPP_URL) return WEBAPP_URL.replace(/\/$/, '')

  const protocol = request.nextUrl.protocol.replace(':', '')
  const port = request.nextUrl.port || (protocol === 'https' ? '443' : '80')
  const host = port === '80' || port === '443' ? `127.0.0.1` : `127.0.0.1:${port}`
  return `${protocol}://${host}`
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, name: true, targetDomain: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.targetDomain) {
      return NextResponse.json({ error: 'Project has no target domain configured' }, { status: 400 })
    }

    const response = await fetch(`${getOrchestratorBaseUrl()}/recon/${projectId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        user_id: project.userId,
        webapp_api_url: getWebappBaseUrl(request),
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || 'Failed to start recon' },
        { status: response.status }
      )
    }

    if (data.status === 'error') {
      return NextResponse.json(
        { error: data.error || 'Recon backend returned an error state while starting.' },
        { status: 502 }
      )
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error starting recon:', error)

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Recon backend unreachable. Configure RECON_ORCHESTRATOR_URL to your orchestrator host.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
