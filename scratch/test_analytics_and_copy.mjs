import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kyjhlykzjggxzgtebcol.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5amhseWt6amdneHpndGViY29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMTU0NzcsImV4cCI6MjEwNTg5MTQ3N30.HfmSoxMOMOtX8dsH-bYdFynWsXIILC4sWtQ4hswClnU'

async function run() {
  console.log('--- 1. Testing Signup Page Static Copy ---')
  const res = await fetch('http://localhost:3000/signup')
  const html = await res.text()

  const hasTagline = html.includes('...Raising Kingdom Leaders')
  const hasButtonText = html.includes('Join BBCC Challenge Hub')

  console.log('Signup page includes "...Raising Kingdom Leaders":', hasTagline)
  console.log('Signup page includes "Join BBCC Challenge Hub":', hasButtonText)

  if (!hasTagline || !hasButtonText) {
    console.error('FAILED: Static copy missing on signup page!')
  } else {
    console.log('PASSED: Signup page copy is exact.')
  }

  console.log('\n--- 2. Checking Real Database Data for Analytics ---')
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const { data: members, error: mErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at, fellowship_unit')
    .eq('role', 'member')

  console.log(`Found ${members?.length ?? 0} members:`)
  members?.forEach(m => console.log(`  - [${m.id}] ${m.full_name} (${m.email}, ${m.fellowship_unit || 'No unit'})`))

  const { data: acts } = await supabase
    .from('activities')
    .select('id, challenge_day_id, description')

  console.log(`Total activities registered: ${acts?.length ?? 0}`)

  const { data: days } = await supabase
    .from('challenge_days')
    .select('id, day_number, title')
    .order('day_number', { ascending: true })

  console.log(`Total challenge days registered: ${days?.length ?? 0}`)

  const { data: actComps } = await supabase
    .from('activity_completions')
    .select('id, user_id, activity_id, completed_at')

  console.log(`Total activity_completions found: ${actComps?.length ?? 0}`)

  const { data: fullComps } = await supabase
    .from('completions')
    .select('id, user_id, challenge_day_id, completed_at')

  console.log(`Total full-day completions found: ${fullComps?.length ?? 0}`)

  console.log('\n--- 3. Testing CSV Generation Logic with Real Data ---')
  function escapeCsv(val) {
    if (val === null || val === undefined) return '""'
    return `"${String(val).replace(/"/g, '""')}"`
  }

  // Generate Summary CSV
  const summaryHeaders = ['Member Name', 'Email', 'Fellowship Unit', 'Join Date', 'Current Streak', 'Total Activities', 'Total Days']
  const summaryRows = (members || []).map(m => {
    const userActs = (actComps || []).filter(ac => ac.user_id === m.id).length
    const userDays = (fullComps || []).filter(c => c.user_id === m.id).length
    return [
      escapeCsv(m.full_name),
      escapeCsv(m.email),
      escapeCsv(m.fellowship_unit || 'General Assembly'),
      escapeCsv(m.created_at),
      0,
      userActs,
      userDays
    ].join(',')
  })
  const summaryCsv = [summaryHeaders.join(','), ...summaryRows].join('\r\n')
  console.log('Sample Summary CSV output:\n' + summaryCsv.split('\r\n').slice(0, 5).join('\n'))

  // Check Detailed CSV
  let detailedRowCount = 0
  for (const m of (members || [])) {
    for (const d of (days || [])) {
      const dayActs = (acts || []).filter(a => a.challenge_day_id === d.id)
      detailedRowCount += Math.max(1, dayActs.length)
    }
  }
  console.log(`Detailed CSV would produce ${detailedRowCount} audit rows.`)
}

run().catch(console.error)
