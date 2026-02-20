const DEFAULT_RECON_BACKENDS = [
  process.env.RECON_ORCHESTRATOR_URL,
  'http://recon-orchestrator:8010',
  'http://host.docker.internal:8010',
  'http://127.0.0.1:8010',
  'http://localhost:8010',
]

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '')
}

export function getReconBackendCandidates(): string[] {
  const unique = new Set<string>()

  for (const candidate of DEFAULT_RECON_BACKENDS) {
    if (!candidate) continue
    unique.add(normalizeUrl(candidate))
  }

  return [...unique]
}

export function isNetworkFetchError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes('fetch')
}

export async function fetchReconBackend(path: string, init?: RequestInit): Promise<{ response: Response; baseUrl: string }> {
  const bases = getReconBackendCandidates()
  let lastNetworkError: unknown = null

  for (const baseUrl of bases) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init)
      return { response, baseUrl }
    } catch (error) {
      if (isNetworkFetchError(error)) {
        lastNetworkError = error
        continue
      }

      throw error
    }
  }

  if (lastNetworkError) {
    throw new Error(`Recon backend unreachable on all candidates: ${bases.join(', ')}`)
  }

  throw new Error('No recon backend candidates configured')
}
