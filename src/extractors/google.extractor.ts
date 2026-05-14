import { google } from 'googleapis'
import axios from 'axios'
import { GoogleActivity } from '../types/report.types'
import { step } from '../logger'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ''
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth/google/callback'

function buildOAuth2Client(accessToken: string, refreshToken: string) {
  const client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  return client
}

function dateToKey(iso: string): string {
  return iso.slice(0, 10)
}

function durationMinutes(start: string, end: string): number {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Math.round(diff / 60000)
}

/**
 * Fetches Google Calendar events for the given date range.
 * Returns activities grouped by day.
 */
async function extractCalendarEvents(
  accessToken: string,
  refreshToken: string,
  startDate: string,
  endDate: string
): Promise<Map<string, GoogleActivity[]>> {
  const byDay = new Map<string, GoogleActivity[]>()

  try {
    const auth = buildOAuth2Client(accessToken, refreshToken)
    const cal = google.calendar({ version: 'v3', auth })

    const res = await cal.events.list({
      calendarId: 'primary',
      timeMin: `${startDate}T00:00:00Z`,
      timeMax: `${endDate}T23:59:59Z`,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
    })

    const events = res.data.items ?? []
    const cancelled = events.filter((e) => e.status === 'cancelled').length
    step(`📅 Google Calendar — ${events.length} evento(s) bruto(s) | ${cancelled} cancelado(s) | range UTC: ${startDate}T00:00:00Z → ${endDate}T23:59:59Z`)

    for (const event of events) {
      if (event.status === 'cancelled') continue

      const selfAttendee = (event.attendees ?? []).find((a) => a.self)
      if (selfAttendee?.responseStatus === 'declined') continue

      const startIso = event.start?.dateTime ?? event.start?.date ?? ''
      const endIso = event.end?.dateTime ?? event.end?.date ?? ''
      const day = dateToKey(startIso || new Date().toISOString())

      const attendees = (event.attendees ?? [])
        .filter((a) => !a.self && a.responseStatus !== 'declined')
        .map((a) => a.displayName ?? a.email ?? '')
        .filter(Boolean)

      const userResponseStatus = selfAttendee?.responseStatus ?? (event.organizer?.self ? 'accepted' : 'needsAction')

      const organizer = event.organizer?.displayName ?? event.organizer?.email ?? ''

      const activity: GoogleActivity = {
        type: 'CALENDAR_EVENT',
        title: event.summary ?? '(sem título)',
        author: organizer,
        createdAt: startIso,
        metadata: {
          eventId: event.id,
          start: startIso,
          end: endIso,
          durationMinutes: startIso && endIso ? durationMinutes(startIso, endIso) : undefined,
          attendees,
          attendeeCount: (event.attendees ?? []).length,
          description: event.description?.slice(0, 500),
          location: event.location,
          htmlLink: event.htmlLink,
          isOnlineMeeting: !!(event.conferenceData || (event.location ?? '').includes('meet.google')),
          meetLink: event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri,
          status: event.status,
          userResponseStatus,
          recurringEventId: event.recurringEventId,
        },
      }

      const existing = byDay.get(day) ?? []
      existing.push(activity)
      byDay.set(day, existing)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    step(`⚠️ Google Calendar — erro ao buscar eventos: ${msg}`)
  }

  return byDay
}

interface MeetParticipant {
  displayName: string
  email?: string
}

interface TranscriptEntry {
  participantName: string
  text: string
  startTime: string
}

/**
 * Fetches participants for a conference record via the Meet REST API.
 */
async function fetchMeetParticipants(recordName: string, accessToken: string): Promise<MeetParticipant[]> {
  try {
    const res = await axios.get(
      `https://meet.googleapis.com/v2/${recordName}/participants`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
    )
    const participants = (res.data.participants ?? []) as Array<{ signedinUser?: { displayName?: string; user?: string }; anonymousUser?: { displayName?: string } }>
    return participants.map((p) => ({
      displayName: p.signedinUser?.displayName ?? p.anonymousUser?.displayName ?? 'Desconhecido',
    }))
  } catch {
    return []
  }
}

/**
 * Fetches transcript entries for a conference record, if available.
 */
async function fetchMeetTranscript(recordName: string, accessToken: string): Promise<TranscriptEntry[]> {
  try {
    const transcriptsRes = await axios.get(
      `https://meet.googleapis.com/v2/${recordName}/transcripts`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
    )

    const transcripts = (transcriptsRes.data.transcripts ?? []) as Array<{ name: string }>
    step(`📝 Meet — ${recordName}: ${transcripts.length} transcrição(ões) disponível(eis)`)
    if (transcripts.length === 0) return []

    const entries: TranscriptEntry[] = []

    for (const transcript of transcripts.slice(0, 1)) {
      const entriesRes = await axios.get(
        `https://meet.googleapis.com/v2/${transcript.name}/entries`,
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
      )
      const rawEntries = (entriesRes.data.entries ?? []) as Array<{
        participant?: { signedinUser?: { displayName?: string }; anonymousUser?: { displayName?: string } }
        text?: string
        startTime?: string
      }>

      for (const e of rawEntries) {
        const name = e.participant?.signedinUser?.displayName ?? e.participant?.anonymousUser?.displayName ?? 'Desconhecido'
        entries.push({ participantName: name, text: e.text ?? '', startTime: e.startTime ?? '' })
      }
    }

    return entries
  } catch {
    return []
  }
}

/**
 * Fetches Google Meet conference records for the given date range.
 * Returns activities grouped by day.
 */
async function extractMeetCalls(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Map<string, GoogleActivity[]>> {
  const byDay = new Map<string, GoogleActivity[]>()

  try {
    const filter = `start_time>="${startDate}T00:00:00Z" AND start_time<="${endDate}T23:59:59Z"`
    step(`📹 Google Meet — filtro enviado: ${filter}`)
    const res = await axios.get('https://meet.googleapis.com/v2/conferenceRecords', {
      params: { filter },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    })

    const records = (res.data.conferenceRecords ?? []) as Array<{
      name: string
      startTime?: string
      endTime?: string
      space?: { name?: string; meetingUri?: string }
    }>

    step(`📹 Google Meet — ${records.length} conferência(s) encontrada(s)`)

    for (const record of records) {
      const startIso = record.startTime ?? ''
      const endIso = record.endTime ?? ''
      const day = dateToKey(startIso || new Date().toISOString())
      const dur = startIso && endIso ? durationMinutes(startIso, endIso) : undefined

      const [participants, transcriptEntries] = await Promise.all([
        fetchMeetParticipants(record.name, accessToken),
        fetchMeetTranscript(record.name, accessToken),
      ])

      const activity: GoogleActivity = {
        type: 'MEET_CALL',
        title: `Google Meet — ${new Date(startIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`,
        author: '',
        createdAt: startIso,
        metadata: {
          recordName: record.name,
          start: startIso,
          end: endIso,
          durationMinutes: dur,
          meetingUri: record.space?.meetingUri,
          participants: participants.map((p) => p.displayName),
          participantCount: participants.length,
          transcript: transcriptEntries.length > 0 ? transcriptEntries : undefined,
          transcriptLength: transcriptEntries.length,
        },
      }

      const existing = byDay.get(day) ?? []
      existing.push(activity)
      byDay.set(day, existing)
    }
  } catch (err) {
    const axErr = err as { response?: { status?: number; data?: unknown }; message?: string }
    const status = axErr?.response?.status
    if (status === 403) {
      step(`⚠️ Google Meet — 403 Acesso negado. Verifique: (1) "Google Meet API" habilitada no Cloud Console, (2) escopo meetings.space.readonly autorizado (faça logout e login novamente no Google).`)
      if (axErr?.response?.data) step(`   Detalhe: ${JSON.stringify(axErr.response.data)}`)
    } else if (status === 404) {
      step(`⚠️ Google Meet — 404 Endpoint não encontrado. API pode não estar habilitada no projeto.`)
    } else {
      const msg = axErr?.message ?? String(err)
      step(`⚠️ Google Meet — erro inesperado (status ${status ?? 'sem resposta'}): ${msg}`)
    }
  }

  return byDay
}

function mergeMaps(a: Map<string, GoogleActivity[]>, b: Map<string, GoogleActivity[]>): Map<string, GoogleActivity[]> {
  const result = new Map(a)
  for (const [day, items] of b) {
    const existing = result.get(day) ?? []
    result.set(day, [...existing, ...items])
  }
  return result
}

/**
 * Main entry point: extracts Calendar events and Meet calls, merges by day.
 */
export async function extractGoogleActivities(
  accessToken: string,
  refreshToken: string,
  startDate: string,
  endDate: string
): Promise<Map<string, GoogleActivity[]>> {
  step(`📅 Google — extraindo Calendar e Meet para ${startDate} → ${endDate}`)
  step(`📅 Google — accessToken presente: ${!!accessToken} (${accessToken?.slice(0, 20)}...) | refreshToken presente: ${!!refreshToken}`)

  try {
    const auth = buildOAuth2Client(accessToken, refreshToken)
    const oauth2 = google.oauth2({ version: 'v2', auth })
    const info = await oauth2.userinfo.get()
    step(`📅 Google — conta autenticada: ${info.data.email}`)
  } catch (e) {
    step(`⚠️ Google — falha ao verificar conta: ${e instanceof Error ? e.message : String(e)}`)
  }

  const [calendarByDay, meetByDay] = await Promise.all([
    extractCalendarEvents(accessToken, refreshToken, startDate, endDate),
    extractMeetCalls(accessToken, startDate, endDate),
  ])

  const merged = mergeMaps(calendarByDay, meetByDay)
  const total = [...merged.values()].reduce((n, v) => n + v.length, 0)
  step(`📅 Google — ${total} atividade(s) extraída(s) no total`)

  return merged
}
