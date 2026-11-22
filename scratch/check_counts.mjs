import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kyjhlykzjggxzgtebcol.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5amhseWt6amdneHpndGViY29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMTU0NzcsImV4cCI6MjEwNTg5MTQ3N30.HfmSoxMOMOtX8dsH-bYdFynWsXIILC4sWtQ4hswClnU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function main() {
  const tables = ['challenge_settings', 'challenge_days', 'activities', 'completions', 'activity_completions', 'journal_entries']
  for (const table of tables) {
    const { count, error, data } = await supabase.from(table).select('*', { count: 'exact' })
    if (error) {
      console.log(`Table ${table}: ERROR: ${error.message} (code: ${error.code})`)
    } else {
      console.log(`Table ${table}: count = ${count}, returned rows = ${data?.length}`)
    }
  }
}

main().catch(console.error)
