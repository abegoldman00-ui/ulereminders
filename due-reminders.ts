// ============================================================
// ULEReminders — due-reminders Edge Function (Gmail SMTP)
// Triggered daily by GitHub Actions cron (~8am US Eastern).
// Emails the notify list for any open tile that is due tomorrow,
// due today, or overdue.
// Deploy: supabase functions deploy due-reminders --no-verify-jwt
// Secrets reused: GMAIL_USER, GMAIL_APP_PASSWORD, FROM_EMAIL
// Lock secret:    CRON_SECRET  (also stored as a GitHub Actions secret)
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const APP_URL = "https://abegoldman00-ui.github.io/ulereminders/";
const TZ = "America/New_York";

function esc(s: unknown) {
  return (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}
function etDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

serve(async (req) => {
  // Lock: require the shared cron secret (stored in GitHub + Supabase secret stores).
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const SB_URL = Deno.env.get("SUPABASE_URL");
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  const today = etDate(0), tomorrow = etDate(1);

  // Open tiles with a due date on or before tomorrow.
  const url = `${SB_URL}/rest/v1/tiles?status=neq.done&due_date=not.is.null&due_date=lte.${tomorrow}&select=*`;
  const res = await fetch(url, { headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` } });
  const tiles = res.ok ? await res.json() : [];

  const due = tiles.filter((t: any) =>
    /^\d{4}-\d{2}-\d{2}$/.test(t.due_date || "") &&
    (t.watchers || []).filter((e: string) => e && e.includes("@")).length > 0
  );

  const user = Deno.env.get("GMAIL_USER");
  const pass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
  const from = Deno.env.get("FROM_EMAIL") || `ULEReminders <${user}>`;

  let sent = 0;
  if (due.length && user && pass) {
    const client = new SMTPClient({
      connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: user, password: pass } },
    });
    for (const t of due) {
      const recipients = (t.watchers || []).filter((e: string) => e && e.includes("@"));
      let label = "Due tomorrow", emoji = "📅";
      if (t.due_date < today) { label = "Overdue"; emoji = "⚠"; }
      else if (t.due_date === today) { label = "Due today"; emoji = "⏰"; }
      const html = `<div style="font-family:sans-serif;max-width:520px;margin:auto">
        <div style="background:#16243b;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:700">ULEReminders</div>
        <div style="border:1px solid #e0dccf;border-top:none;border-radius:0 0 12px 12px;padding:20px">
          <div style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:12px;padding:3px 9px;border-radius:6px;margin-bottom:10px">${emoji} ${label}</div>
          <h2 style="margin:0 0 6px">${esc(t.title)}</h2>
          <div style="color:#6c685c;font-size:13px;margin-bottom:10px">${t.job ? "Job: " + esc(t.job) : ""} ${t.person ? " · " + esc(t.person) : ""}</div>
          <div style="font-size:14px;color:#23211c">Due date: <b>${esc(t.due_date)}</b></div>
          ${t.description ? `<div style="font-size:14px;line-height:1.5;margin-top:8px">${esc(t.description)}</div>` : ""}
          <a href="${APP_URL}" style="display:inline-block;margin-top:16px;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open ULEReminders</a>
        </div></div>`;
      try {
        await client.send({ from, to: recipients, subject: `${emoji} ${label}: ${t.title}`, content: "Reminder", html });
        sent++;
      } catch (_e) { /* skip one bad recipient, keep going */ }
    }
    await client.close();
  }

  return new Response(JSON.stringify({ today, tomorrow, checked: tiles.length, emailed: sent }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
