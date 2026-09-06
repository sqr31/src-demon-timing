import 'server-only'
import QRCode from 'qrcode'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { formatDuration, fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'
import { stageReached } from '@/lib/rules'
import type { Component } from '@/lib/types'

export type AdminPlayerRow = {
  id: string
  studentId: string
  displayName: string
  /** What they are working on now, or null once they have finished. */
  currentLabel: string | null
  stage: number | null
  /** How long since they started the current one: their last solve, else sign-up. */
  onItFor: string
  lastSolveAt: string | null
}

export type AdminComponentRow = {
  id: string
  stage: number
  position: number
  title: string
  clueText: string
  hintText: string
  hintReleased: boolean
  releaseAt: string
  /** The same instant as the local value a datetime-local input expects. */
  releaseAtLocal: string
  solveType: 'qr' | 'answer'
  qrToken: string | null
  answer: string | null
  fragment: string | null
  /** The scan URL as an inline SVG, ready to print. */
  qrSvg: string | null
  scanUrl: string | null
}

export type AdminSolveRow = {
  solvedAt: string
  displayName: string
  componentLabel: string
}

export type AdminData = {
  players: AdminPlayerRow[]
  components: AdminComponentRow[]
  solves: AdminSolveRow[]
}

async function componentsInOrder(): Promise<Component[]> {
  const { data, error } = await db()
    .from('components')
    .select('*')
    .order('stage')
    .order('position')

  if (error) throw error
  return (data ?? []) as Component[]
}

export async function loadAdminData(origin: string): Promise<AdminData> {
  await requireAdmin()

  const now = Date.now()
  const client = db()
  const [componentsResult, playersResult, progressResult, recentResult] = await Promise.all([
    componentsInOrder(),
    client.from('players').select('*').order('created_at').range(0, 9999),
    client.from('progress').select('player_id, component_id, solved_at').range(0, 49999),
    client
      .from('progress')
      .select('solved_at, player_id, component_id')
      .order('solved_at', { ascending: false })
      .limit(100),
  ])

  if (playersResult.error) throw playersResult.error
  if (progressResult.error) throw progressResult.error
  if (recentResult.error) throw recentResult.error

  const components = componentsResult
  const byComponentId = new Map(components.map((component) => [component.id, component]))

  type Row = { player_id: string; component_id: string; solved_at: string }
  const solvesByPlayer = new Map<string, Row[]>()
  for (const row of (progressResult.data ?? []) as Row[]) {
    const list = solvesByPlayer.get(row.player_id)
    if (list) list.push(row)
    else solvesByPlayer.set(row.player_id, [row])
  }

  const players: AdminPlayerRow[] = (playersResult.data ?? []).map((player) => {
    const solves = solvesByPlayer.get(player.id as string) ?? []
    const lastSolveAt = solves.reduce<string | null>(
      (latest, row) => (!latest || row.solved_at > latest ? row.solved_at : latest),
      null,
    )
    const next = components[solves.length]

    return {
      id: player.id as string,
      studentId: player.student_id as string,
      displayName: player.display_name as string,
      currentLabel: next ? `Stage ${next.stage}.${next.position} ${next.title}` : null,
      stage: stageReached(components, solves.length),
      onItFor: formatDuration(lastSolveAt ?? (player.created_at as string), now),
      lastSolveAt,
    }
  })

  const componentRows: AdminComponentRow[] = await Promise.all(
    components.map(async (component) => {
      const scanUrl = component.qr_token ? `${origin}/s/${component.qr_token}` : null
      return {
        id: component.id,
        stage: component.stage,
        position: component.position,
        title: component.title,
        clueText: component.clue_text,
        hintText: component.hint_text,
        hintReleased: component.hint_released,
        releaseAt: component.release_at,
        releaseAtLocal: toDateTimeLocal(component.release_at),
        solveType: component.solve_type,
        qrToken: component.qr_token,
        answer: component.answer,
        fragment: component.fragment,
        scanUrl,
        qrSvg: scanUrl
          ? await QRCode.toString(scanUrl, { type: 'svg', margin: 1, width: 220 })
          : null,
      }
    }),
  )

  const playerNames = new Map(players.map((player) => [player.id, player.displayName]))
  const solves: AdminSolveRow[] = (recentResult.data ?? []).map((row) => {
    const component = byComponentId.get(row.component_id as string)
    return {
      solvedAt: row.solved_at as string,
      displayName: playerNames.get(row.player_id as string) ?? 'Unknown player',
      componentLabel: component
        ? `Stage ${component.stage}.${component.position} ${component.title}`
        : 'Unknown component',
    }
  })

  return { players, components: componentRows, solves }
}

export async function updateComponent(input: {
  componentId: string
  clueText: string
  hintText: string
  hintReleased: boolean
  releaseLocal: string
}): Promise<void> {
  await requireAdmin()

  const { error } = await db()
    .from('components')
    .update({
      clue_text: input.clueText,
      hint_text: input.hintText,
      hint_released: input.hintReleased,
      release_at: fromDateTimeLocal(input.releaseLocal),
    })
    .eq('id', input.componentId)

  if (error) throw error
}

export async function resetPin(playerId: string, pin: string): Promise<void> {
  await requireAdmin()

  if (!/^\d{4,6}$/.test(pin.trim())) throw new Error('A PIN is 4 to 6 digits.')

  const { error } = await db()
    .from('players')
    .update({ pin_hash: await hash(pin.trim(), 10) })
    .eq('id', playerId)

  if (error) throw error
}
