import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kyjhlykzjggxzgtebcol.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5amhseWt6amdneHpndGViY29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMTU0NzcsImV4cCI6MjEwNTg5MTQ3N30.HfmSoxMOMOtX8dsH-bYdFynWsXIILC4sWtQ4hswClnU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testQuery() {
  const challengeId = '9d889081-7f1d-4ccc-8220-ab170c0eb90a'

  // Test 1: nested select
  const q1 = await supabase
    .from('activity_completions')
    .select('activity_id, activities!inner(challenge_day_id, challenge_days!inner(challenge_id))', {
      count: 'exact',
      head: true,
    })
    .eq('activities.challenge_days.challenge_id', challengeId)

  console.log('Query 1 result:', { count: q1.count, error: q1.error })
}

testQuery().catch(console.error)
