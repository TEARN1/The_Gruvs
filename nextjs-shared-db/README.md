# Next.js ↔ The Gruvs — Shared Supabase Database

Both apps use the **same Supabase project**. No syncing, no duplication — one source of truth.

## 1. Run the migration

In your Supabase dashboard → SQL Editor, run:
`supabase/queries/14_shared_profile_fields.sql`

## 2. Next.js environment variables

Create `.env.local` in your Next.js project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://feevvddvrjmfbhffccbf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlZXZ2ZGR2cmptZmJoZmZjY2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTEwNTAsImV4cCI6MjA4ODI2NzA1MH0.CvZRz05orvSEeaawwponcjpZypX3CePBny6zsgmc4bU
```

## 3. Install Supabase in your Next.js project

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## 4. Copy the ready-made files from this folder into your Next.js project

- `lib/supabase/client.ts` → your Next.js `lib/supabase/client.ts`
- `lib/supabase/server.ts` → your Next.js `lib/supabase/server.ts`
- `lib/supabase/profile.ts` → your Next.js `lib/supabase/profile.ts`
- `middleware.ts` → your Next.js root `middleware.ts`

## Shared data shape

```ts
// profiles row (shared fields)
{
  id: string;           // = auth.users.id (same user across both apps)
  first_name: string;
  surname: string;
  email: string;
  age: number;
  siblings: { name: string; age: number; relationship: string }[];
  emergency_contacts: { name: string; phone: string; relationship: string }[];
}
```

## How auth works across apps

Both apps use **Supabase Auth** — the same user account works in both.
If a user signs up in The Gruvs, they can log into the Next.js app with the same email/password and access their own profile data. RLS ensures they only see their own rows.
