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
  | 'PUSH'
  | 'PR_OPENED'
  | 'PR_CLOSED'
  | 'PR_MERGED'
  | 'PR_REOPENED'
  | 'PR_DRAFT_CREATED'
  | 'PR_READY_FOR_REVIEW'
  | 'PR_APPROVED'
  | 'PR_CHANGES_REQUESTED'
  | 'PR_REVIEWED'
  | 'PR_COMMENTED'
  | 'REVIEW_COMMENT'
  | 'ISSUE_COMMENT'
  | 'REVIEW_REQUESTED'
  | 'LABEL_ADDED'
  | 'LABEL_REMOVED'
  | 'ASSIGNEE_CHANGED'
  | 'MILESTONE_CHANGED'
  | 'BRANCH_CREATED'
  | 'BRANCH_DELETED'
  | 'RELEASE_PUBLISHED'
  | 'FORCE_PUSH'
  | 'ISSUE_OPENED'
  | 'ISSUE_CLOSED'
  | 'ISSUE_REOPENED'
  | 'COMMIT_COMMENT'

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
  | 'THREAD_STARTED'
  | 'THREAD_REPLY'
  | 'MESSAGE_EDITED'
  | 'DM_SENT'
  | 'DM_RECEIVED'
  | 'REACTION_ADDED'
  | 'REACTION_RECEIVED'
  | 'DISCUSSION_CIRCUIT'
  | 'CALL_SUMMARY'

export interface SlackActivity {
  type: SlackActivityType
  channel: string
  channelName?: string
  author: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export type GoogleActivityType = 'CALENDAR_EVENT' | 'MEET_CALL'

export interface GoogleActivity {
  type: GoogleActivityType
  title: string
  author: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface DailyReport {
  date: string
  jira: JiraActivity[]
  github: GitHubActivity[]
  slack: SlackActivity[]
  google: GoogleActivity[]
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
