export type JiraActivityType =
  | 'ISSUE_CREATED'
  | 'STATUS_CHANGED'
  | 'ISSUE_RESOLVED'
  | 'ISSUE_REOPENED'
  | 'ASSIGNEE_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'SPRINT_CHANGED'
  | 'SPRINT_ADDED'
  | 'SPRINT_REMOVED'
  | 'EPIC_CHANGED'
  | 'STORY_POINTS_CHANGED'
  | 'DUE_DATE_CHANGED'
  | 'DESCRIPTION_CHANGED'
  | 'SUMMARY_CHANGED'
  | 'LABELS_CHANGED'
  | 'COMPONENTS_CHANGED'
  | 'FIX_VERSION_CHANGED'
  | 'FLAGGED_CHANGED'
  | 'ISSUE_LINK_CHANGED'
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_REMOVED'
  | 'WATCHER_CHANGED'
  | 'RESOLUTION_CHANGED'
  | 'COMMENT_ADDED'
  | 'COMMENT_EDITED'
  | 'WORKLOG_ADDED'
  | 'FIELD_CHANGED'

export interface JiraActivity {
  type: JiraActivityType | string
  issueKey: string
  issueSummary?: string
  author: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export type GitHubActivityType =
  | 'COMMIT'
  | 'PR_OPENED'
  | 'PR_MERGED'
  | 'PR_REVIEWED'
  | 'PR_COMMENTED'
  | 'PR_CLOSED'
  | 'ISSUE_OPENED'
  | 'ISSUE_CLOSED'

export interface GitHubActivity {
  type: GitHubActivityType
  repo: string
  title?: string
  sha?: string
  url?: string
  author: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export type SlackActivityType =
  | 'MESSAGE_SENT'
  | 'THREAD_REPLY'
  | 'REACTION_ADDED'
  | 'FILE_SHARED'
  | 'DM_SENT'

export interface SlackActivity {
  type: SlackActivityType
  channel: string
  channelName?: string
  author: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface DailyReport {
  date: string
  jira: JiraActivity[]
  github: GitHubActivity[]
  slack: SlackActivity[]
  aiSummary?: string
}

export interface OpenAIUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

export interface ReportOutput {
  jobId: string
  period: { startDate: string; endDate: string }
  generatedAt: string
  days: DailyReport[]
  openaiUsage?: OpenAIUsage
  jiraBaseUrl?: string
}
