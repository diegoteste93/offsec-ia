import { NextRequest, NextResponse } from 'next/server'

const RECON_ORCHESTRATOR_URL = process.env.RECON_ORCHESTRATOR_URL

interface RouteParams {
  params: Promise<{ projectId: string }>
}

function getOrchestratorBaseUrl(request: NextRequest) {
  if (RECON_ORCHESTRATOR_URL) return RECON_ORCHESTRATOR_URL.replace(/\/$/, '')
  return `${request.nextUrl.protocol}//${request.nextUrl.hostname}:8010`
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const orchestratorBaseUrl = getOrchestratorBaseUrl(request)

    const response = await fetch(`${orchestratorBaseUrl}/recon/${projectId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.error || 'Failed to get recon status' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error getting recon status:', error)

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json({
        project_id: (await params).projectId,
        status: 'idle',
        current_phase: null,
        phase_number: null,
        total_phases: 7,
        started_at: null,
        completed_at: null,
        error: null,
      })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
