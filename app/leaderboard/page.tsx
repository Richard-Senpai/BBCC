import BBCCLogo from '@/components/BBCCLogo'

export default function LeaderboardPage() {
  return (
    <div className="px-4 py-12 text-center">
      <BBCCLogo size="md" className="mx-auto mb-4" />
      <h1 className="text-xl font-bold text-gray-900 mb-2">Leaderboard</h1>
      <p className="text-sm text-gray-500">
        The fellowship leaderboard is coming soon. Keep consecrating — your
        progress is being recorded!
      </p>
    </div>
  )
}
