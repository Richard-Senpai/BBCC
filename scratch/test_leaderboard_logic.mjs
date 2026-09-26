const members = [
  { id: 'member_b', name: 'Member B (1 full day)', total_activities: 3, streak: 1, last_at: '2026-09-26T12:00:00Z' },
  { id: 'member_a', name: 'Member A (several partial days)', total_activities: 7, streak: 0, last_at: '2026-09-26T14:00:00Z' },
  { id: 'member_c', name: 'Member C (tied activities, higher streak)', total_activities: 7, streak: 1, last_at: '2026-09-26T15:00:00Z' },
  { id: 'member_d', name: 'Member D (tied activities & streak, finished earlier)', total_activities: 7, streak: 1, last_at: '2026-09-26T13:00:00Z' },
  { id: 'member_e', name: 'Member E (zero activities)', total_activities: 0, streak: 0, last_at: null },
];

// Sort matching SQL: total_completed DESC, current_streak DESC, last_completed_at ASC NULLS LAST
const sorted = [...members].sort((a, b) => {
  // 1. total_completed DESC
  if (b.total_activities !== a.total_activities) {
    return b.total_activities - a.total_activities;
  }
  // 2. current_streak DESC
  if (b.streak !== a.streak) {
    return b.streak - a.streak;
  }
  // 3. last_completed_at ASC NULLS LAST
  if (!a.last_at && !b.last_at) return 0;
  if (!a.last_at) return 1;
  if (!b.last_at) return -1;
  return new Date(a.last_at).getTime() - new Date(b.last_at).getTime();
});

console.log('Leaderboard Ranking Results:');
sorted.forEach((m, idx) => {
  console.log(`#${idx + 1}: ${m.name} -> Activities: ${m.total_activities}, Streak: ${m.streak}, Last At: ${m.last_at}`);
});

if (sorted[0].id !== 'member_d') throw new Error('Expected member_d at #1');
if (sorted[1].id !== 'member_c') throw new Error('Expected member_c at #2');
if (sorted[2].id !== 'member_a') throw new Error('Expected member_a at #3');
if (sorted[3].id !== 'member_b') throw new Error('Expected member_b at #4');
if (sorted[4].id !== 'member_e') throw new Error('Expected member_e at #5');

console.log('\nSUCCESS: All sorting rules and tiebreakers verified!');
console.log('Member A (7 activities, 0 streak) ranks higher than Member B (3 activities, 1 streak)!');
