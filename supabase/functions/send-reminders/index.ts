/**
 * SEND-REMINDERS — Melry Beauty Studio
 *
 * Envia os e-mails do cliente via Gmail SMTP (senha de app):
 *   - client_email_booked : confirmação, logo após agendar (≤45 min)
 *   - client_email_day    : lembrete 24h antes
 *   - client_email_hour   : lembrete ~1h antes
 *
 * Chamada a cada 5 minutos por um cron externo gratuito (cron-job.org).
 * Sem PC ligado, sem servidor.
 *
 * Secrets (supabase secrets set ...):
 *   GMAIL_USER         - default: victorhugowille@gmail.com (depois: o da Maria)
 *   GMAIL_APP_PASSWORD - senha de app do Google (myaccount.google.com/apppasswords)
 *   CRON_SECRET        - (opcional) se existir, exige o header x-cron-secret
 *   STUDIO_TIMEZONE    - (opcional, default: America/Campo_Grande)
 */

import nodemailer from "npm:nodemailer@6";

const HOUR = 60 * 60 * 1000;
const DAY_WINDOW = { maxMs: 24 * HOUR, minMs: 2 * HOUR };
const HOUR_WINDOW_MS = 75 * 60 * 1000;
const BOOKED_WINDOW_MS = 45 * 60 * 1000;

// ---------- datas (mesmo esquema do site: date = "YYYY-MM-DD", start = minutos) ----------

function tzParts(instant, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const part of fmt.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
  };
}

function offsetMs(instant, timeZone) {
  const p = tzParts(instant, timeZone);
  const [y, m, d] = p.date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, p.hour, p.minute) - Math.floor(instant.getTime() / 1000) * 1000;
}

function zonedToUtc(dateStr, minutesOfDay, timeZone) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d || !Number.isFinite(minutesOfDay)) return NaN;
  const wallClock = Date.UTC(y, m - 1, d) + minutesOfDay * 60000;
  let guess = wallClock;
  for (let i = 0; i < 2; i++) {
    const next = wallClock - offsetMs(new Date(guess), timeZone);
    if (next === guess) break;
    guess = next;
  }
  return guess;
}

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const pad = (n) => String(n).padStart(2, "0");
const fmtMinutes = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const fmtLongDate = (dateStr) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));

// ---------- e-mail (Gmail SMTP) ----------

const money = (v) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function htmlCard(title, lines) {
  const body = lines
    .map((l) => `<p style="margin:0 0 6px;font-size:15px;line-height:1.5;color:#4a2f2f">${l}</p>`)
    .join("");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#fdf1f4;font-family:Georgia,serif;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 26px;box-shadow:0 6px 18px rgba(214,116,138,.18)">
    <p style="margin:0 0 14px;font-size:22px;font-weight:bold;color:#c95b79">🌸 Melry Beauty Studio</p>
    <p style="margin:0 0 14px;font-size:18px;font-weight:bold;color:#4a2f2f">${title}</p>
    ${body}
    <p style="margin:18px 0 0;font-size:14px;color:#8a6b6b;border-top:1px solid #f3d5dc;padding-top:12px">Qualquer imprevisto, é só chamar no WhatsApp do estúdio. Te esperamos! ✨</p>
  </div></body></html>`;
}

function buildEmail(kind, b) {
  const service = b.nome || "Atendimento";
  const start = Number(b.start);
  const end = start + (Number(b.dur) || 0);
  const when = `${fmtMinutes(start)} às ${fmtMinutes(end)}`;
  const dateLong = fmtLongDate(b.date);
  const price = Number(b.preco);
  const priceLine = Number.isFinite(price) && price > 0 ? `💰 R$ ${money(price)}` : null;
  const client = b.name || "cliente";

  if (kind === "booked") {
    return {
      subject: "🌸 Agendamento confirmado — Melry Beauty Studio",
      text: [`Oi, ${client}! Seu agendamento foi confirmado:`, `💅 ${service}`, `📅 ${dateLong}`, `🕐 ${when}`, priceLine].filter(Boolean).join("\n"),
      html: htmlCard("Agendamento confirmado! 💛", [`Oi, <strong>${client}</strong>! Seu agendamento foi confirmado:`, `💅 ${service}`, `📅 ${dateLong}`, `🕐 ${when}`, ...(priceLine ? [priceLine] : [])]),
    };
  }
  if (kind === "day") {
    return {
      subject: "💛 Amanhã é o seu dia — Melry Beauty Studio",
      text: [`Oi, ${client}! Só passando pra lembrar do seu horário amanhã:`, `💅 ${service}`, `📅 ${dateLong}`, `🕐 ${when}`].join("\n"),
      html: htmlCard("Lembrete: seu atendimento é amanhã! 💛", [`Oi, <strong>${client}</strong>! Só passando pra lembrar do seu horário amanhã:`, `💅 ${service}`, `📅 ${dateLong}`, `🕐 ${when}`]),
    };
  }
  return {
    subject: "✨ Falta pouquinho — Melry Beauty Studio",
    text: [`Oi, ${client}! Seu horário é hoje:`, `💅 ${service}`, `🕐 ${when}`].join("\n"),
    html: htmlCard("Seu atendimento começa em breve! ✨", [`Oi, <strong>${client}</strong>! Seu horário é hoje:`, `💅 ${service}`, `🕐 ${when}`]),
  };
}

// ---------- Supabase REST ----------

function rest(env, path, init) {
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(init?.headers || {}),
    },
  });
}

async function reserveReminder(env, bookingId, kind) {
  const res = await rest(env, "reminders_log", {
    method: "POST",
    body: JSON.stringify([{ booking_id: bookingId, kind }]),
  });
  if (res.ok) return true;
  if (res.status === 409) return false; // já enviado
  throw new Error(`Falha ao registrar lembrete (HTTP ${res.status}): ${await res.text()}`);
}

async function releaseReminder(env, bookingId, kind) {
  await rest(env, `reminders_log?booking_id=eq.${encodeURIComponent(bookingId)}&kind=eq.${encodeURIComponent(kind)}`, { method: "DELETE" });
}

async function sendMail(env, to, email) {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
  });
  await transport.sendMail({
    from: `Melry Beauty Studio <${env.GMAIL_USER}>`,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

// ---------- função principal ----------

export default async function handler(req) {
  const env = Deno.env.toObject();
  if (!env.GMAIL_USER) env.GMAIL_USER = "victorhugowille@gmail.com";
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  try {
    if (env.CRON_SECRET) {
      const given = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
      if (given !== env.CRON_SECRET) return json({ error: "não autorizado" }, 401);
    }
    if (!env.GMAIL_APP_PASSWORD) return json({ error: "GMAIL_APP_PASSWORD não configurada" }, 500);

    const timeZone = env.STUDIO_TIMEZONE || "America/Campo_Grande";
    const now = new Date();
    const today = tzParts(now, timeZone).date;
    const limit = addDays(today, 3);

    const res = await rest(env, `bookings?select=id,nome,preco,date,start,dur,name,email,status,created_at&status=eq.confirmado&date=gte.${today}&date=lte.${limit}&email=not.is.null&order=date.asc,start.asc&limit=200`);
    if (!res.ok) return json({ error: `Falha ao ler agendamentos (HTTP ${res.status})`, detail: await res.text() }, 502);
    const bookings = await res.json();

    const sent = [];
    const skipped = [];

    for (const b of bookings) {
      if (!b.email) continue;
      const startMs = zonedToUtc(b.date, Number(b.start), timeZone);
      if (!Number.isFinite(startMs)) continue;
      const remaining = startMs - now.getTime();
      const createdAt = b.created_at ? new Date(b.created_at).getTime() : 0;

      const due = [];
      if (createdAt && now.getTime() - createdAt <= BOOKED_WINDOW_MS) due.push("booked");
      if (b.date === addDays(today, 1) && remaining <= DAY_WINDOW.maxMs && remaining > DAY_WINDOW.minMs) due.push("day");
      if (remaining > 0 && remaining <= HOUR_WINDOW_MS) due.push("hour");

      for (const kind of due) {
        const logKind = `client_email_${kind}`;
        try {
          const reserved = await reserveReminder(env, b.id, logKind);
          if (!reserved) { skipped.push(`${logKind}:${b.id} (já enviado)`); continue; }
          await sendMail(env, b.email, buildEmail(kind, b));
          sent.push(`${logKind}:${b.id}`);
        } catch (err) {
          console.error(`Falha em ${logKind} para ${b.id}:`, err);
          await releaseReminder(env, b.id, logKind).catch(() => undefined);
        }
      }
    }

    return json({ ok: true, analisados: bookings.length, enviados: sent, repetidos: skipped });
  } catch (err) {
    console.error("Erro no send-reminders:", err);
    return json({ error: String(err?.message || err) }, 500);
  }
}
