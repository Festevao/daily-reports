import axios, { AxiosInstance } from 'axios'
import { SlackActivity, SlackActivityType } from '../types/report.types'
import { step } from '../logger'

const CHANNEL_CONCURRENCY = 3
const THREAD_CONCURRENCY = 5

interface RawCallV1 {
  title?: string
  duration?: number
  date_start?: number
  date_end?: number
  created_by?: string
  participants?: Array<{ slack_id: string }>
}

interface RawMessage {
  type: string
  subtype?: string
  user?: string
  bot_id?: string
  bot_profile?: { name?: string }
  text: string
  ts: string
  thread_ts?: string
  reply_count?: number
  reactions?: Array<{ name: string; count: number; users: string[] }>
  edited?: { user: string; ts: string }
  attachments?: Array<{ fallback?: string; title?: string; text?: string; from_url?: string }>
  blocks?: unknown[]
  files?: Array<{ id: string; name?: string; title?: string; mimetype?: string; url_private?: string; url_private_download?: string }>
  call?: { v1?: RawCallV1 }
  room?: {
    name?: string
    has_ended?: boolean
    participant_history?: Array<{ slack_id?: string }>
    attached_file_ids?: string[]
  }
}

interface RawReactionItem {
  type: 'message'
  channel: string
  message: RawMessage & { reactions?: Array<{ name: string; count: number; users: string[] }> }
}

function createClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://slack.com/api',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    timeout: 30_000,
  })
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number; headers?: Record<string, string> } })?.response?.status
    if (status === 429) {
      const retryAfter = parseInt(
        (err as { response?: { headers?: Record<string, string> } })?.response?.headers?.['retry-after'] ?? '5',
        10
      ) + 1
      step(`🟢 Slack — rate limited, aguardando ${retryAfter}s...`)
      await sleep(retryAfter * 1000)
      return await fn()
    }
    throw err
  }
}

function tsToIso(ts: string): string {
  return new Date(parseFloat(ts) * 1000).toISOString()
}

function isoDate(iso: string): string {
  return iso.slice(0, 10)
}

function tsToEpochSec(dateStr: string, endOfDay = false): string {
  const time = endOfDay ? 'T23:59:59Z' : 'T00:00:00Z'
  return (new Date(dateStr + time).getTime() / 1000).toString()
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let index = 0
  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}

/**
 * Paginates conversations.history for a channel within the date range.
 */
async function paginateHistory(
  client: AxiosInstance,
  channelId: string,
  oldest: string,
  latest: string
): Promise<RawMessage[]> {
  const messages: RawMessage[] = []
  let cursor: string | undefined

  do {
    const res = await callWithRetry(() =>
      client.get<{ ok: boolean; messages?: RawMessage[]; has_more?: boolean; response_metadata?: { next_cursor?: string }; error?: string }>(
        '/conversations.history',
        { params: { channel: channelId, oldest, latest, limit: 200, ...(cursor ? { cursor } : {}) } }
      )
    )

    if (!res.data.ok) {
      const err = res.data.error ?? 'unknown'
      if (err === 'missing_scope') {
        throw new Error(`Permissão insuficiente para ler o histórico do canal ${channelId}. Certifique-se de que o token Slack possui os escopos: channels:history, groups:history, im:history, mpim:history`)
      }
      if (err === 'not_in_channel') {
        throw new Error(`O bot/usuário não é membro do canal ${channelId}. Adicione-o ao canal ou use um user token.`)
      }
      throw new Error(`conversations.history erro para ${channelId}: ${err}`)
    }

    messages.push(...(res.data.messages ?? []))
    cursor = res.data.has_more ? (res.data.response_metadata?.next_cursor || undefined) : undefined
  } while (cursor)

  return messages
}

/**
 * Paginates conversations.replies for a thread.
 */
async function paginateReplies(
  client: AxiosInstance,
  channelId: string,
  threadTs: string
): Promise<RawMessage[]> {
  const messages: RawMessage[] = []
  let cursor: string | undefined

  do {
    const res = await callWithRetry(() =>
      client.get<{ ok: boolean; messages?: RawMessage[]; has_more?: boolean; response_metadata?: { next_cursor?: string }; error?: string }>(
        '/conversations.replies',
        { params: { channel: channelId, ts: threadTs, limit: 200, ...(cursor ? { cursor } : {}) } }
      )
    )

    if (!res.data.ok) break

    messages.push(...(res.data.messages ?? []))
    cursor = res.data.has_more ? (res.data.response_metadata?.next_cursor || undefined) : undefined
  } while (cursor)

  return messages
}

/**
 * Resolves the authenticated user's ID and display name via auth.test + users.info.
 */
async function resolveIdentity(client: AxiosInstance): Promise<{ userId: string; displayName: string }> {
  const authRes = await callWithRetry(() =>
    client.post<{ ok: boolean; user_id?: string; user?: string }>('/auth.test')
  )

  const userId = authRes.data.user_id ?? ''
  let displayName = authRes.data.user ?? 'unknown'

  try {
    const infoRes = await callWithRetry(() =>
      client.get<{ ok: boolean; user?: { profile?: { display_name?: string; real_name?: string }; name?: string } }>(
        '/users.info',
        { params: { user: userId } }
      )
    )
    if (infoRes.data.ok && infoRes.data.user) {
      const profile = infoRes.data.user.profile
      displayName =
        profile?.display_name?.trim() ||
        profile?.real_name?.trim() ||
        infoRes.data.user.name ||
        displayName
    }
  } catch {
    // non-fatal — keep the auth.test username
  }

  return { userId, displayName }
}

/**
 * Resolves a user's display name via users.info, with a local cache to avoid duplicates.
 */
async function resolveUserName(
  client: AxiosInstance,
  userId: string,
  cache: Map<string, string>
): Promise<string> {
  if (cache.has(userId)) return cache.get(userId)!
  try {
    const res = await callWithRetry(() =>
      client.get<{ ok: boolean; user?: { profile?: { display_name?: string; real_name?: string }; name?: string } }>(
        '/users.info',
        { params: { user: userId } }
      )
    )
    if (res.data.ok && res.data.user) {
      const profile = res.data.user.profile
      const name =
        profile?.display_name?.trim() ||
        profile?.real_name?.trim() ||
        res.data.user.name ||
        userId
      cache.set(userId, name)
      return name
    }
  } catch {
    // fall through
  }
  cache.set(userId, userId)
  return userId
}

/**
 * Resolves a channel's display name via conversations.info.
 */
async function resolveChannelName(
  client: AxiosInstance,
  channelId: string
): Promise<string> {
  try {
    const res = await callWithRetry(() =>
      client.get<{ ok: boolean; channel?: { name?: string; user?: string } }>(
        '/conversations.info',
        { params: { channel: channelId } }
      )
    )
    if (res.data.ok && res.data.channel?.name) return `#${res.data.channel.name}`
    if (res.data.ok && res.data.channel?.user) return `DM:${res.data.channel.user}`
  } catch {
    // fall through
  }
  return channelId
}

interface HuddleThreadContent {
  chatMessages: Array<{ author: string; text: string; createdAt: string; isUser: boolean }>
  participantsFromChat: string[]
  aiNotes: string | undefined
  aiNotesAvailable: boolean
}

/**
 * Fetches replies from a huddle thread and separates chat messages from AI notes (Slackbot).
 * Also tries to download AI notes canvas content via files.info.
 */
async function fetchHuddleThreadContent(
  client: AxiosInstance,
  channelId: string,
  threadTs: string,
  userId: string,
  room: RawMessage['room'],
  userNameCache: Map<string, string>
): Promise<HuddleThreadContent> {
  let chatMessages: HuddleThreadContent['chatMessages'] = []
  let aiNotes: string | undefined
  let aiNotesAvailable = false
  const canvasFileIds = new Set<string>()

  try {
    const replies = await paginateReplies(client, channelId, threadTs)
    for (const reply of replies) {
      if (!reply.text || reply.ts === threadTs) continue
      if (reply.subtype === 'tombstone') continue

      const isSlackbot = reply.user === 'USLACKBOT'
      const isBotMsg = !!reply.bot_id || reply.subtype === 'bot_message'
      const txt = reply.text ?? ''

      // Collect any canvas/file IDs from all replies (bot or human)
      for (const f of reply.files ?? []) {
        if (f.id) canvasFileIds.add(f.id)
      }

      if (isSlackbot || isBotMsg) {
        const lc = txt.toLowerCase()
        const isNotesMsg = lc.includes('anotações') || lc.includes('notes') || lc.includes('resumo') ||
          lc.includes('summary') || lc.includes('transcript') || lc.includes('transcrição') ||
          lc.includes('círculo') || lc.includes('circle') || lc.includes('huddle')
        if (isNotesMsg) {
          aiNotesAvailable = true
          if (txt.length > 30) aiNotes = txt
        }
        continue
      }

      if (!reply.user) continue
      const authorName = await resolveUserName(client, reply.user, userNameCache)
      chatMessages.push({
        author: authorName,
        text: txt,
        createdAt: tsToIso(reply.ts),
        isUser: reply.user === userId,
      })
    }
  } catch { /* best-effort */ }

  // Collect canvas file IDs from room.attached_file_ids too
  for (const fid of (room?.attached_file_ids ?? [])) {
    if (fid) canvasFileIds.add(fid)
  }

  // Try to fetch canvas content
  if (canvasFileIds.size > 0 && !aiNotes) {
    for (const fileId of [...canvasFileIds].slice(0, 2)) {
      try {
        const fileRes = await callWithRetry(() =>
          client.get<{ ok: boolean; file?: { url_private?: string; url_private_download?: string; name?: string; mimetype?: string; title?: string } }>(
            '/files.info', { params: { file: fileId } }
          )
        )
        if (!fileRes.data.ok) continue
        const file = fileRes.data.file
        if (!file) continue
        const downloadUrl = file.url_private_download ?? file.url_private
        if (!downloadUrl) {
          if (file.title || file.name) {
            aiNotesAvailable = true
          }
          continue
        }
        const dlRes = await axios.get<string>(downloadUrl, {
          headers: { Authorization: `Bearer ${client.defaults.headers?.Authorization ?? ''}` },
          timeout: 10_000,
          responseType: 'text',
        })
        const raw = typeof dlRes.data === 'string' ? dlRes.data : JSON.stringify(dlRes.data)
        if (raw.length > 20) {
          aiNotesAvailable = true
          aiNotes = raw.slice(0, 3000)
          break
        }
      } catch { /* canvas not accessible — skip */ }
    }
  }

  const participantsFromChat = [...new Set(chatMessages.map((m) => m.author))]

  return { chatMessages, participantsFromChat, aiNotes, aiNotesAvailable }
}

function addActivity(
  byDay: Map<string, SlackActivity[]>,
  seen: Set<string>,
  key: string,
  activity: SlackActivity
): void {
  if (seen.has(key)) return
  seen.add(key)
  const day = isoDate(activity.createdAt)
  const list = byDay.get(day) ?? []
  list.push(activity)
  byDay.set(day, list)
}

/**
 * Extracts all real Slack activities for the given token, channels, and date range.
 * Returns activities grouped by day (YYYY-MM-DD).
 */
export async function extractSlackActivities(
  token: string,
  channelIds: string[],
  includeDms: boolean,
  startDate: string,
  endDate: string
): Promise<Map<string, SlackActivity[]>> {
  const client = createClient(token)
  const byDay = new Map<string, SlackActivity[]>()
  const seen = new Set<string>()
  const userNameCache = new Map<string, string>()

  if (channelIds.length === 0 && !includeDms) return byDay

  step(`🟢 Slack — resolvendo identidade do usuário...`)
  const { userId, displayName } = await resolveIdentity(client)
  userNameCache.set(userId, displayName)
  step(`🟢 Slack — usuário: ${displayName} (${userId})`)

  const oldest = tsToEpochSec(startDate, false)
  const latest = tsToEpochSec(endDate, true)

  const effectiveChannelIds = [...new Set(channelIds)]
  step(`🟢 Slack — ${effectiveChannelIds.length} canal(is) a processar: [${effectiveChannelIds.join(', ')}]`)

  // ── RESOLVE CHANNEL NAMES ───────────────────────────────────────────────
  const channelNameMap = new Map<string, string>()
  await Promise.all(
    effectiveChannelIds.map(async (id) => {
      const name = await resolveChannelName(client, id)
      channelNameMap.set(id, name)
      step(`🟢 Slack — canal resolvido: ${id} → ${name}`)
    })
  )

  // ── REACTIONS ADDED BY USER ─────────────────────────────────────────────
  step(`🟢 Slack — buscando reações adicionadas...`)
  try {
    const reactionsAdded: SlackActivity[] = []
    let cursor: string | undefined
    const channelScope = new Set(effectiveChannelIds)

    do {
      const res = await callWithRetry(() =>
        client.get<{ ok: boolean; items?: RawReactionItem[]; has_more?: boolean; response_metadata?: { next_cursor?: string } }>(
          '/reactions.list',
          { params: { user: userId, full: true, limit: 200, ...(cursor ? { cursor } : {}) } }
        )
      )

      if (!res.data.ok) break

      for (const item of res.data.items ?? []) {
        if (item.type !== 'message') continue
        if (!channelScope.has(item.channel) && !item.channel.startsWith('D')) continue
        const msgTs = item.message?.ts
        if (!msgTs) continue
        const iso = tsToIso(msgTs)
        const day = isoDate(iso)
        if (day < startDate || day > endDate) continue

        for (const rxn of item.message?.reactions ?? []) {
          if (!rxn.users.includes(userId)) continue
          reactionsAdded.push({
            type: 'REACTION_ADDED',
            channel: item.channel,
            channelName: channelNameMap.get(item.channel) ?? item.channel,
            author: displayName,
            createdAt: iso,
            metadata: {
              reaction: rxn.name,
              targetMessageTs: msgTs,
              targetText: item.message.text?.slice(0, 200),
            },
          })
        }
      }

      cursor = res.data.has_more ? (res.data.response_metadata?.next_cursor || undefined) : undefined
    } while (cursor)

    for (const a of reactionsAdded) {
      addActivity(byDay, seen, `REACTION_ADDED:${a.channel}:${a.metadata?.targetMessageTs}:${a.metadata?.reaction}`, a)
    }
    step(`🟢 Slack — ${reactionsAdded.length} reação(ões) adicionada(s) encontrada(s)`)
  } catch (err) {
    step(`🟢 Slack — aviso: não foi possível buscar reações: ${(err as Error).message}`)
  }

  // ── PER-CHANNEL HISTORY ─────────────────────────────────────────────────
  const channelTasks = effectiveChannelIds.map((channelId) => async () => {
    const channelName = channelNameMap.get(channelId) ?? channelId
    step(`🟢 Slack — ▶ iniciando canal ${channelName} (${channelId})`)

    let messages: RawMessage[] = []
    try {
      messages = await paginateHistory(client, channelId, oldest, latest)
    } catch (err) {
      step(`❌ Slack — ERRO no canal ${channelName}: ${(err as Error).message}`)
      return
    }

    if (messages.length === 0) {
      step(`⚠️  Slack — canal ${channelName}: 0 mensagens retornadas. Verifique se o token tem escopo groups:history para canais privados.`)
      return
    }

    const subtypesSeen = new Map<string, number>()
    let callLikeCount = 0
    step(`🟢 Slack — ${channelName}: ${messages.length} mensagem(ns) encontrada(s)`)

    // All thread root ts values visible in channel history (candidates for circuit analysis)
    const threadCandidates = new Set<string>()
    // Huddle thread ts values — already captured as CALL_SUMMARY, skip in circuit analysis
    const channelHuddleTs = new Set<string>()

    for (const msg of messages) {
      if (!msg.ts) continue

      // Diagnostic: count all subtypes
      const sub = msg.subtype ?? (msg.call ? '__has_call__' : msg.room ? '__has_room__' : '__none__')
      subtypesSeen.set(sub, (subtypesSeen.get(sub) ?? 0) + 1)
      if (msg.call || msg.room || sub.includes('call') || sub.includes('huddle')) {
        callLikeCount++
        step(`🟢 Slack — ${channelName} [DIAGNÓSTICO CHAMADA] subtype=${msg.subtype ?? 'none'} user=${msg.user ?? 'none'} hasCall=${!!msg.call} hasRoom=${!!msg.room} ts=${msg.ts} text=${(msg.text ?? '').slice(0, 60)}`)
      }

      const iso = tsToIso(msg.ts)
      const day = isoDate(iso)
      if (day < startDate || day > endDate) continue

      // Collect every thread root visible in channel history as a candidate.
      const isHuddleSub = ['huddle_thread', 'sh_room_created', 'sh_room_ended', 'sh_room_joined'].includes(msg.subtype ?? '')
      if (msg.thread_ts === msg.ts && (msg.reply_count ?? 0) > 0 && !isHuddleSub) {
        threadCandidates.add(msg.ts)
      }
      if (msg.thread_ts && msg.thread_ts !== msg.ts) {
        threadCandidates.add(msg.thread_ts)
      }
      if (isHuddleSub || msg.room) {
        threadCandidates.add(msg.ts)
      }

      // ── CALL / HUDDLE DETECTION (any message, not just from userId) ─────
      const isCallEnded = msg.subtype === 'call_ended' && !!msg.call?.v1
      const huddleSubtypes = new Set(['huddle_thread', 'sh_room_created', 'sh_room_ended', 'sh_room_joined'])
      const msgTextLower = (msg.text ?? '').toLowerCase()
      const isHuddleBySubtype = huddleSubtypes.has(msg.subtype ?? '')
      const isHuddleByRoom = !!msg.room
      const isHuddleByText = !msg.user && (
        msgTextLower.includes('círculo') || msgTextLower.includes('huddle') || msgTextLower.includes('circle')
      )
      const isHuddle = isHuddleBySubtype || isHuddleByRoom || isHuddleByText
      const botName = (msg.bot_profile?.name ?? '').toLowerCase()
      const isAiCallSummary =
        (msg.subtype === 'bot_message' || !!msg.bot_id) &&
        (botName.includes('slack ai') || botName.includes('ai notes') || botName.includes('slackbot') || botName.includes('summary')) &&
        (msgTextLower.includes('summary') || msgTextLower.includes('transcript') ||
          msgTextLower.includes('resumo') || msgTextLower.includes('transcrição') ||
          msgTextLower.includes('call') || msgTextLower.includes('chamada') ||
          msgTextLower.includes('huddle') || msgTextLower.includes('círculo'))

      if (isCallEnded) {
        const call = msg.call!.v1!
        const participants = (call.participants?.map((p) => p.slack_id) ?? []).filter(Boolean) as string[]
        const userParticipated = participants.includes(userId) || call.created_by === userId
        if (userParticipated) {
          const durationMin = call.duration ? Math.round(call.duration / 60) : undefined
          addActivity(byDay, seen, `CALL_SUMMARY:${channelId}:${msg.ts}`, {
            type: 'CALL_SUMMARY',
            channel: channelId,
            channelName,
            author: displayName,
            createdAt: iso,
            metadata: {
              title: call.title || 'Chamada',
              durationMinutes: durationMin,
              callType: 'call',
              participants: await Promise.all(participants.map((id) => resolveUserName(client, id, userNameCache))),
            },
          })
        }
      } else if (isHuddle) {
        const room = msg.room
        const roomParticipants = (room?.participant_history?.map((p) => p.slack_id) ?? []).filter(Boolean) as string[]
        const userParticipated = roomParticipants.includes(userId) || roomParticipants.length === 0
        step(`🟢 Slack — ${channelName} [CÍRCULO/HUDDLE] subtype=${msg.subtype ?? 'none'} ts=${msg.ts} hasEnded=${room?.has_ended} participants=${JSON.stringify(roomParticipants)} userParticipated=${userParticipated}`)
        if (userParticipated) {
          channelHuddleTs.add(msg.ts)
          const huddleContent = await fetchHuddleThreadContent(client, channelId, msg.ts, userId, room, userNameCache)
          let resolvedParticipants: string[]
          if (roomParticipants.length > 0) {
            resolvedParticipants = await Promise.all(roomParticipants.map((id) => resolveUserName(client, id, userNameCache)))
          } else if (huddleContent.participantsFromChat.length > 0) {
            resolvedParticipants = huddleContent.participantsFromChat
          } else {
            resolvedParticipants = [displayName]
          }
          addActivity(byDay, seen, `CALL_SUMMARY:${channelId}:${msg.ts}`, {
            type: 'CALL_SUMMARY',
            channel: channelId,
            channelName,
            author: displayName,
            createdAt: iso,
            metadata: {
              title: room?.name || 'Círculo',
              callType: 'channel_huddle',
              hasEnded: room?.has_ended ?? false,
              participants: resolvedParticipants,
              chatMessages: huddleContent.chatMessages.length > 0 ? huddleContent.chatMessages : undefined,
              aiNotes: huddleContent.aiNotes,
              aiNotesAvailable: huddleContent.aiNotesAvailable,
              threadTs: msg.ts,
            },
          })
        }
      } else if (isAiCallSummary) {
        addActivity(byDay, seen, `CALL_SUMMARY:${channelId}:${msg.ts}`, {
          type: 'CALL_SUMMARY',
          channel: channelId,
          channelName,
          author: displayName,
          createdAt: iso,
          metadata: {
            title: `Resumo IA — ${botName}`,
            summary: msg.text,
            callType: 'ai_summary',
          },
        })
      }

      if (msg.user !== userId) continue

      // skip purely deleted messages (subtype but no text)
      if (msg.subtype === 'message_deleted') continue

      // detect type
      let type: SlackActivityType
      if (msg.thread_ts && msg.thread_ts !== msg.ts) {
        type = 'THREAD_REPLY'
      } else if (msg.thread_ts === msg.ts && (msg.reply_count ?? 0) > 0) {
        type = 'THREAD_STARTED'
      } else if (msg.edited) {
        type = 'MESSAGE_EDITED'
      } else {
        type = 'MESSAGE_SENT'
      }

      const meta: Record<string, unknown> = { text: msg.text }
      if (msg.thread_ts) meta.threadTs = msg.thread_ts
      if (msg.edited) meta.editedAt = tsToIso(msg.edited.ts)

      addActivity(byDay, seen, `${type}:${channelId}:${msg.ts}`, {
        type,
        channel: channelId,
        channelName,
        author: displayName,
        createdAt: iso,
        metadata: meta,
      })

      // reactions received on user's own messages
      for (const rxn of msg.reactions ?? []) {
        addActivity(byDay, seen, `REACTION_RECEIVED:${channelId}:${msg.ts}:${rxn.name}`, {
          type: 'REACTION_RECEIVED',
          channel: channelId,
          channelName,
          author: displayName,
          createdAt: iso,
          metadata: {
            reaction: rxn.name,
            count: rxn.count,
            reactors: rxn.users.slice(0, 10),
            messageText: msg.text?.slice(0, 200),
          },
        })
      }
    }

    // Diagnostic summary for this channel
    const subtypeSummary = [...subtypesSeen.entries()].map(([k, v]) => `${k}:${v}`).join(', ')
    const channelActivitiesAdded = [...byDay.values()].flat().filter(a => a.channel === channelId).length
    step(`🟢 Slack — ${channelName}: subtypes=[${subtypeSummary || 'nenhum'}] | call-like=${callLikeCount} | huddles=${channelHuddleTs.size} | threads candidatos=${threadCandidates.size} | atividades adicionadas=${channelActivitiesAdded}`)

    // ── THREAD ANALYSIS → DISCUSSION CIRCUITS ─────────────────────────────
    // Skip threads already captured as CALL_SUMMARY (huddles)
    const threadTsList = [...threadCandidates].filter((ts) => !channelHuddleTs.has(ts))
    if (threadTsList.length === 0) {
      step(`🟢 Slack — ${channelName}: sem threads para analisar`)
      return
    }

    step(`🟢 Slack — ${channelName}: analisando ${threadTsList.length} thread(s) candidata(s)...`)

    const threadTasks = threadTsList.map((threadTs) => async () => {
      let replies: RawMessage[] = []
      try {
        replies = await paginateReplies(client, channelId, threadTs)
      } catch {
        return
      }

      const realReplies = replies.filter(
        (m) => m.subtype !== 'tombstone' && m.subtype !== 'huddle_thread' && m.text && m.user !== 'USLACKBOT'
      )
      if (realReplies.length < 2) return

      if (!realReplies.some((m) => m.user === userId)) return

      const participantIds = [...new Set(realReplies.map((m) => m.user).filter(Boolean) as string[])]
      if (participantIds.length < 2) return

      const participantNames = await Promise.all(
        participantIds.map((uid) => resolveUserName(client, uid, userNameCache))
      )

      const chatReplies = realReplies.filter((m) => !m.bot_id && m.subtype !== 'bot_message')
      const firstTs = chatReplies[0]?.ts ?? realReplies[0].ts
      const lastTs = chatReplies[chatReplies.length - 1]?.ts ?? realReplies[realReplies.length - 1].ts
      const durationMinutes = Math.round((parseFloat(lastTs) - parseFloat(firstTs)) / 60)

      const userMsgCount = chatReplies.filter((m) => m.user === userId).length
      const firstIso = tsToIso(firstTs)
      const firstDay = isoDate(firstIso)
      if (firstDay < startDate || firstDay > endDate) return

      let aiSummary: string | undefined
      for (const m of realReplies) {
        if (m.user === 'USLACKBOT' || m.bot_id || m.subtype === 'bot_message') {
          const bName = (m.bot_profile?.name ?? '').toLowerCase()
          const txt = m.text ?? ''
          const isAiMsg = (bName.includes('slack ai') || bName.includes('summary') || bName.includes('slackbot') || m.user === 'USLACKBOT') && txt.length > 30
          if (isAiMsg) { aiSummary = txt; break }
        }
      }

      const chatMessages = await Promise.all(
        chatReplies.map(async (m) => ({
          author: m.user ? await resolveUserName(client, m.user, userNameCache) : 'bot',
          text: m.text ?? '',
          createdAt: tsToIso(m.ts),
          isUser: m.user === userId,
        }))
      )

      addActivity(byDay, seen, `DISCUSSION_CIRCUIT:${channelId}:${threadTs}`, {
        type: 'DISCUSSION_CIRCUIT',
        channel: channelId,
        channelName,
        author: displayName,
        createdAt: firstIso,
        metadata: {
          threadTs,
          durationMinutes,
          participants: participantNames,
          messageCount: chatReplies.length,
          userMessageCount: userMsgCount,
          firstMessage: (chatReplies[0]?.text ?? '').slice(0, 300),
          aiSummary,
          chatMessages,
        },
      })
    })

    await runWithConcurrency(threadTasks, THREAD_CONCURRENCY)
    const finalCount = [...byDay.values()].flat().filter(a => a.channel === channelId).length
    step(`🟢 Slack — ✅ ${channelName}: processamento concluído — ${finalCount} atividade(s) total`)
  })

  await runWithConcurrency(channelTasks, CHANNEL_CONCURRENCY)

  // ── DMs + GROUP DMs (MPIM) ──────────────────────────────────────────────
  if (includeDms) {
    step(`🟢 Slack — buscando DMs e grupos de DM...`)
    try {
      const dmChannels: Array<{ id: string; user?: string; is_mpim?: boolean; name?: string }> = []
      let cursor: string | undefined

      do {
        const res = await callWithRetry(() =>
          client.get<{
            ok: boolean
            channels?: Array<{ id: string; user?: string; is_mpim?: boolean; name?: string }>
            response_metadata?: { next_cursor?: string }
          }>(
            '/conversations.list',
            { params: { types: 'im,mpim', limit: 200, exclude_archived: true, ...(cursor ? { cursor } : {}) } }
          )
        )
        if (!res.data.ok) break
        dmChannels.push(...(res.data.channels ?? []))
        cursor = res.data.response_metadata?.next_cursor || undefined
      } while (cursor)

      step(`🟢 Slack — ${dmChannels.length} DM/MPIM encontrado(s)`)

      const dmTasks = dmChannels.map((dm) => async () => {
        let otherName: string
        if (dm.is_mpim && dm.name) {
          otherName = dm.name.replace(/^mpdm-/, '').replace(/-+/g, ', ')
        } else if (dm.user) {
          otherName = await resolveUserName(client, dm.user, userNameCache)
        } else {
          otherName = dm.id
        }
        const dmChannelName = dm.is_mpim ? `Grupo: ${otherName}` : `DM: ${otherName}`

        let messages: RawMessage[] = []
        try {
          messages = await paginateHistory(client, dm.id, oldest, latest)
        } catch {
          return
        }

        const dmThreadCandidates = new Set<string>()
        const dmHuddleTs = new Set<string>()
        const dmSubtypesSeen = new Map<string, number>()
        let dmCallLikeCount = 0

        for (const msg of messages) {
          if (!msg.ts) continue
          if (msg.subtype === 'message_deleted' || msg.subtype === 'tombstone') continue

          // Diagnostic: count all subtypes in DMs
          const dmSub = msg.subtype ?? (msg.call ? '__has_call__' : msg.room ? '__has_room__' : '__none__')
          dmSubtypesSeen.set(dmSub, (dmSubtypesSeen.get(dmSub) ?? 0) + 1)
          if (msg.call || msg.room || dmSub.includes('call') || dmSub.includes('huddle')) {
            dmCallLikeCount++
            step(`🟢 Slack — ${dmChannelName} [DIAGNÓSTICO CHAMADA] subtype=${msg.subtype ?? 'none'} user=${msg.user ?? 'none'} hasCall=${!!msg.call} hasRoom=${!!msg.room} ts=${msg.ts} text=${(msg.text ?? '').slice(0, 60)}`)
          }

          const iso = tsToIso(msg.ts)
          const day = isoDate(iso)
          if (day < startDate || day > endDate) continue

          // Collect thread roots as circuit candidates
          const dmIsHuddleSub = ['huddle_thread', 'sh_room_created', 'sh_room_ended', 'sh_room_joined'].includes(msg.subtype ?? '')
          if (msg.thread_ts === msg.ts && (msg.reply_count ?? 0) > 0 && !dmIsHuddleSub) {
            dmThreadCandidates.add(msg.ts)
          }
          if (msg.thread_ts && msg.thread_ts !== msg.ts) {
            dmThreadCandidates.add(msg.thread_ts)
          }
          if (dmIsHuddleSub || msg.room) {
            dmThreadCandidates.add(msg.ts)
          }

          // ── CALL / HUDDLE DETECTION ────────────────────────────────────
          const isCallEnded = msg.subtype === 'call_ended' && !!msg.call?.v1
          const dmMsgTextLower = (msg.text ?? '').toLowerCase()
          const isHuddle = dmIsHuddleSub || !!msg.room || (!msg.user && (
            dmMsgTextLower.includes('círculo') || dmMsgTextLower.includes('huddle') || dmMsgTextLower.includes('circle')
          ))
          const botName = (msg.bot_profile?.name ?? '').toLowerCase()
          const isAiCallSummary =
            (msg.subtype === 'bot_message' || !!msg.bot_id) &&
            (botName.includes('slack ai') || botName.includes('ai notes') || botName.includes('slackbot') || botName.includes('summary')) &&
            (dmMsgTextLower.includes('summary') || dmMsgTextLower.includes('transcript') ||
              dmMsgTextLower.includes('resumo') || dmMsgTextLower.includes('transcrição') ||
              dmMsgTextLower.includes('call') || dmMsgTextLower.includes('chamada') ||
              dmMsgTextLower.includes('huddle') || dmMsgTextLower.includes('círculo'))

          if (isCallEnded) {
            const call = msg.call!.v1!
            const participants = (call.participants?.map((p) => p.slack_id) ?? []).filter(Boolean) as string[]
            const durationMin = call.duration ? Math.round(call.duration / 60) : undefined
            step(`🟢 Slack — ${dmChannelName} [CALL_ENDED] duration=${durationMin}min participants=${JSON.stringify(participants)}`)
            addActivity(byDay, seen, `CALL_SUMMARY:${dm.id}:${msg.ts}`, {
              type: 'CALL_SUMMARY',
              channel: dm.id,
              channelName: dmChannelName,
              author: displayName,
              createdAt: iso,
              metadata: {
                title: call.title || 'Chamada',
                durationMinutes: durationMin,
                callType: dm.is_mpim ? 'group_call' : 'call',
                participants: participants.length > 0
                  ? await Promise.all(participants.map((id) => resolveUserName(client, id, userNameCache)))
                  : [displayName],
              },
            })
          } else if (isHuddle) {
            const room = msg.room
            const roomParticipants = (room?.participant_history?.map((p) => p.slack_id) ?? []).filter(Boolean) as string[]
            step(`🟢 Slack — ${dmChannelName} [HUDDLE] ts=${msg.ts} hasEnded=${room?.has_ended} participants=${JSON.stringify(roomParticipants)}`)
            dmHuddleTs.add(msg.ts)
            const huddleContent = await fetchHuddleThreadContent(client, dm.id, msg.ts, userId, room, userNameCache)
            let dmResolvedParticipants: string[]
            if (roomParticipants.length > 0) {
              dmResolvedParticipants = await Promise.all(roomParticipants.map((id) => resolveUserName(client, id, userNameCache)))
            } else if (huddleContent.participantsFromChat.length > 0) {
              dmResolvedParticipants = huddleContent.participantsFromChat
            } else {
              dmResolvedParticipants = [displayName]
            }
            addActivity(byDay, seen, `CALL_SUMMARY:${dm.id}:${msg.ts}`, {
              type: 'CALL_SUMMARY',
              channel: dm.id,
              channelName: dmChannelName,
              author: displayName,
              createdAt: iso,
              metadata: {
                title: room?.name || (dm.is_mpim ? 'Círculo em grupo' : 'Círculo'),
                callType: dm.is_mpim ? 'group_huddle' : 'huddle',
                hasEnded: room?.has_ended ?? false,
                participants: dmResolvedParticipants,
                chatMessages: huddleContent.chatMessages.length > 0 ? huddleContent.chatMessages : undefined,
                aiNotes: huddleContent.aiNotes,
                aiNotesAvailable: huddleContent.aiNotesAvailable,
                threadTs: msg.ts,
              },
            })
          } else if (isAiCallSummary) {
            addActivity(byDay, seen, `CALL_SUMMARY:${dm.id}:${msg.ts}`, {
              type: 'CALL_SUMMARY',
              channel: dm.id,
              channelName: dmChannelName,
              author: displayName,
              createdAt: iso,
              metadata: {
                title: `Resumo IA — ${botName}`,
                summary: msg.text,
                callType: 'ai_summary',
              },
            })
          }

          if (!msg.user) continue

          if (msg.user === userId) {
            addActivity(byDay, seen, `DM_SENT:${dm.id}:${msg.ts}`, {
              type: 'DM_SENT',
              channel: dm.id,
              channelName: dmChannelName,
              author: displayName,
              createdAt: iso,
              metadata: {
                text: msg.text,
                to: otherName,
                ...(msg.edited ? { editedAt: tsToIso(msg.edited.ts) } : {}),
              },
            })
          } else {
            const senderName = await resolveUserName(client, msg.user, userNameCache)
            addActivity(byDay, seen, `DM_RECEIVED:${dm.id}:${msg.ts}`, {
              type: 'DM_RECEIVED',
              channel: dm.id,
              channelName: dmChannelName,
              author: senderName,
              createdAt: iso,
              metadata: {
                text: msg.text,
                from: senderName,
                ...(msg.edited ? { editedAt: tsToIso(msg.edited.ts) } : {}),
              },
            })
          }
        }

        // Diagnostic summary for this DM
        if (dmSubtypesSeen.size > 0) {
          const sub = [...dmSubtypesSeen.entries()].map(([k, v]) => `${k}:${v}`).join(', ')
          step(`🟢 Slack — ${dmChannelName}: subtypes=[${sub}] | call-like=${dmCallLikeCount} | thread candidates=${dmThreadCandidates.size}`)
        }

        // ── DM CIRCUIT ANALYSIS ──────────────────────────────────────────
        if (dmThreadCandidates.size === 0) return
        step(`🟢 Slack — ${dmChannelName}: analisando ${dmThreadCandidates.size} thread(s)...`)

        // Skip threads already captured as CALL_SUMMARY (huddles)
        const dmCircuitTasks = [...dmThreadCandidates]
          .filter((ts) => !dmHuddleTs.has(ts))
          .map((threadTs) => async () => {
            let replies: RawMessage[] = []
            try { replies = await paginateReplies(client, dm.id, threadTs) } catch { return }

            const realReplies = replies.filter(
              (m) => m.subtype !== 'tombstone' && m.subtype !== 'huddle_thread' && m.text && m.user !== 'USLACKBOT'
            )
            if (realReplies.length < 2) return
            if (!realReplies.some((m) => m.user === userId)) return

            const participantIds = [...new Set(realReplies.map((m) => m.user).filter(Boolean) as string[])]
            if (participantIds.length < 2) return

            const participantNames = await Promise.all(
              participantIds.map((uid) => resolveUserName(client, uid, userNameCache))
            )

            const chatReplies = realReplies.filter((m) => !m.bot_id && m.subtype !== 'bot_message')
            const firstTs = chatReplies[0]?.ts ?? realReplies[0].ts
            const lastTs = chatReplies[chatReplies.length - 1]?.ts ?? realReplies[realReplies.length - 1].ts
            const durationMinutes = Math.round((parseFloat(lastTs) - parseFloat(firstTs)) / 60)

            const firstIso = tsToIso(firstTs)
            const firstDay = isoDate(firstIso)
            if (firstDay < startDate || firstDay > endDate) return

            let aiSummary: string | undefined
            for (const m of realReplies) {
              if (m.user === 'USLACKBOT' || m.bot_id || m.subtype === 'bot_message') {
                const bName = (m.bot_profile?.name ?? '').toLowerCase()
                const txt = m.text ?? ''
                if ((bName.includes('slack ai') || bName.includes('summary') || bName.includes('slackbot') || m.user === 'USLACKBOT') && txt.length > 30) {
                  aiSummary = txt; break
                }
              }
            }

            const chatMessages = await Promise.all(
              chatReplies.map(async (m) => ({
                author: m.user ? await resolveUserName(client, m.user, userNameCache) : 'bot',
                text: m.text ?? '',
                createdAt: tsToIso(m.ts),
                isUser: m.user === userId,
              }))
            )

            addActivity(byDay, seen, `DISCUSSION_CIRCUIT:${dm.id}:${threadTs}`, {
              type: 'DISCUSSION_CIRCUIT',
              channel: dm.id,
              channelName: dmChannelName,
              author: displayName,
              createdAt: firstIso,
              metadata: {
                threadTs,
                durationMinutes,
                participants: participantNames,
                messageCount: chatReplies.length,
                userMessageCount: chatReplies.filter((m) => m.user === userId).length,
                firstMessage: (chatReplies[0]?.text ?? '').slice(0, 300),
                aiSummary,
                chatMessages,
              },
            })
          })

        await runWithConcurrency(dmCircuitTasks, THREAD_CONCURRENCY)
      })

      await runWithConcurrency(dmTasks, CHANNEL_CONCURRENCY)
    } catch (err) {
      step(`🟢 Slack — aviso: erro ao buscar DMs: ${(err as Error).message}`)
    }
  }

  // ── SORT EACH DAY CHRONOLOGICALLY ───────────────────────────────────────
  for (const [day, activities] of byDay.entries()) {
    byDay.set(day, activities.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  }

  const total = [...byDay.values()].reduce((n, arr) => n + arr.length, 0)
  step(`🟢 Slack — ${total} atividade(s) extraída(s) em ${byDay.size} dia(s)`)

  return byDay
}
