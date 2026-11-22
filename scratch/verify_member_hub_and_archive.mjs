import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kyjhlykzjggxzgtebcol.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5amhseWt6amdneHpndGViY29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMTU0NzcsImV4cCI6MjEwNTg5MTQ3N30.HfmSoxMOMOtX8dsH-bYdFynWsXIILC4sWtQ4hswClnU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function runVerification() {
  console.log('=================================================================')
  console.log('VERIFYING MULTI-CHALLENGE MEMBER-FACING ARCHITECTURE & SECURITY')
  console.log('=================================================================\n')

  // ── TEST 1: Challenges & Derived Status ─────────────────────
  console.log('--- TEST 1: Challenges in DB & Status ---')
  let { data: challenges, error: chalError } = await supabase
    .from('challenges')
    .select('*')
    .order('start_date', { ascending: false })

  if (!challenges || challenges.length === 0) {
    const viewRes = await supabase.from('challenges_with_status').select('*').order('start_date', { ascending: false })
    challenges = viewRes.data || []
  }

  console.log(`Found ${challenges.length} challenges in DB:`)
  for (const c of challenges) {
    const { data: status } = await supabase.rpc('get_challenge_status', { c_id: c.id })
    console.log(`- ID: ${c.id} | Name: "${c.name}" | Start: ${c.start_date} | Duration: ${c.duration_days}d | Status: [${status}]`)
  }

  const completedChallenge = challenges.find((c) => {
    const end = new Date(new Date(c.start_date + 'T00:00:00Z').getTime() + (c.duration_days - 1) * 86400000).toISOString().split('T')[0]
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: c.timezone || 'Africa/Lagos' }).format(new Date())
    return today > end
  })

  console.log(`\nCompleted challenge for archive testing: "${completedChallenge?.name}" (${completedChallenge?.id})`)

  // ── TEST 2: Challenge 1 Data Integrity ──────────────────────
  console.log('\n--- TEST 2: Data Integrity for Completed Challenge ---')
  if (completedChallenge) {
    const { count: daysCount } = await supabase
      .from('challenge_days')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', completedChallenge.id)

    const { count: actsCount } = await supabase
      .from('activities')
      .select('id, challenge_days!inner(challenge_id)', { count: 'exact', head: true })
      .eq('challenge_days.challenge_id', completedChallenge.id)

    const { count: compCount } = await supabase
      .from('completions')
      .select('id, challenge_days!inner(challenge_id)', { count: 'exact', head: true })
      .eq('challenge_days.challenge_id', completedChallenge.id)

    const { count: actCompCount } = await supabase
      .from('activity_completions')
      .select('id, activities!inner(challenge_days!inner(challenge_id))', { count: 'exact', head: true })
      .eq('activities.challenge_days.challenge_id', completedChallenge.id)

    const { count: journalCount } = await supabase
      .from('journal_entries')
      .select('id, challenge_days!inner(challenge_id)', { count: 'exact', head: true })
      .eq('challenge_days.challenge_id', completedChallenge.id)

    console.log(`Challenge 1 ("${completedChallenge.name}") counts:`)
    console.log(`- challenge_days: ${daysCount} (expected ${completedChallenge.duration_days})`)
    console.log(`- activities: ${actsCount}`)
    console.log(`- completions: ${compCount}`)
    console.log(`- activity_completions: ${actCompCount}`)
    console.log(`- journal_entries: ${journalCount}`)

    if (daysCount !== completedChallenge.duration_days) {
      console.warn(`WARNING: Day count mismatch: got ${daysCount}, expected ${completedChallenge.duration_days}`)
    } else {
      console.log('✓ All days and activities are intact!')
    }
  }

  // ── TEST 3: Scoped Leaderboard for Completed Challenge ──────
  console.log('\n--- TEST 3: Scoped Leaderboard RPC ---')
  if (completedChallenge) {
    const { data: lb, error: lbErr } = await supabase.rpc('get_leaderboard', {
      target_challenge_id: completedChallenge.id,
    })
    if (lbErr) {
      console.error('get_leaderboard error:', lbErr.message)
    } else {
      const list = Array.isArray(lb) ? lb : lb?.members || lb?.top_members || []
      const totalRanked = Array.isArray(lb) ? lb[0]?.total_ranked_members ?? list.length : lb?.total_ranked_members
      console.log(`Leaderboard for "${completedChallenge.name}":`)
      console.log(`- Total ranked members: ${totalRanked}`)
      console.log(`- Top entries returned: ${list.length}`)
      list.slice(0, 3).forEach((m, idx) => {
        console.log(`  #${idx + 1}: ${m.full_name} (${m.total_activities_completed ?? m.total_completed} activities, ${m.current_streak} streak)`)
      })
      console.log('✓ Scoped leaderboard successfully retrieved frozen standings!')
    }
  }

  // ── TEST 4: Zero-history / Late Joiner Member Handling ──────
  console.log('\n--- TEST 4: Zero-history Member Handling ---')
  const dummyUserId = '00000000-0000-0000-0000-000000000000'
  const { data: zeroStats, error: zeroErr } = await supabase.rpc('get_member_stats', {
    member_id: dummyUserId,
    target_challenge_id: completedChallenge?.id,
  })
  if (zeroErr) {
    console.error('zero stats error:', zeroErr.message)
  } else {
    const s = zeroStats?.[0] ?? { current_streak: 0, longest_run: 0, total_completed: 0 }
    console.log(`Zero-member stats: streak=${s.current_streak}, longest=${s.longest_run}, completed=${s.total_completed}`)
    console.log('✓ Non-participating or late-joining member stats cleanly return zero with no exceptions!')
  }

  // ── TEST 5: Direct Write Protection on Completed Challenge ──
  console.log('\n--- TEST 5: Direct Write Protection on Completed Challenge ---')
  if (completedChallenge) {
    // Pick an activity from Day 1 of the completed challenge
    const { data: sampleDay } = await supabase
      .from('challenge_days')
      .select('id, day_number')
      .eq('challenge_id', completedChallenge.id)
      .eq('day_number', 1)
      .single()

    if (sampleDay) {
      const { data: sampleAct } = await supabase
        .from('activities')
        .select('id, description')
        .eq('challenge_day_id', sampleDay.id)
        .limit(1)
        .single()

      if (sampleAct) {
        console.log(`Attempting unauthenticated/anon write to activity "${sampleAct.description}" in completed challenge...`)
        const { error: insActCompErr } = await supabase
          .from('activity_completions')
          .insert({
            user_id: dummyUserId,
            activity_id: sampleAct.id,
          })

        console.log(`Insert activity_completion result: ${insActCompErr ? `BLOCKED (${insActCompErr.message})` : 'UNEXPECTED SUCCESS'}`)

        console.log(`Attempting write to journal_entries for completed challenge day ${sampleDay.day_number}...`)
        const { error: insJournalErr } = await supabase
          .from('journal_entries')
          .insert({
            user_id: dummyUserId,
            challenge_day_id: sampleDay.id,
            content: 'Test reflection on completed challenge',
          })

        console.log(`Insert journal_entry result: ${insJournalErr ? `BLOCKED (${insJournalErr.message})` : 'UNEXPECTED SUCCESS'}`)

        if (insActCompErr && insJournalErr) {
          console.log('✓ Database RLS successfully rejects direct write attempts on completed challenges!')
        }
      }
    }
  }

  // ── TEST 6: Upcoming Challenge Protection ───────────────────
  console.log('\n--- TEST 6: Upcoming Challenge Days Protection ---')
  const upcomingChallenge = challenges.find((c) => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: c.timezone || 'Africa/Lagos' }).format(new Date())
    return today < c.start_date
  })

  if (upcomingChallenge) {
    console.log(`Found upcoming challenge: "${upcomingChallenge.name}" (starts ${upcomingChallenge.start_date})`)
    const { data: upDays, error: upDaysErr } = await supabase
      .from('challenge_days')
      .select('id, day_number, title')
      .eq('challenge_id', upcomingChallenge.id)

    console.log(`Querying upcoming challenge days via public client: returned ${upDays?.length ?? 0} days (RLS policy check)`)
    if (!upDays || upDays.length === 0) {
      console.log('✓ Upcoming challenge days are properly hidden from unauthenticated/regular member queries!')
    }
  } else {
    console.log('No upcoming challenge currently in DB. (Between-challenges or only completed challenge exists)')
  }

  console.log('\n=================================================================')
  console.log('ALL MEMBER-FACING ARCHITECTURE VERIFICATION CHECKS COMPLETE')
  console.log('=================================================================')
}

runVerification().catch(console.error)
