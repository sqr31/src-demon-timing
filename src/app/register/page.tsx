import { redirect } from 'next/navigation'
import { RegisterForm } from './register-form'
import { safeNext } from '@/lib/paths'
import { getSessionPlayerId } from '@/lib/session'

export const metadata = { title: 'Register · The Hunt' }

export default async function RegisterPage(props: PageProps<'/register'>) {
  const { next } = await props.searchParams
  const destination = safeNext(next)

  if (await getSessionPlayerId()) redirect(destination)

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
      <h1 className="text-3xl font-bold">Join the hunt</h1>
      <p className="mt-1 mb-8 text-muted">Six stages. One fragment each.</p>
      <RegisterForm next={destination} />
    </main>
  )
}
