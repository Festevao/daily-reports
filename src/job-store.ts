export type JobStatus = 'pending' | 'processing' | 'error'

interface ActiveJob {
  jobId: string
  fingerprints: string[]
  queuedAt: number
  status: JobStatus
  processingAt?: number
  errorMessage?: string
}

declare global {
  // eslint-disable-next-line no-var
  var __reportJobStore: Map<string, ActiveJob> | undefined
}

const store: Map<string, ActiveJob> =
  global.__reportJobStore ?? (global.__reportJobStore = new Map())

export type ReserveResult =
  | { allowed: true; jobId: string }
  | { allowed: false; message: string }

export function reserveJob(fingerprints: string[]): ReserveResult {
  for (const fp of fingerprints) {
    const existing = store.get(fp)
    if (existing) {
      if (existing.status === 'processing') {
        return {
          allowed: false,
          message: 'Você já possui um relatório sendo processado no momento. Aguarde a conclusão.',
        }
      }
      if (existing.status === 'pending') {
        return {
          allowed: false,
          message: 'Você já possui um relatório aguardando na fila. Aguarde o processamento antes de gerar outro.',
        }
      }
    }
  }

  const jobId = crypto.randomUUID()
  const job: ActiveJob = { jobId, fingerprints, queuedAt: Date.now(), status: 'pending' }

  for (const fp of fingerprints) {
    store.set(fp, job)
  }

  return { allowed: true, jobId }
}

export function markProcessing(jobId: string): void {
  for (const job of store.values()) {
    if (job.jobId === jobId) {
      job.status = 'processing'
      job.processingAt = Date.now()
      return
    }
  }
}

export function markError(jobId: string, errorMessage: string): void {
  for (const job of store.values()) {
    if (job.jobId === jobId) {
      job.status = 'error'
      job.errorMessage = errorMessage
      return
    }
  }
}

export function releaseJob(jobId: string): void {
  for (const [key, job] of store.entries()) {
    if (job.jobId === jobId) store.delete(key)
  }
}

export function getJob(jobId: string): ActiveJob | null {
  for (const job of store.values()) {
    if (job.jobId === jobId) return job
  }
  return null
}
