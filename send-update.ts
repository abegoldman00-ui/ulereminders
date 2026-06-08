// ============================================================
// ULEReminders — send-update Edge Function (Gmail SMTP)
// Deploy with: supabase functions deploy send-update --no-verify-jwt
// Secrets:
//   supabase secrets set GMAIL_USER=ulereminders@gmail.com
//   supabase secrets set GMAIL_APP_PASSWORD="xxxxxxxxxxxxxxxx"   (16-char app password, no spaces)
//   supabase secrets set FROM_EMAIL="ULEReminders <ulereminders@gmail.com>"
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    const user = Deno.env.get("GMAIL_USER");
    const pass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
    const from = Deno.env.get("FROM_EMAIL") || `ULEReminders <${user}>`;
    if (!user || !pass) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD not set");

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: user, password: pass },
      },
    });

    await client.send({
      from,
      to: recipients,
      subject: subject || "(no subject)",
      content: "This message requires an HTML-capable email client.",
      html: html || "",
    });
    await client.close();

    return new Response(JSON.stringify({ sent: recipients.length }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
