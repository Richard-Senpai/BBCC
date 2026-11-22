import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kyjhlykzjggxzgtebcol.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5amhseWt6amdneHpndGViY29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMTU0NzcsImV4cCI6MjEwNTg5MTQ3N30.HfmSoxMOMOtX8dsH-bYdFynWsXIILC4sWtQ4hswClnU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  console.log('--- Checking challenge_settings ---')
  const { data: cs, error: csErr } = await supabase.from('challenge_settings').select('*')
  console.log('challenge_settings:', cs, 'error:', csErr)

  console.log('--- Checking get_current_challenge_day RPC ---')
  const { data: cd, error: cdErr } = await supabase.rpc('get_current_challenge_day')
  console.log('get_current_challenge_day:', cd, 'error:', cdErr)

  console.log('--- Checking get_leaderboard RPC ---')
  const { data: lb, error: lbErr } = await supabase.rpc('get_leaderboard')
  console.log('get_leaderboard:', lb ? (Array.isArray(lb) ? `array of ${lb.length}` : typeof lb) : null, 'error:', lbErr)

  console.log('--- Checking challenges_with_status ---')
  const { data: cws, error: cwsErr } = await supabase.from('challenges_with_status').select('*')
  console.log('challenges_with_status:', cws, 'error:', cwsErr)
}

test().catch(console.error)
