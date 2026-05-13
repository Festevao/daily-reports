import axios from 'axios'

export function createJiraClient(baseUrl: string, email: string, apiToken: string) {
  const auth = Buffer.from(
    `${email}:${apiToken}`
  ).toString('base64');

  const jiraClient = axios.create({
    baseURL: baseUrl,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json'
    }
  });

  jiraClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        console.error(
          `[Jira API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response.status}`,
          JSON.stringify(error.response.data, null, 2)
        )
      }
      return Promise.reject(error)
    }
  );

  return jiraClient;
}