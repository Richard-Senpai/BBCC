import { redirect } from 'next/navigation'
import { getHomeData } from '@/lib/actions/home'
import AppTopBar from '@/components/AppTopBar'
import HomeHeroCard from '@/components/home/HomeHeroCard'
import HomeQuickStatsComponent from '@/components/home/HomeQuickStats'
import HomeMyCourses from '@/components/home/HomeMyCourses'
import HomeAwaitingApproval from '@/components/home/HomeAwaitingApproval'
import HomeCompletedSection from '@/components/home/HomeCompletedSection'
import HomeAnnouncementCard from '@/components/home/HomeAnnouncementCard'
import HomeCommunityCard from '@/components/home/HomeCommunityCard'
import HomeWelcomeCard from '@/components/home/HomeWelcomeCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const homeData = await getHomeData()

  if (!homeData) {
    redirect('/login')
  }

  const { profile } = homeData

  // Admin users are routed to /admin
  if (profile.role === 'admin') {
    redirect('/admin')
  }

  // Pending or rejected members must wait at holding page
  if (profile.status === 'pending' || profile.status === 'rejected') {
    redirect('/pending')
  }

  const firstName = profile.full_name?.trim().split(' ')[0] || 'Friend'

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] transition-colors">
      <div className="max-w-md mx-auto pb-24">
        {/* Shared Top App Bar */}
        <AppTopBar
          profile={profile}
          isHome={true}
          unreadAnnouncementsCount={homeData.unreadAnnouncementsCount}
        />

        {/* Brand-new Member Welcome Experience */}
        {homeData.isBrandNewMember ? (
          <>
            <HomeWelcomeCard firstName={firstName} />
            <HomeCommunityCard />
            <HomeAnnouncementCard announcement={homeData.latestAnnouncement} />
          </>
        ) : (
          <>
            {/* Hero Card */}
            <HomeHeroCard heroData={homeData.heroData} />

            {/* Section 1: Quick Stats */}
            <HomeQuickStatsComponent stats={homeData.quickStats} />

            {/* Section 3: Awaiting Approval (if any) */}
            <HomeAwaitingApproval pendingRequests={homeData.pendingRequests} />

            {/* Section 2: In-Progress Courses */}
            <HomeMyCourses courses={homeData.inProgressCourses} />

            {/* Section 5: Latest Pastoral Announcement */}
            <HomeAnnouncementCard announcement={homeData.latestAnnouncement} />

            {/* Section 6: Community Fellowship Shortcut */}
            <HomeCommunityCard />

            {/* Section 4: Completed Milestones */}
            <HomeCompletedSection
              completedItems={homeData.completedItems}
              totalCompletedCount={homeData.totalCompletedCount}
            />
          </>
        )}
      </div>
    </div>
  )
}
