'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { signInAdmin, signOutAdmin } from '@/lib/admin'
import { resetPin, updateComponent } from '@/lib/admin-data'
import { type FormState, type SaveState } from '@/lib/form'

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export async function adminSignIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await signInAdmin(field(formData, 'password'))
  if (!result.ok) return { error: result.error ?? 'Wrong password.' }

  redirect('/admin')
}

export async function adminSignOut() {
  await signOutAdmin()
  redirect('/admin')
}

export async function saveComponent(_prev: SaveState, formData: FormData): Promise<SaveState> {
  try {
    await updateComponent({
      componentId: field(formData, 'componentId'),
      clueText: field(formData, 'clueText'),
      hintText: field(formData, 'hintText'),
      hintReleased: formData.get('hintReleased') === 'on',
      releaseLocal: field(formData, 'releaseAt'),
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save that.', saved: false }
  }

  refresh()
  return { error: null, saved: true }
}

export async function savePin(_prev: SaveState, formData: FormData): Promise<SaveState> {
  try {
    await resetPin(field(formData, 'playerId'), field(formData, 'pin'))
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not reset that PIN.',
      saved: false,
    }
  }

  refresh()
  return { error: null, saved: true }
}
