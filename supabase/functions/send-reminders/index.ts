/**
 * SEND-REMINDERS — Melry Beauty Studio
 *
 * Envia os e-mails do cliente via EmailJS (API HTTPS, usa o Gmail do remetente):
 *   - client_email_booked : confirmação, logo após agendar (≤45 min)
 *   - client_email_day    : lembrete 24h antes
 *   - client_email_hour   : lembrete ~1h antes
 *
 * Chamada a cada 5 minutos por um cron externo gratuito (cron-job.org).
 * Sem PC ligado, sem servidor.
 *
 * Secrets (supabase secrets set ...):
 *   EMAILJS_SERVICE_ID   - id do serviço (Gmail) no EmailJS
 *   EMAILJS_TEMPLATE_ID  - id do template de e-mail
 *   EMAILJS_PUBLIC_KEY   - chave pública da conta
 *   EMAILJS_PRIVATE_KEY  - chave privada (envio server-side)
 *   CRON_SECRET          - (opcional) se existir, exige o header x-cron-secret
 *   STUDIO_TIMEZONE      - (opcional, default: America/Campo_Grande)
 */

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

// ---------- e-mail (EmailJS) ----------

const money = (v) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Monta as variáveis de um template único do EmailJS (título + linhas)
function buildEmail(kind, b) {
  const service = b.nome || "Atendimento";
  const start = Number(b.start);
  const end = start + (Number(b.dur) || 0);
  const when = `${fmtMinutes(start)} às ${fmtMinutes(end)}`;
  const dateLong = fmtLongDate(b.date);
  const price = Number(b.preco);
  const priceLine = Number.isFinite(price) && price > 0 ? `💰 R$ ${money(price)}` : "";
  const client = b.name || "cliente";

  let title, intro;
  if (kind === "booked") {
    title = "Agendamento confirmado! 💛";
    intro = `Oi, ${client}! Seu agendamento foi confirmado:`;
  } else if (kind === "day") {
    title = "Lembrete: seu atendimento é amanhã! 💛";
    intro = `Oi, ${client}! Só passando pra lembrar do seu horário amanhã:`;
  } else {
    title = "Seu atendimento começa em breve! ✨";
    intro = `Oi, ${client}! Seu horário é hoje:`;
  }

  return {
    params: {
      title,
      line1: intro,
      line2: `💅 ${service}`,
      line3: `📅 ${dateLong} · 🕐 ${when}`,
      line4: priceLine,
      to_name: client,
    },
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
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: env.EMAILJS_SERVICE_ID,
      template_id: env.EMAILJS_TEMPLATE_ID,
      user_id: env.EMAILJS_PUBLIC_KEY,
      accessToken: env.EMAILJS_PRIVATE_KEY,
      template_params: { to_email: to, ...email.params },
    }),
  });
  if (!res.ok) {
    throw new Error(`EmailJS respondeu HTTP ${res.status}: ${await res.text()}`);
  }
}

// ---------- função principal ----------

export default async function handler(req) {
  const env = Deno.env.toObject();
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  try {
    if (env.CRON_SECRET) {
      const given = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
      if (given !== env.CRON_SECRET) return json({ error: "não autorizado" }, 401);
    }
    for (const name of ["EMAILJS_SERVICE_ID", "EMAILJS_TEMPLATE_ID", "EMAILJS_PUBLIC_KEY", "EMAILJS_PRIVATE_KEY"]) {
      if (!env[name]) return json({ error: `${name} não configurada` }, 500);
    }

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
