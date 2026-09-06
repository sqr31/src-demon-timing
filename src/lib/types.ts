export type SolveType = 'qr' | 'answer'

export type Player = {
  id: string
  student_id: string
  display_name: string
  pin_hash: string
  created_at: string
}

export type Component = {
  id: string
  stage: number
  position: number
  title: string
  clue_text: string
  solve_type: SolveType
  qr_token: string | null
  answer: string | null
  release_at: string
  hint_text: string
  hint_released: boolean
  fragment: string | null
}

export type Progress = {
  id: string
  player_id: string
  component_id: string
  solved_at: string
}
