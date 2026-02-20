import { NextRequest } from 'next/server'

const RECON_ORCHESTRATOR_URL = process.env.RECON_ORCHESTRATOR_URL

interface RouteParams {
  params: Promise<{ projectId: string }>
}

function getOrchestratorBaseUrl() {
  return (RECON_ORCHESTRATOR_URL || 'http://127.0.0.1:8010').replace(/\/$/, '')
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params

  try {
    const response = await fetch(`${getOrchestratorBaseUrl()}/recon/${projectId}/logs`, {
      headers: {
        'Accept': 'text/event-stream',
      },
      signal: request.signal,
    })

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to connect to recon log stream' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    })
  } catch {
    return new Response(
      JSON.stringify({ error: 'Recon log stream unavailable. Check recon backend connectivity.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
