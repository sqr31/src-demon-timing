import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'
import { safeNext } from '@/lib/paths'
import { getSessionPlayerId } from '@/lib/session'

export const metadata = { title: 'Log in · The Hunt' }

export default async function LoginPage(props: PageProps<'/login'>) {
  const { next } = await props.searchParams
  const destination = safeNext(next)

  if (await getSessionPlayerId()) redirect(destination)

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
      <h1 className="text-3xl font-bold">The Hunt</h1>
      <p className="mt-1 mb-8 text-muted">Log in to open your case file.</p>
      <LoginForm next={destination} />
    </main>
  )
}
