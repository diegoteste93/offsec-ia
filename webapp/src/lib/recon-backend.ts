const DEFAULT_RECON_BACKENDS = [
  process.env.RECON_ORCHESTRATOR_URL,
  'http://recon-orchestrator:8010',
  'http://host.docker.internal:8010',
  'http://127.0.0.1:8010',
  'http://localhost:8010',
]

<<<<<<< codex/add-login-feature-with-user-management-5w699d
const DEFAULT_RETRY_STATUSES = [502, 503, 504]

=======
>>>>>>> master
function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '')
}

export function getReconBackendCandidates(extraCandidates: string[] = []): string[] {
  const unique = new Set<string>()

  for (const candidate of [...extraCandidates, ...DEFAULT_RECON_BACKENDS]) {
    if (!candidate) continue
    unique.add(normalizeUrl(candidate))
  }

  return [...unique]
}

export function isNetworkFetchError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes('fetch')
}

<<<<<<< codex/add-login-feature-with-user-management-5w699d
function shouldRetryStatus(status: number, retryStatuses: number[]): boolean {
  return retryStatuses.includes(status)
}

interface FetchReconBackendOptions {
  retryStatuses?: number[]
}

export async function fetchReconBackend(
  path: string,
  init?: RequestInit,
  extraCandidates: string[] = [],
  options: FetchReconBackendOptions = {}
): Promise<{ response: Response; baseUrl: string }> {
  const bases = getReconBackendCandidates(extraCandidates)
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES
  let lastNetworkError: unknown = null
  let lastRetryableResponse: { response: Response; baseUrl: string } | null = null
=======
export async function fetchReconBackend(
  path: string,
  init?: RequestInit,
  extraCandidates: string[] = []
): Promise<{ response: Response; baseUrl: string }> {
  const bases = getReconBackendCandidates(extraCandidates)
  let lastNetworkError: unknown = null
>>>>>>> master

  for (const baseUrl of bases) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init)
<<<<<<< codex/add-login-feature-with-user-management-5w699d

      if (shouldRetryStatus(response.status, retryStatuses)) {
        lastRetryableResponse = { response, baseUrl }
        continue
      }

=======
>>>>>>> master
      return { response, baseUrl }
    } catch (error) {
      if (isNetworkFetchError(error)) {
        lastNetworkError = error
        continue
      }

      throw error
    }
  }

<<<<<<< codex/add-login-feature-with-user-management-5w699d
  if (lastRetryableResponse) {
    return lastRetryableResponse
  }

=======
>>>>>>> master
  if (lastNetworkError) {
    throw new Error(`Recon backend unreachable on all candidates: ${bases.join(', ')}`)
  }

  throw new Error('No recon backend candidates configured')
}
