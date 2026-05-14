import { GitHubActivity } from '../types/report.types'

const MOCK_AUTHORS = ['felipi', 'dev-user']

const COMMIT_MESSAGES = [
  'feat: add user authentication middleware',
  'fix: resolve null pointer exception in payment service',
  'refactor: extract common validation logic into shared util',
  'chore: update dependencies to latest versions',
  'fix: correct date parsing in report generator',
  'feat: implement retry mechanism for external API calls',
  'test: add unit tests for order calculation',
  'docs: update API documentation for v2 endpoints',
  'perf: optimize database query with index',
  'fix: handle edge case in CSV export',
]

const PR_TITLES = [
  'Add rate limiting to public API endpoints',
  'Refactor authentication flow to use JWT',
  'Fix memory leak in websocket handler',
  'Implement pagination for list endpoints',
  'Add dark mode support to dashboard',
  'Update error messages to be more user-friendly',
  'Migrate from deprecated crypto module methods',
  'Add integration tests for checkout flow',
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function timeAt(date: string, hour: number, minute: number): string {
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`
}

function fakesha(): string {
  return Math.random().toString(16).slice(2, 10)
}

/**
 * Returns realistic mock GitHub activities for the given day,
 * scoped to the provided repo full names.
 */
export function extractGitHubActivities(
  _token: string,
  repoFullNames: string[],
  date: string
): GitHubActivity[] {
  const repos = repoFullNames.length > 0 ? repoFullNames : ['org/sample-repo']
  const activities: GitHubActivity[] = []
  const author = MOCK_AUTHORS[0]

  const repo = randomFrom(repos)

  for (let i = 0; i < 3; i++) {
    activities.push({
      type: 'COMMIT',
      repo,
      title: randomFrom(COMMIT_MESSAGES),
      sha: fakesha(),
      url: `https://github.com/${repo}/commit/${fakesha()}`,
      author,
      createdAt: timeAt(date, 9 + i * 2, Math.floor(Math.random() * 60)),
      metadata: {
        branch: 'main',
        additions: Math.floor(Math.random() * 80) + 5,
        deletions: Math.floor(Math.random() * 30),
      },
    })
  }

  const prRepo = randomFrom(repos)
  const prTitle = randomFrom(PR_TITLES)
  const prNumber = Math.floor(Math.random() * 500) + 100
  const prUrl = `https://github.com/${prRepo}/pull/${prNumber}`

  activities.push({
    type: 'PR_OPENED',
    repo: prRepo,
    title: prTitle,
    url: prUrl,
    author,
    createdAt: timeAt(date, 10, 30),
    metadata: { prNumber, branch: `feat/issue-${prNumber}`, baseBranch: 'main' },
  })

  activities.push({
    type: 'PR_REVIEWED',
    repo: randomFrom(repos),
    title: randomFrom(PR_TITLES),
    url: `https://github.com/${randomFrom(repos)}/pull/${prNumber - 5}`,
    author,
    createdAt: timeAt(date, 14, 15),
    metadata: { state: 'approved', prNumber: prNumber - 5 },
  })

  activities.push({
    type: 'PR_COMMENTED',
    repo: prRepo,
    title: prTitle,
    url: prUrl,
    author,
    createdAt: timeAt(date, 15, 45),
    metadata: { prNumber, body: 'LGTM! Left a minor suggestion on line 42.' },
  })

  activities.push({
    type: 'PR_MERGED',
    repo: randomFrom(repos),
    title: randomFrom(PR_TITLES),
    url: `https://github.com/${randomFrom(repos)}/pull/${prNumber - 10}`,
    author,
    createdAt: timeAt(date, 17, 0),
    metadata: { prNumber: prNumber - 10, mergedBy: author },
  })

  return activities.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
