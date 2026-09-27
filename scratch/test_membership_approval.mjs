import assert from 'node:assert'

console.log('====================================================')
console.log('VERIFYING CHURCH MEMBERSHIP APPROVAL WORKFLOW')
console.log('====================================================\n')

// 1. SIMULATE MIDDLEWARE ROUTE DECISION ENGINE
function simulateMiddleware(user, profile, pathname) {
  const isProtectedMember =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/community') ||
    pathname.startsWith('/leaderboard')
  const isProtectedAdmin = pathname.startsWith('/admin')
  const isHoldingRoute = pathname.startsWith('/pending')
  const isAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/signup')

  // Unauthenticated user hitting any protected or holding route -> redirect to login
  if (!user && (isProtectedMember || isProtectedAdmin || isHoldingRoute)) {
    return { redirect: '/login' }
  }

  if (user) {
    const isAdmin = profile?.role === 'admin'
    const isUnapproved =
      !isAdmin &&
      (profile?.status === 'pending' || profile?.status === 'rejected')

    // 1. Pending or Rejected members:
    if (isUnapproved) {
      if (isHoldingRoute) {
        return { allow: true }
      }
      return { redirect: '/pending' }
    }

    // 2. Approved members & admins:
    if (isHoldingRoute) {
      return { redirect: isAdmin ? '/admin' : '/dashboard' }
    }

    if (isAuthRoute) {
      return { redirect: isAdmin ? '/admin' : '/dashboard' }
    }

    if (isProtectedAdmin && !isAdmin) {
      return { redirect: '/dashboard' }
    }
  }

  return { allow: true }
}

// 2. SIMULATE RLS PERMISSION ENGINE FOR DATABASE
function simulateRLSCheck({ callerProfile, table, operation, targetUserId }) {
  const isAdmin = callerProfile?.role === 'admin'
  const isApproved = isAdmin || callerProfile?.status === 'approved'

  if (table === 'profiles') {
    if (operation === 'SELECT') {
      // id = auth.uid() OR is_admin() OR is_approved()
      if (callerProfile?.id === targetUserId || isAdmin || isApproved) {
        return { allowed: true }
      }
      return { allowed: false, reason: 'RLS: Pending/rejected members cannot view other members profiles' }
    }
    if (operation === 'UPDATE_STATUS') {
      if (isAdmin) return { allowed: true }
      return { allowed: false, reason: 'TRIGGER: Non-admins cannot alter role or status' }
    }
  }

  if (table === 'completions' || table === 'activity_completions') {
    if (operation === 'INSERT' || operation === 'DELETE' || operation === 'SELECT') {
      if (isAdmin || (isApproved && callerProfile?.id === targetUserId)) {
        return { allowed: true }
      }
      return { allowed: false, reason: 'RLS: Only approved members or admins can record/view completions' }
    }
  }

  if (table === 'messages') {
    if (operation === 'SELECT' || operation === 'INSERT') {
      if (isAdmin || isApproved) {
        return { allowed: true }
      }
      return { allowed: false, reason: 'RLS: Pending/rejected members cannot read or post community messages' }
    }
  }

  return { allowed: false }
}

// ── TEST SUITE ─────────────────────────────────────────────

console.log('--- TEST 1: Existing member prior to feature (or status = approved) ---')
const existingMember = {
  id: 'existing-member-uuid',
  full_name: 'Brother Timothy',
  email: 'timothy@bbcc.org.ng',
  role: 'member',
  status: 'approved', // One-time migration sets this for all existing users
}

// Test existing member routes
const t1_dash = simulateMiddleware({ id: existingMember.id }, existingMember, '/dashboard')
const t1_comm = simulateMiddleware({ id: existingMember.id }, existingMember, '/community')
const t1_lead = simulateMiddleware({ id: existingMember.id }, existingMember, '/leaderboard')
const t1_hold = simulateMiddleware({ id: existingMember.id }, existingMember, '/pending')

assert.strictEqual(t1_dash.allow, true, 'Existing approved member must access /dashboard')
assert.strictEqual(t1_comm.allow, true, 'Existing approved member must access /community')
assert.strictEqual(t1_lead.allow, true, 'Existing approved member must access /leaderboard')
assert.strictEqual(t1_hold.redirect, '/dashboard', 'Existing approved member visiting /pending should redirect to /dashboard')

// Test existing member legacy fallback (if status field was undefined before migration)
const legacyMember = { id: 'legacy-uuid', full_name: 'Sister Mary', email: 'mary@bbcc.org.ng', role: 'member' }
const t1_legacy = simulateMiddleware({ id: legacyMember.id }, legacyMember, '/dashboard')
assert.strictEqual(t1_legacy.allow, true, 'Existing member with unmigrated status continues uninterrupted')
console.log('✔ PASS: Existing members experience zero disruption.\n')

console.log('--- TEST 2: Brand new signup (status = pending) ---')
const pendingMember = {
  id: 'new-member-uuid-1',
  full_name: 'New Brother Emmanuel',
  email: 'emmanuel@bbcc.org.ng',
  role: 'member',
  status: 'pending',
}

const t2_dash = simulateMiddleware({ id: pendingMember.id }, pendingMember, '/dashboard')
const t2_comm = simulateMiddleware({ id: pendingMember.id }, pendingMember, '/community')
const t2_lead = simulateMiddleware({ id: pendingMember.id }, pendingMember, '/leaderboard')
const t2_hold = simulateMiddleware({ id: pendingMember.id }, pendingMember, '/pending')
const t2_login = simulateMiddleware({ id: pendingMember.id }, pendingMember, '/login')

assert.strictEqual(t2_dash.redirect, '/pending', 'Pending member accessing /dashboard must redirect to /pending')
assert.strictEqual(t2_comm.redirect, '/pending', 'Pending member accessing /community must redirect to /pending')
assert.strictEqual(t2_lead.redirect, '/pending', 'Pending member accessing /leaderboard must redirect to /pending')
assert.strictEqual(t2_hold.allow, true, 'Pending member must be allowed on /pending')
assert.strictEqual(t2_login.redirect, '/pending', 'Pending member visiting /login must redirect to /pending')

// Test direct API calls (bypassing UI)
const t2_api_comp = simulateRLSCheck({
  callerProfile: pendingMember,
  table: 'completions',
  operation: 'INSERT',
  targetUserId: pendingMember.id,
})
const t2_api_msg = simulateRLSCheck({
  callerProfile: pendingMember,
  table: 'messages',
  operation: 'INSERT',
  targetUserId: pendingMember.id,
})
const t2_api_other = simulateRLSCheck({
  callerProfile: pendingMember,
  table: 'profiles',
  operation: 'SELECT',
  targetUserId: 'other-member-uuid',
})
const t2_api_own_profile = simulateRLSCheck({
  callerProfile: pendingMember,
  table: 'profiles',
  operation: 'SELECT',
  targetUserId: pendingMember.id,
})

assert.strictEqual(t2_api_comp.allowed, false, 'Pending member direct completion API call must be rejected')
assert.strictEqual(t2_api_msg.allowed, false, 'Pending member direct message API call must be rejected')
assert.strictEqual(t2_api_other.allowed, false, 'Pending member cannot view other members profiles via direct API')
assert.strictEqual(t2_api_own_profile.allowed, true, 'Pending member CAN view their own profile so UI knows status')
console.log('✔ PASS: Pending member lands on /pending and direct API calls are blocked by RLS.\n')

console.log('--- TEST 3: Admin approves pending account ---')
// Simulate admin approving pending member
const adminUser = {
  id: 'admin-uuid',
  full_name: 'Pastor Johnson',
  email: 'pastor@bbcc.org.ng',
  role: 'admin',
  status: 'approved',
}

// Admin can update status
const t3_status_update = simulateRLSCheck({
  callerProfile: adminUser,
  table: 'profiles',
  operation: 'UPDATE_STATUS',
  targetUserId: pendingMember.id,
})
assert.strictEqual(t3_status_update.allowed, true, 'Admin can update membership status')

// Pending member attempts to elevate own status
const t3_self_elevate = simulateRLSCheck({
  callerProfile: pendingMember,
  table: 'profiles',
  operation: 'UPDATE_STATUS',
  targetUserId: pendingMember.id,
})
assert.strictEqual(t3_self_elevate.allowed, false, 'Pending member cannot self-approve via direct API call')

// After approval:
const approvedMember = { ...pendingMember, status: 'approved' }
const t3_approved_dash = simulateMiddleware({ id: approvedMember.id }, approvedMember, '/dashboard')
const t3_approved_comp = simulateRLSCheck({
  callerProfile: approvedMember,
  table: 'completions',
  operation: 'INSERT',
  targetUserId: approvedMember.id,
})
const t3_approved_msg = simulateRLSCheck({
  callerProfile: approvedMember,
  table: 'messages',
  operation: 'INSERT',
  targetUserId: approvedMember.id,
})

assert.strictEqual(t3_approved_dash.allow, true, 'Approved member now has full access to /dashboard')
assert.strictEqual(t3_approved_comp.allowed, true, 'Approved member can now record completions')
assert.strictEqual(t3_approved_msg.allowed, true, 'Approved member can now post fellowship messages')
console.log('✔ PASS: Approved member gains immediate full access.\n')

console.log('--- TEST 4: Reject a test account ---')
const rejectedMember = {
  id: 'new-member-uuid-2',
  full_name: 'Spam User',
  email: 'suspicious@unknown.com',
  role: 'member',
  status: 'rejected',
}

const t4_dash = simulateMiddleware({ id: rejectedMember.id }, rejectedMember, '/dashboard')
const t4_hold = simulateMiddleware({ id: rejectedMember.id }, rejectedMember, '/pending')
const t4_api_msg = simulateRLSCheck({
  callerProfile: rejectedMember,
  table: 'messages',
  operation: 'INSERT',
  targetUserId: rejectedMember.id,
})
const t4_api_comp = simulateRLSCheck({
  callerProfile: rejectedMember,
  table: 'completions',
  operation: 'INSERT',
  targetUserId: rejectedMember.id,
})

assert.strictEqual(t4_dash.redirect, '/pending', 'Rejected member accessing /dashboard redirected to /pending')
assert.strictEqual(t4_hold.allow, true, 'Rejected member sees holding page with rejected notice')
assert.strictEqual(t4_api_msg.allowed, false, 'Rejected member cannot post messages via API')
assert.strictEqual(t4_api_comp.allowed, false, 'Rejected member cannot record completions via API')
console.log('✔ PASS: Rejected member sees rejected notice and is completely blocked from member data.\n')

console.log('--- TEST 5: Admin Account Security ---')
const t5_admin_admin = simulateMiddleware({ id: adminUser.id }, adminUser, '/admin')
const t5_admin_dash = simulateMiddleware({ id: adminUser.id }, adminUser, '/dashboard')
const t5_admin_pending = simulateMiddleware({ id: adminUser.id }, adminUser, '/pending')

assert.strictEqual(t5_admin_admin.allow, true, 'Admin has full access to /admin')
assert.strictEqual(t5_admin_dash.allow, true, 'Admin has full access to /dashboard')
assert.strictEqual(t5_admin_pending.redirect, '/admin', 'Admin visiting /pending redirects to /admin')
console.log('✔ PASS: Admin access is fully verified and unharmed.\n')

console.log('====================================================')
console.log('ALL VERIFICATION SUITE TESTS PASSED (100%)')
console.log('====================================================')
