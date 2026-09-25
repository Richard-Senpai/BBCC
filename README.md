# BBCCILEIFE — 40-Day Challenge

A warm, church-community web platform for tracking the BBCCILEIFE 40-Day Challenge.
Built with **Next.js 14 (App Router)** + **Tailwind CSS** + **Supabase**.

---

## 🚀 Quick Setup

### 1. Clone & Install

```bash
git clone <your-repo>
cd bbcc-40day
npm install
```

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. From **Project Settings → API**, copy:
   - Project URL
   - Anon/public key

### 3. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Apply the Database Schema

In your Supabase project → **SQL Editor**, run the contents of:

```
supabase/migrations/001_initial.sql
```

This creates all tables, RLS policies, and the `on_auth_user_created` trigger.

### 5. Create the First Admin Account

1. In Supabase Dashboard → **Authentication → Users**, click **Add user** → **Create new user**
2. Enter the admin's email and a strong password. Enable **Auto-confirm user**.
3. Copy the resulting User UUID.
4. In the SQL Editor, run:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE id = '<PASTE-UUID-HERE>';
   ```

> Regular members sign up through the app's `/signup` page. Admin role is never grantable from the UI — only via this SQL step.

### 6. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📦 Deploying to Vercel

1. Push the repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com).
3. Add environment variables in Vercel → Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Done.

> Set the **Supabase email confirmation redirect URL** to `https://your-vercel-domain.vercel.app/auth/callback` in Supabase → **Authentication → URL Configuration**.

---

## 📁 Project Structure

```
bbcc-40day/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Smart redirect based on auth/role
│   ├── (auth)/
│   │   ├── login/page.tsx      # Login form
│   │   └── signup/page.tsx     # Sign-up form
│   ├── dashboard/page.tsx      # Member home (protected)
│   ├── admin/page.tsx          # Admin home (protected)
│   └── auth/callback/route.ts  # Email confirmation handler
├── components/
│   └── LogoutButton.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client
│   │   ├── server.ts           # Server Supabase client
│   │   └── middleware.ts       # Session refresh + route guards
│   └── types.ts                # TypeScript DB types
├── middleware.ts                # Next.js edge middleware
├── supabase/
│   ├── migrations/001_initial.sql   # Full schema + RLS
│   └── seed.sql                     # Admin promotion script
└── .env.local.example
```

---

## 🗄️ Database Schema

| Table | Purpose |
|---|---|
| `profiles` | One row per user — name, email, role (`member`/`admin`) |
| `challenge_settings` | Single-row config — start date, timezone |
| `challenge_days` | 40 daily challenges (day_number 1–40) |
| `activities` | Tasks within each challenge day |
| `completions` | Which users completed which days |

**Row-level security** ensures members can only read/write their own data; admins have full access.

---

## 🛣️ Route Map

| Route | Who | What |
|---|---|---|
| `/` | Anyone | Smart redirect |
| `/login` | Unauthenticated | Login form |
| `/signup` | Unauthenticated | Registration form |
| `/dashboard` | Members | Personal dashboard |
| `/admin` | Admins only | Admin dashboard |
| `/auth/callback` | Supabase | Email confirm handler |

---

## 🔮 Coming Next

- Daily challenge display (day cards, activities)
- Completion tracking & streaks
- Leaderboard
- Admin content management (create/edit challenge days)
- Admin challenge settings editor
