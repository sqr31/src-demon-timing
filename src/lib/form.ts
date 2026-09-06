/** Shared state for the auth forms. Lives outside actions.ts because a 'use server' module may only export async functions. */
export type FormState = { error: string | null }

export const emptyFormState: FormState = { error: null }
