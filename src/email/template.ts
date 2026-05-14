export interface ReportPayload {
  jobId: string
  queuedAt: string
  reportEmail: string
  period: {
    startDate: string | null
    endDate: string | null
  }
  integrations: {
    jira?: {
      credentials: { baseUrl: string; email: string; apiToken: string; accountId: string }
      projectIds: string[]
    }
    github?: {
      token: string
      orgLogins: string[]
      repoFullNames: string[]
    }
    slack?: {
      token: string
      channelIds: string[]
      includeDirectMessages: boolean
    }
    openai?: {
      apiKey: string
      customInstructions?: string
    }
    google?: {
      accessToken: string
      refreshToken: string
    }
  }
}
