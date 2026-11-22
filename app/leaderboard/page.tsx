import { redirect } from 'next/navigation'

interface LeaderboardPageProps {
  searchParams?: Promise<{
    challenge?: string
  }>
}

export default async function LeaderboardRedirectPage({
  searchParams,
}: LeaderboardPageProps) {
  const resolved = searchParams ? await searchParams : {}
  const challengeParam = resolved.challenge ? `&challenge=${resolved.challenge}` : ''
  redirect(`/dashboard?tab=leaderboard${challengeParam}`)
}
