/** Shared state for the auth forms. Lives outside actions.ts because a 'use server' module may only export async functions. */
export type FormState = { error: string | null }

export const emptyFormState: FormState = { error: null }

/** State for the answer box on the case file. */
export type SolveState = {
  ok: boolean
  message: string | null
  fragment: string | null
}

export const emptySolveState: SolveState = { ok: false, message: null, fragment: null }
