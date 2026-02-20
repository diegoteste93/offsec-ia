import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const RECON_ORCHESTRATOR_URL = process.env.RECON_ORCHESTRATOR_URL
const WEBAPP_URL = process.env.WEBAPP_URL

interface RouteParams {
  params: Promise<{ projectId: string }>
}

function getBaseUrl(request: NextRequest, envUrl: string | undefined, fallbackPort: number) {
  if (envUrl) return envUrl.replace(/\/$/, '')

  const protocol = request.nextUrl.protocol
  const hostname = request.nextUrl.hostname
  return `${protocol}//${hostname}:${fallbackPort}`
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

    const orchestratorBaseUrl = getBaseUrl(request, RECON_ORCHESTRATOR_URL, 8010)
    const webappBaseUrl = getBaseUrl(request, WEBAPP_URL, 3000)

    const response = await fetch(`${orchestratorBaseUrl}/recon/${projectId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        user_id: project.userId,
        webapp_api_url: webappBaseUrl,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.error || 'Failed to start recon' },
        { status: response.status }
      )
    }

    const data = await response.json()
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
