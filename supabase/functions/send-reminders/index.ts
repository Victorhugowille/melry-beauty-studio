/**
 * SEND-REMINDERS — Melry Beauty Studio
 *
 * Envia os e-mails do cliente via Brevo:
 *   - client_email_booked : confirmação, logo após agendar (≤45 min)
 *   - client_email_day    : lembrete 24h antes
 *   - client_email_hour   : lembrete ~1h antes
 *
 * Pensada para ser chamada a cada 5 minutos por um cron externo
 * gratuito (ex.: cron-job.org). Sem sessão, sem PC ligado.
 *
 * Secrets (supabase secrets set ...):
 *   BREVO_API_KEY    - chave da API do Brevo
 *   BREVO_SENDER     - remetente verificado (default: victorhugowille@gmail.com)
 *   CRON_SECRET      - (opcional) se existir, exige o header x-cron-secret
 *   STUDIO_TIMEZONE  - (opcional, default: America/Campo_Grande)
 */

const HOUR = 60 * 60 * 1000;
const DAY_WINDOW = { maxMs: 24 * HOUR, minMs: 2 * HOUR };
const HOUR_WINDOW_MS = 75 * 60 * 1000;
const BOOKED_WINDOW_MS = 45 * 60 * 1000;

// ---------- datas (mesmo esquema do site: date = "YYYY-MM-DD", start = minutos) ----------

function tzParts(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
  };
}

function offsetMs(instant: Date, timeZone: string) {
  const p = tzParts(instant, timeZone);
  const [y, m, d] = p.date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, p.hour, p.minute) - Math.floor(instant.getTime() / 1000) * 1000;
}

function zonedToUtc(dateStr: string, minutesOfDay: number, timeZone: string) {
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

const addDays = (dateStr: string, days: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmtMinutes = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const fmtLongDate = (dateStr: string, timeZone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));

// ---------- e-mail (Brevo) ----------

const money = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function htmlCard(title: string, lines: string[]) {
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

function buildEmail(kind: "booked" | "day" | "hour", b: any) {
  const service = b.nome || "Atendimento";
  const start = Number(b.start);
  const end = start + (Number(b.dur) || 0);
  const when = `${fmtMinutes(start)} às ${fmtMinutes(end)}`;
  const dateLong = fmtLongDate(b.date, "UTC");
  const price = Number(b.preco);
  const priceLine = Number.isFinite(price) && price > 0 ? `💰 R$ ${money(price)}` : null;
  const client = b.name || "cliente";

  if (kind === "booked") {
    return {
      subject: "🌸 Agendamento confirmado — Melry Beauty Studio",
      title: "Agendamento confirmado! 💛",
      text: [`Oi, ${client}! Seu agendamento foi confirmado:`, `💅 ${service}`, `📅 ${dateLong}`, `🕐 ${when}`, priceLine].filter(Boolean).join("\n"),
      html: htmlCard("Agendamento confirmado! 💛", [`Oi, <strong>${client}</strong>! Seu agendamento foi confirmado:`, `💅 ${service}`, `📅 ${dateLong}`, `🕐 ${when}`, ...(priceLine ? [priceLine] : [])]),
    };
  }
  if (kind === "day") {
    return {
      subject: "💛 Amanhã é o seu dia — Melry Beauty Studio",
      title: "Lembrete: seu atendimento é amanhã! 💛",
      text: [`Oi, ${client}! Só passando pra lembrar do seu horário amanhã:`, `💅 ${service}`, `📅 ${dateLong}`, `🕐 ${when}`].join("\n"),
      html: htmlCard("Lembrete: seu atendimento é amanhã! 💛", [`Oi, <strong>${client}</strong>! Só passando pra lembrar do seu horário amanhã:`, `💅 ${service}`, `📅 ${dateLong}`, `🕐 ${when}`]),
    };
  }
  return {
    subject: "✨ Falta pouquinho — Melry Beauty Studio",
    title: "Seu atendimento começa em breve! ✨",
    text: [`Oi, ${client}! Seu horário é hoje:`, `💅 ${service}`, `🕐 ${when}`].join("\n"),
    html: htmlCard("Seu atendimento começa em breve! ✨", [`Oi, <strong>${client}</strong>! Seu horário é hoje:`, `💅 ${service}`, `🕐 ${when}`]),
  };
}

// ---------- Supabase REST ----------

function rest(env: Record<string, string>, path: string, init?: RequestInit) {
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

async function reserveReminder(env: Record<string, string>, bookingId: string, kind: string) {
  const res = await rest(env, "reminders_log", {
    method: "POST",
    body: JSON.stringify([{ booking_id: bookingId, kind }]),
  });
  if (res.ok) return true;
  if (res.status === 409) return false; // já enviado
  throw new Error(`Falha ao registrar lembrete (HTTP ${res.status}): ${await res.text()}`);
}

async function releaseReminder(env: Record<string, string>, bookingId: string, kind: string) {
  await rest(env, `reminders_log?booking_id=eq.${encodeURIComponent(bookingId)}&kind=eq.${encodeURIComponent(kind)}`, { method: "DELETE" });
}

async function sendBrevo(env: Record<string, string>, to: string, email: { subject: string; html: string; text: string }) {
  const sender = env.BREVO_SENDER || "victorhugowille@gmail.com";
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Melry Beauty Studio", email: sender },
      to: [{ email: to }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Brevo respondeu HTTP ${res.status}: ${await res.text()}`);
  }
}

// ---------- função principal ----------

export default async function handler(req: Request): Promise<Response> {
  const env = Deno.env.toObject();
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  try {
    if (env.CRON_SECRET) {
      const given = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
      if (given !== env.CRON_SECRET) return json({ error: "não autorizado" }, 401);
    }
    if (!env.BREVO_API_KEY) return json({ error: "BREVO_API_KEY não configurada" }, 500);

    const timeZone = env.STUDIO_TIMEZONE || "America/Campo_Grande";
    const now = new Date();
    const today = tzParts(now, timeZone).date;
    const limit = addDays(today, 3);

    const res = await rest(env, `bookings?select=id,nome,preco,date,start,dur,name,email,status,created_at&status=eq.confirmado&date=gte.${today}&date=lte.${limit}&email=not.is.null&order=date.asc,start.asc&limit=200`);
    if (!res.ok) return json({ error: `Falha ao ler agendamentos (HTTP ${res.status})`, detail: await res.text() }, 502);
    const bookings = (await res.json()) as any[];

    const sent: string[] = [];
    const skipped: string[] = [];

    for (const b of bookings) {
      if (!b.email) continue;
      const startMs = zonedToUtc(b.date, Number(b.start), timeZone);
      if (!Number.isFinite(startMs)) continue;
      const remaining = startMs - now.getTime();
      const createdAt = b.created_at ? new Date(b.created_at).getTime() : 0;
      const dateStr = b.date;

      const due: Array<"booked" | "day" | "hour"> = [];
      if (createdAt && now.getTime() - createdAt <= BOOKED_WINDOW_MS) due.push("booked");
      if (dateStr === addDays(today, 1) && remaining <= DAY_WINDOW.maxMs && remaining > DAY_WINDOW.minMs) due.push("day");
      if (remaining > 0 && remaining <= HOUR_WINDOW_MS) due.push("hour");

      for (const kind of due) {
        const logKind = `client_email_${kind}`;
        try {
          const reserved = await reserveReminder(env, b.id, logKind);
          if (!reserved) { skipped.push(`${logKind}:${b.id} (já enviado)`); continue; }
          await sendBrevo(env, b.email, buildEmail(kind, b));
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
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
}
