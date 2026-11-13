/**
 * BOT DE AVISOS PARA O CLIENTE (push no aparelho — grátis)
 *
 * Roda a cada 10 minutos no GitHub Actions e envia três avisos, todos
 * de graça (Web Push):
 *   - "client_booked": assim que o agendamento é confirmado
 *   - "client_day":    24 horas antes
 *   - "client_hour":   ~1 hora antes
 *
 * O cliente ativa os avisos na tela de "Agendamento confirmado" do site
 * (o navegador gera uma assinatura única salva em `push_subscriptions`).
 *
 * Duplicatas são controladas pela tabela reminders_log (coluna `kind`).
 *
 * Uso:
 *   node scripts/send-client-push.mjs           # execução normal
 *   node scripts/send-client-push.mjs --dry-run # só mostra o que faria
 *   node scripts/send-client-push.mjs --test    # envia um aviso de teste para todas as inscrições
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

import { loadConfig } from "./lib/config.mjs";
import { createSupabase } from "./lib/supabase.mjs";
import { findDueReminders } from "./lib/reminders.mjs";
import { addDays, formatLongDate, formatMinutes, tzParts } from "./lib/time.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const truthy = (value) => ["1", "true", "yes"].includes(String(value || "").toLowerCase());
const dryRun = flags.has("--dry-run") || truthy(process.env.DRY_RUN);
const testMode = flags.has("--test") || truthy(process.env.TEST_MESSAGE);

function log(...args) {
  console.log(...args);
}

function readVapidPublicKey() {
  try {
    const src = readFileSync(path.join(ROOT, "js", "push-config.js"), "utf8");
    return src.match(/PUSH_VAPID_PUBLIC_KEY\s*=\s*["']([^"']+)["']/)?.[1] || "";
  } catch {
    return "";
  }
}

const VAPID_PUBLIC_KEY = readVapidPublicKey();
const VAPID_PRIVATE_KEY = String(process.env.VAPID_PRIVATE_KEY || "");
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:studio.melry@gmail.com";

function isConfigured() {
  return !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY;
}

function minutesUntil(remainingMs) {
  return Math.max(1, Math.round(remainingMs / 60000));
}

function buildBookedMessage(booking) {
  return [
    "🌸 Agendamento confirmado!",
    "",
    `📅 ${formatLongDate(booking.date)}`,
    `🕘 ${formatMinutes(Number(booking.start))}`,
    `💅 ${booking.nome || "Atendimento"}`,
    "",
    "Te esperamos! Qualquer imprevisto, fale com a Maria."
  ].join("\n");
}

function buildClientMessage({ booking, kind, remainingMs }) {
  const start = Number(booking.start);
  const end = start + (Number(booking.dur) || 0);
  const when = `${formatMinutes(start)} às ${formatMinutes(end)}`;
  const date = formatLongDate(booking.date);
  const service = booking.nome || "Atendimento";

  if (kind === "day") {
    return [
      "🌸 Lembrete: seu atendimento é *amanhã*!",
      "",
      `📅 ${date}`,
      `🕘 ${when} · ${service}`,
      "",
      "Te esperamos 💛"
    ].join("\n");
  }

  const minutes = minutesUntil(remainingMs);
  const relative =
    minutes <= 5 ? "em instantes" : minutes <= 55 ? `em ${minutes} min` : "em 1 hora";
  return [
    `🌸 Seu atendimento começa *${relative}*!`,
    "",
    `🕘 Hoje, ${when}`,
    `💅 ${service}`,
    "",
    "Te esperamos ✨"
  ].join("\n");
}

async function sendToAll(rows, payload) {
  const body = JSON.stringify(payload);
  let sent = 0;
  let gone = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, body);
      sent++;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        gone++;
        await row.ctx.db.deletePushSubscription(row.id);
      } else {
        failed++;
        log(`   ❌ Falha ao enviar para inscrição ${row.id}: ${error.message}`);
      }
    }
  }
  return { sent, gone, failed };
}

async function main() {
  const config = loadConfig();
  const db = createSupabase(config);

  if (testMode) {
    if (!isConfigured()) {
      log("⚠️  VAPID não configurado (VAPID_PRIVATE_KEY ausente). Nada enviado.");
      return;
    }
    if (dryRun) {
      log("🧪 Modo dry-run: o teste não foi enviado.");
      return;
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const rows = await db.listAllSubscriptions();
    log(`📱 Enviando teste para ${rows.length} inscrição(ões)…`);
    const result = await sendToAll(
      rows.map((row) => ({ ...row, ctx: { db } })),
      {
        title: "Melry Beauty Studio",
        body: "🌸 Teste do sistema de lembretes ✓\nSe você recebeu, os avisos vão chegar neste aparelho.",
        icon: "assets/app-icon.png",
        url: "./"
      }
    );
    log(`Resumo: ${result.sent} enviada(s), ${result.gone} removida(s), ${result.failed} falha(s).`);
    return;
  }

  if (!isConfigured() && !dryRun) {
    log("⚠️  VAPID não configurado.");
    log("   Adicione o secret VAPID_PRIVATE_KEY no GitHub (o público já está no js/push-config.js).");
    log("   Sem ele o bot não envia nada (os avisos do WhatsApp seguem funcionando).");
    return;
  }

  if (isConfigured()) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const now = new Date();
  const today = tzParts(now, config.timezone).date;
  const tomorrow = addDays(today, 1);

  log(`🕒 Agora: ${now.toISOString()} (${config.timezone}: ${today})`);

  const bookings = await db.listConfirmedBookings(today, tomorrow);
  const subs = await db.listSubscriptions(bookings.map((b) => b.id));
  const subsByBooking = new Map();
  for (const row of subs) {
    if (!subsByBooking.has(row.booking_id)) subsByBooking.set(row.booking_id, []);
    subsByBooking.get(row.booking_id).push(row);
  }
  log(`📋 Agendamentos confirmados entre ${today} e ${tomorrow}: ${bookings.length} (${subs.length} inscrição(ões) push)`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const deliver = async (booking, kind, payload) => {
    const rows = (subsByBooking.get(booking.id) || []).map((row) => ({ ...row, ctx: { db } }));
    if (!rows.length) {
      skipped++;
      return;
    }
    const reservation = await db.reserveReminder(booking.id, `client_${kind}`);
    if (reservation.status === "duplicate") {
      skipped++;
      return;
    }
    const result = await sendToAll(rows, payload);
    sent += result.sent;
    if (result.failed > 0) {
      failed++;
      await db.releaseReminder(booking.id, `client_${kind}`);
    } else {
      log(`✅ Aviso ${kind} enviado (${booking.date} · ${booking.name})`);
    }
  };

  // 1) Confirmação imediata (client_booked)
  for (const booking of bookings) {
    const payload = {
      title: "Melry Beauty Studio",
      body: buildBookedMessage(booking),
      icon: "assets/app-icon.png",
      tag: `${booking.id}-booked`,
      url: "./"
    };
    if (dryRun) {
      log(`\n--- [dry-run] client_booked • ${booking.date} ${booking.name} ---\n${payload.body}`);
      continue;
    }
    await deliver(booking, "booked", payload);
  }

  // 2) Lembretes de 1 dia e 1 hora antes
  for (const item of findDueReminders(bookings, now, config.timezone)) {
    const payload = {
      title: "Melry Beauty Studio",
      body: buildClientMessage(item),
      icon: "assets/app-icon.png",
      tag: `${item.booking.id}-${item.kind}`,
      url: "./"
    };
    if (dryRun) {
      log(`\n--- [dry-run] client_${item.kind} • ${item.booking.date} ${item.booking.name} ---\n${payload.body}`);
      continue;
    }
    await deliver(item.booking, item.kind, payload);
  }

  log(
    dryRun
      ? `\n🧪 Dry-run concluído.`
      : `\nResumo: ${sent} aviso(s) enviado(s), ${skipped} pulado(s), ${failed} falha(s).`
  );

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  const pg = /reminders_log|push_subscriptions/i.test(error.message);
  console.error("❌ " + error.message);
  if (pg) {
    console.error("   Rode o arquivo sql/notifications.sql no SQL Editor do Supabase.");
  }
  process.exitCode = 1;
});
