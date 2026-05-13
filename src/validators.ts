import axios from 'axios'
import { createJiraClient } from './jira-client'

export interface JiraCredentials {
  baseUrl: string
  email: string
  apiToken: string
  accountId: string
}

export async function validateJira(credentials: JiraCredentials): Promise<true | string> {
  const jiraClient = createJiraClient(credentials.baseUrl, credentials.email, credentials.apiToken)
  const response = await jiraClient.get('/rest/api/3/myself')
  return response.data.accountId === credentials.accountId ? true : 'Account ID inválido. Verifique se o Account ID corresponde ao e-mail informado.'
}

export async function validateGithub(token: string): Promise<true | string> {
  const response = await axios.get('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })
  return response.data.login ? true : 'Token do GitHub inválido.'
}

export async function validateSlack(token: string): Promise<true | string> {
  const response = await axios.post('https://slack.com/api/auth.test', null, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data.ok ? true : (response.data.error ?? 'Token do Slack inválido.')
}

export async function validateOpenAI(token: string): Promise<true | string> {
  const response = await axios.get('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 1 },
  })
  return response.status === 200 ? true : 'Token da OpenAI inválido.'
}
