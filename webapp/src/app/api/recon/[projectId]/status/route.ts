import { NextResponse } from 'next/server'
import { fetchReconBackend, isNetworkFetchError } from '@/lib/recon-backend'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params

    const { response } = await fetchReconBackend(`/recon/${projectId}/status`, {
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

    if (isNetworkFetchError(error) || (error instanceof Error && error.message.includes('Recon backend unreachable'))) {
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
