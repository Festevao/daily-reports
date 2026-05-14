import { SlackActivity } from '../types/report.types'

const MOCK_AUTHOR = 'Felipi'

const CHANNEL_MESSAGES = [
  'Galera, atualizei o PR com os feedbacks, pode dar uma olhada quando puderem!',
  'Alguém sabe qual é o comportamento esperado pra esse edge case? Abrindo uma discussão.',
  'Terminei a implementação do módulo de autenticação. Vou fazer o review do PR do @colega.',
  'Reunião de sync às 15h confirmada no calendar.',
  'Fiz deploy no ambiente de staging, podem testar.',
  'O pipeline CI falhou no passo de lint, mas já corrigi localmente.',
  'Alguém mais ta conseguindo reproduzir o bug #4523? Consigo testar aqui.',
  'Documentação atualizada com os novos endpoints da v2.',
]

const THREAD_REPLIES = [
  'Concordo, faz sentido tratar esse caso separadamente.',
  'Boa point! Vou ajustar o código e enviar nova versão.',
  'Sim, já vi esse comportamento antes. A correção é no service layer.',
  'Pode ser um problema de timezone também, vou verificar.',
  'Aprovado! Código bem estruturado e testes cobrem os principais casos.',
]

const DM_MESSAGES = [
  'Pode me dar uma força no PR quando tiver tempo?',
  'Vi seu comentário, faz sentido, vou refatorar essa parte.',
  'Topa fazer um pair programming rápido na implementação?',
  'Acabei de resolver aquele bug que a gente discutiu ontem.',
]

const REACTIONS = ['thumbsup', 'white_check_mark', 'fire', 'eyes', 'rocket', 'clap']

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function timeAt(date: string, hour: number, minute: number): string {
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`
}

/**
 * Returns realistic mock Slack activities for the given day,
 * scoped to the provided channel IDs.
 */
export function extractSlackActivities(
  _token: string,
  channelIds: string[],
  includeDms: boolean,
  date: string
): SlackActivity[] {
  const channels = channelIds.length > 0 ? channelIds : ['C_general']
  const activities: SlackActivity[] = []

  activities.push({
    type: 'MESSAGE_SENT',
    channel: channels[0] ?? 'C_general',
    channelName: '#general',
    author: MOCK_AUTHOR,
    createdAt: timeAt(date, 9, 12),
    metadata: { text: randomFrom(CHANNEL_MESSAGES) },
  })

  if (channels.length > 1) {
    activities.push({
      type: 'MESSAGE_SENT',
      channel: channels[1],
      channelName: '#backend',
      author: MOCK_AUTHOR,
      createdAt: timeAt(date, 10, 5),
      metadata: { text: randomFrom(CHANNEL_MESSAGES) },
    })
  }

  activities.push({
    type: 'THREAD_REPLY',
    channel: channels[0] ?? 'C_general',
    channelName: '#general',
    author: MOCK_AUTHOR,
    createdAt: timeAt(date, 11, 30),
    metadata: {
      text: randomFrom(THREAD_REPLIES),
      threadTs: `${Date.now() - 3600000}`,
    },
  })

  activities.push({
    type: 'REACTION_ADDED',
    channel: channels[0] ?? 'C_general',
    channelName: '#general',
    author: MOCK_AUTHOR,
    createdAt: timeAt(date, 13, 45),
    metadata: { reaction: randomFrom(REACTIONS) },
  })

  if (includeDms) {
    activities.push({
      type: 'DM_SENT',
      channel: 'D_dm',
      channelName: 'Direct Message',
      author: MOCK_AUTHOR,
      createdAt: timeAt(date, 14, 20),
      metadata: { text: randomFrom(DM_MESSAGES) },
    })
  }

  if (channels.length > 0) {
    activities.push({
      type: 'FILE_SHARED',
      channel: randomFrom(channels),
      channelName: '#backend',
      author: MOCK_AUTHOR,
      createdAt: timeAt(date, 16, 10),
      metadata: { fileName: 'architecture-diagram.png', fileType: 'png' },
    })
  }

  return activities.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
