import { NextRequest } from 'next/server'

const RECON_ORCHESTRATOR_URL = process.env.RECON_ORCHESTRATOR_URL

interface RouteParams {
  params: Promise<{ projectId: string }>
}

function getOrchestratorBaseUrl(request: NextRequest) {
  if (RECON_ORCHESTRATOR_URL) return RECON_ORCHESTRATOR_URL.replace(/\/$/, '')
  return `${request.nextUrl.protocol}//${request.nextUrl.hostname}:8010`
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params

  try {
    const orchestratorBaseUrl = getOrchestratorBaseUrl(request)
    const response = await fetch(`${orchestratorBaseUrl}/recon/${projectId}/logs`, {
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
