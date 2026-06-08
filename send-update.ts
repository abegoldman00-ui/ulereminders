// ============================================================
// ULEReminders — send-update Edge Function
// Deploy with: supabase functions deploy send-update --no-verify-jwt
// Set secret:   supabase secrets set RESEND_API_KEY=re_xxx
//               supabase secrets set FROM_EMAIL="ULEReminders <reminders@yourdomain.com>"
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { to, subject, html } = await req.json();
    const recipients = (to || []).filter((e: string) => e && e.includes("@"));
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ skipped: "no recipients" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const key = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("FROM_EMAIL") || "ULEReminders <onboarding@resend.dev>";
    if (!key) throw new Error("RESEND_API_KEY not set");

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    });

    const data = await r.json();
    return new Response(JSON.stringify(data), {
      status: r.ok ? 200 : 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
