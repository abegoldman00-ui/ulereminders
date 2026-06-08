# ULEReminders — Setup Guide

A reminder-tile web app. Tiles = tasks, tagged to a **job** and a **person**, with a
**status** (Open / In progress / Done), a **timestamped conversation thread**,
**document uploads**, and **automatic emails** to everyone on a tile's notify list
whenever the tile is updated.

Everything is one file (`index.html`) plus a Supabase backend and one email function.
Total cost: $0 on free tiers.

---

## 1. Create the Supabase project (5 min)
1. Go to **supabase.com** → sign up free → **New project**. Pick a name + password, wait ~2 min.
2. Left menu → **SQL Editor** → **New query** → paste the entire contents of `schema.sql` → **Run**.
   This creates all tables, the document storage bucket, and a default admin login.
3. Left menu → **Project Settings → API**. Copy two values:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon public** key (a long `eyJ…` string)

## 2. Wire those into the app
Open `index.html`, find the CONFIG block near the bottom, and replace:
```js
const SB_URL = 'https://YOUR_PROJECT.supabase.co';   // ← your Project URL
const SB_KEY = 'YOUR_ANON_KEY';                      // ← your anon public key
```

## 3. Set up automatic emails (10 min)
The app calls a small Supabase Edge Function that sends mail through **Resend** (free: 3,000/mo).
1. Sign up at **resend.com**. To send from your own company domain, add it under
   **Domains** and follow their DNS steps. (To test immediately, you can send from
   their sandbox `onboarding@resend.dev` with no setup.)
2. **API Keys** → create one → copy it (`re_…`).
3. Install the Supabase CLI (`npm i -g supabase`), then in this folder:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF      # the abcd1234 part of your URL
   supabase functions deploy send-update --no-verify-jwt
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set FROM_EMAIL="ULEReminders <reminders@yourdomain.com>"
   ```
   (Put `send-update.ts` at `supabase/functions/send-update/index.ts` before deploying.)

If you skip this step, the app still works fully — it just won't send emails until the
function is deployed.

## 4. Host it (free, 5 min)
1. Create a **public GitHub repo**.
2. Upload `index.html` (keep that exact name).
3. Repo **Settings → Pages → Branch: main → Save**.
4. Your live URL: `https://YOURNAME.github.io/REPONAME` — ready in ~60s.
   Hard-refresh with Ctrl+Shift+R after updates.

## 5. First login
- Username **admin**, password **admin**.
- **Change it immediately:** the password is hashed with the djb2 function in the file.
  Compute a new hash (open the hosted site, browser console, paste the `hashPassword`
  function and run `hashPassword('your-new-password')`), then in Supabase SQL Editor:
  ```sql
  update users set password_hash = '<new_hash>' where username = 'admin';
  ```
- Add teammates: **⚙ Admin panel → Generate invite link** → send them the one-time URL.
  They pick their own username/password and (importantly) enter their **email** so
  notifications reach them.

---

## How it works day to day
- **＋ New tile** — title, description, job, person, status, due date, tags, and a
  **notify list** of emails. Everyone on that list is emailed on every future update.
- **Click a tile** — change status, upload documents, and chat back-and-forth. Every
  message is timestamped and attributed to its author, so correspondence is tracked.
- **Filter** by status (sidebar), and by **job or person** (top dropdowns), plus search.
- Emails fire automatically on: new tile, status change, new message, new document.

## Notes & limits
- Auth is lightweight (username/password stored in your private DB, hashed client-side).
  It's invite-only and fine for an internal company tool. For external clients later,
  consider Supabase's built-in Auth for stronger security.
- Real-time sync is via 30-second polling — simple and reliable. Can upgrade to
  Supabase Realtime websockets later if you want instant updates.
- Documents are stored in a public storage bucket (anyone with the file URL can open
  it). If you need private documents, switch the bucket to private and serve signed URLs.
