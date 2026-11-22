import { redirect } from 'next/navigation'

interface ProgressPageProps {
  searchParams?: Promise<{
    challenge?: string
  }>
}

export default async function ProgressRedirectPage({
  searchParams,
}: ProgressPageProps) {
  const resolved = searchParams ? await searchParams : {}
  const challengeParam = resolved.challenge ? `&challenge=${resolved.challenge}` : ''
  redirect(`/dashboard?tab=progress${challengeParam}`)
}
