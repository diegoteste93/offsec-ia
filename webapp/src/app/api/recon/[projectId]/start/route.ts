import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { fetchReconBackend, isNetworkFetchError } from '@/lib/recon-backend'

const WEBAPP_URL = process.env.WEBAPP_URL

interface RouteParams {
  params: Promise<{ projectId: string }>
}

function getRuntimeReconCandidates(request: NextRequest) {
  const protocol = request.nextUrl.protocol.replace(':', '')
  const hostname = request.nextUrl.hostname
  return [
    `${protocol}://${hostname}:8010`,
    `http://${hostname}:8010`,
  ]
}

function getWebappBaseUrl(request: NextRequest) {
  if (WEBAPP_URL) return WEBAPP_URL.replace(/\/$/, '')

  const protocol = request.nextUrl.protocol.replace(':', '')
  const port = request.nextUrl.port || (protocol === 'https' ? '443' : '80')
  const host = port === '80' || port === '443' ? '127.0.0.1' : `127.0.0.1:${port}`
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

    const { response, baseUrl } = await fetchReconBackend(
      `/recon/${projectId}/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          user_id: project.userId,
          webapp_api_url: getWebappBaseUrl(request),
        }),
      },
      getRuntimeReconCandidates(request)
    )

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || `Failed to start recon via ${baseUrl}` },
        { status: response.status }
      )
    }

    if (data.status === 'error') {
      return NextResponse.json(
        { error: data.error || `Recon backend returned an error state while starting via ${baseUrl}.` },
        { status: 502 }
      )
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error starting recon:', error)

    if (isNetworkFetchError(error) || (error instanceof Error && error.message.includes('Recon backend unreachable'))) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Recon backend unreachable.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
