import { NextRequest } from 'next/server'
import { fetchReconBackend, isNetworkFetchError } from '@/lib/recon-backend'

// Legacy compatibility constant: keeps old helper call sites build-safe if reintroduced
const RECON_ORCHESTRATOR_URL = process.env.RECON_ORCHESTRATOR_URL

interface RouteParams {
  params: Promise<{ projectId: string }>
}

function getOrchestratorBaseUrl(_request?: Request) {
  return (RECON_ORCHESTRATOR_URL || 'http://127.0.0.1:8010').replace(/\/$/, '')
}

function getRuntimeReconCandidates(request: NextRequest) {
  const protocol = request.nextUrl.protocol.replace(':', '')
  const hostname = request.nextUrl.hostname
  return [
    `${protocol}://${hostname}:8010`,
    `http://${hostname}:8010`,
  ]
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params

  try {
    const { response } = await fetchReconBackend(`/recon/${projectId}/logs`, {
      headers: {
        'Accept': 'text/event-stream',
      },
      signal: request.signal,
    }, getRuntimeReconCandidates(request))

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
  } catch (error) {
    if (isNetworkFetchError(error) || (error instanceof Error && error.message.includes('Recon backend unreachable'))) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Recon log stream unavailable. Check recon backend connectivity.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Failed to proxy recon log stream.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
