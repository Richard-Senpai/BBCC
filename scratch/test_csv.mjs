function escapeCsv(val) {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  return `"${str.replace(/"/g, '""')}"`
}

const headers = [
  'Member Name',
  'Email',
  'Fellowship Unit',
  'Join Date',
  'Current Streak (Days)',
  'Total Activities Completed',
  'Total Full Days Completed'
]

const testMembers = [
  { name: 'Richard Ojedayo', email: 'richard@bbcc.org', unit: 'Choir "David" Unit', date: 'Sep 24, 2026', streak: 6, acts: 24, days: 4 },
  { name: 'Oyindamola Oyebanji, MD', email: 'oyinda@bbcc.org', unit: 'Greeters, Ushers', date: 'Sep 25, 2026', streak: 4, acts: 18, days: 3 },
  { name: 'Adebayo Temitope', email: 'temitope@bbcc.org', unit: 'Media & Tech', date: 'Sep 26, 2026', streak: 1, acts: 6, days: 1 }
]

const rows = testMembers.map(m => [
  escapeCsv(m.name),
  escapeCsv(m.email),
  escapeCsv(m.unit),
  escapeCsv(m.date),
  m.streak,
  m.acts,
  m.days
])

const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
console.log('--- GENERATED CSV PREVIEW ---')
console.log(csv)
console.log('--- END CSV PREVIEW ---')
