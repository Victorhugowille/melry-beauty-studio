/**
 * SEND-REMINDERS — Melry Beauty Studio
 *
 * O que faz, a cada chamada (cron de 1 em 1 minuto, ver sql/notifications.sql):
 *   1) E-mails para a CLIENTE (via EmailJS):
 *      - client_email_booked : confirmação, logo após agendar (≤45 min)
 *      - client_email_day    : lembrete 24h antes
 *      - client_email_hour   : lembrete ~1h antes
 *      e uma cópia de cada um para o estúdio (STUDIO_EMAIL)
 *   2) Drena a fila email_outbox (tabela criada por sql/email-outbox.sql):
 *      avisos de troca de horário feitos pela cliente em "Minhas Agendas".
 *
 * IMPORTANTE: a função precisa registrar o handler com Deno.serve() —
 * um simples "export default" nunca atende a requisição e ela trava para
 * sempre (era a razão de nenhum e-mail ter chegado).
 *
 * Deploy:
 *   supabase functions deploy send-reminders --project-ref oahywgiwvrjpnqwuffem
 *
 * Secrets (supabase secrets set NOME=valor --project-ref ...):
 *   EMAILJS_SERVICE_ID   - id do serviço (Gmail) no EmailJS
 *   EMAILJS_TEMPLATE_ID  - id do template de e-mail
 *   EMAILJS_PUBLIC_KEY   - chave pública da conta
 *   EMAILJS_PRIVATE_KEY  - chave privada (envio server-side)
 *   STUDIO_EMAIL         - (opcional) cópia de tudo para o estúdio; default: mlemepadilha@gmail.com
 *   CRON_SECRET          - (opcional) se existir, exige o header x-cron-secret.
 *                          ATENÇÃO: se você ligar, o cron do sql/notifications.sql
 *                          precisa mandar exatamente o mesmo valor no header,
 *                          senão os avisos param de novo.
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

// Registro no log visível no painel (aba Testes). Nunca quebra o envio.
async function logEmail(env, row) {
  try {
    await rest(env, "email_log", { method: "POST", body: JSON.stringify([row]) });
  } catch (err) {
    console.warn("Não foi possível gravar no email_log:", err);
  }
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

// Drena a fila email_outbox: avisos de troca de horário (Minhas Agendas).
// Se a tabela ainda não existir, ignora sem quebrar os lembretes normais.
async function drainOutbox(env) {
  const res = await rest(env, "email_outbox?select=id,to_email,params,created_at&sent_at=is.null&order=created_at.asc&limit=50");
  if (!res.ok) {
    console.warn("email_outbox ausente ou indisponível (HTTP", res.status + "). Rode sql/email-outbox.sql no Supabase.");
    return { total: 0, sent: 0, error: `HTTP ${res.status}` };
  }
  const rows = await res.json();
  const sent = [];
  for (const row of rows) {
    try {
      await sendMail(env, row.to_email, { params: row.params || {} });
      await rest(env, `email_outbox?id=eq.${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sent_at: new Date().toISOString() }),
      });
      sent.push(row.id);
      await logEmail(env, {
        kind: "outbox",
        to_email: row.to_email,
        status: "ok",
        detail: "EmailJS 200 (fila de alteração de horário)",
      });
    } catch (err) {
      console.error(`Falha ao enviar e-mail da fila (id ${row.id}):`, err);
      await logEmail(env, {
        kind: "outbox",
        to_email: row.to_email,
        status: "erro",
        detail: String(err?.message || err),
      });
      await rest(env, `email_outbox?id=eq.${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ error: String(err?.message || err) }),
      }).catch(() => undefined);
    }
  }
  return { total: rows.length, sent: sent.length };
}

// ---------- função principal ----------

const handler = async (req: Request) => {
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
    const studioEmail = env.STUDIO_EMAIL || "mlemepadilha@gmail.com";

    const timeZone = env.STUDIO_TIMEZONE || "America/Campo_Grande";
    const now = new Date();
    const today = tzParts(now, timeZone).date;
    const limit = addDays(today, 3);
    // Confirmação: agendamentos criados nos últimos 45 min (qualquer data futura)
    const createdSince = new Date(now.getTime() - BOOKED_WINDOW_MS).toISOString();

    const base = "bookings?select=id,nome,preco,date,start,dur,name,email,status,created_at";
    const common = "status=eq.confirmado&email=not.is.null&email=neq.";
    const [upcomingRes, bookedRes] = await Promise.all([
      rest(env, `${base}&${common}&date=gte.${today}&date=lte.${limit}&order=date.asc,start.asc&limit=200`),
      // Sem limite de data: quem agenda para daqui a 2 meses também recebe
      // a confirmação na hora. O cliente "day/hour" só roda na janela dos próximos 3 dias.
      rest(env, `${base}&${common}&created_at=gte.${encodeURIComponent(createdSince)}&order=created_at.asc&limit=100`),
    ]);
    if (!upcomingRes.ok) return json({ error: `Falha ao ler agendamentos (HTTP ${upcomingRes.status})`, detail: await upcomingRes.text() }, 502);
    if (!bookedRes.ok) return json({ error: `Falha ao ler agendamentos recentes (HTTP ${bookedRes.status})`, detail: await bookedRes.text() }, 502);

    const merged = new Map();
    for (const b of await upcomingRes.json()) merged.set(b.id, b);
    for (const b of await bookedRes.json()) if (!merged.has(b.id)) merged.set(b.id, b);
    const bookings = [...merged.values()];

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
        const email = buildEmail(kind, b);
        const deliver = async (to, logKind) => {
          try {
            const reserved = await reserveReminder(env, b.id, logKind);
            if (!reserved) { skipped.push(`${logKind}:${b.id} (já enviado)`); return; }
            await sendMail(env, to, email);
            sent.push(`${logKind}:${b.id}`);
            await logEmail(env, { kind: logKind, to_email: to, booking_id: b.id, status: "ok", detail: "EmailJS 200" });
          } catch (err) {
            console.error(`Falha em ${logKind} para ${b.id}:`, err);
            await logEmail(env, { kind: logKind, to_email: to, booking_id: b.id, status: "erro", detail: String(err?.message || err) });
            await releaseReminder(env, b.id, logKind).catch(() => undefined);
          }
        };
        await deliver(b.email, `client_email_${kind}`);
        await deliver(studioEmail, `studio_email_${kind}`);
      }
    }

    const outbox = await drainOutbox(env);

    return json({ ok: true, analisados: bookings.length, enviados: sent, repetidos: skipped, fila: outbox });
  } catch (err) {
    console.error("Erro no send-reminders:", err);
    return json({ error: String(err?.message || err) }, 500);
  }
};

Deno.serve(handler);
