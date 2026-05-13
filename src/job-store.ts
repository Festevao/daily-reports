interface ActiveJob {
  jobId: string
  fingerprints: string[]
  queuedAt: number
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
    if (store.has(fp)) {
      return {
        allowed: false,
        message:
          'Você já possui um relatório aguardando na fila. Aguarde o processamento antes de gerar outro.',
      }
    }
  }

  const jobId = crypto.randomUUID()
  const job: ActiveJob = { jobId, fingerprints, queuedAt: Date.now() }

  for (const fp of fingerprints) {
    store.set(fp, job)
  }

  return { allowed: true, jobId }
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
