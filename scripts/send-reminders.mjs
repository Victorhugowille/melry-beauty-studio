/**
 * BOT DE LEMBRETES NO WHATSAPP
 *
 * Roda a cada 10 minutos no GitHub Actions e avisa a Maria:
 *   - 24 horas antes do atendimento
 *   - cerca de 1 hora antes
 *
 * Uso:
 *   node scripts/send-reminders.mjs           # execução normal
 *   node scripts/send-reminders.mjs --dry-run # só mostra o que faria
 *   node scripts/send-reminders.mjs --test    # envia mensagem de teste
 */

import { loadConfig } from "./lib/config.mjs";
import { createSupabase } from "./lib/supabase.mjs";
import { createWhatsApp } from "./lib/whatsapp.mjs";
import { buildMessage, buildTestMessage, findDueReminders } from "./lib/reminders.mjs";
import { addDays, tzParts } from "./lib/time.mjs";

const flags = new Set(process.argv.slice(2));
const truthy = (value) => ["1", "true", "yes"].includes(String(value || "").toLowerCase());
const dryRun = flags.has("--dry-run") || truthy(process.env.DRY_RUN);
const testMode = flags.has("--test") || truthy(process.env.TEST_MESSAGE);

function log(message) {
  console.log(message);
}

async function main() {
  const config = loadConfig();
  const whatsapp = createWhatsApp();

  if (testMode) {
    const text = buildTestMessage();
    if (dryRun) {
      log("🧪 Modo dry-run: mensagem de teste não enviada.\n");
      log(text);
      return;
    }
    if (!whatsapp.isConfigured()) {
      log("⚠️  WhatsApp não configurado (CALLMEBOT_APIKEY ausente). Nada enviado.");
      return;
    }
    const result = await whatsapp.send(text);
    log(`✅ Mensagem de teste enviada para ${whatsapp.describe()}: ${result}`);
    return;
  }

  if (!whatsapp.isConfigured() && !dryRun) {
    log("⚠️  WhatsApp não configurado.");
    log("   Ative o CallMeBot e salve a API key no secret CALLMEBOT_APIKEY.");
    log("   Sem isso o bot não envia nada (o keep-alive do Supabase segue funcionando).");
    return;
  }

  const now = new Date();
  const today = tzParts(now, config.timezone).date;
  const tomorrow = addDays(today, 1);

  log(`🕒 Agora: ${now.toISOString()} (${config.timezone}: ${today})`);

  const db = createSupabase(config);
  const bookings = await db.listConfirmedBookings(today, tomorrow);
  log(`📋 Agendamentos confirmados entre ${today} e ${tomorrow}: ${bookings.length}`);

  const due = findDueReminders(bookings, now, config.timezone);
  if (!due.length) {
    log("✅ Nenhum lembrete devido neste ciclo.");
    return;
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of due) {
    const { booking, kind } = item;
    const label = `${kind === "day" ? "24h" : "1h"} • ${booking.date} ${booking.name}`;

    if (dryRun) {
      log(`\n--- [dry-run] ${label} ---`);
      log(buildMessage(item, config.timezone));
      continue;
    }

    const reservation = await db.reserveReminder(booking.id, kind);
    if (reservation.status === "duplicate") {
      skipped++;
      log(`↩️  Já enviado antes, ignorando: ${label}`);
      continue;
    }

    try {
      await whatsapp.send(buildMessage(item, config.timezone));
      sent++;
      log(`✅ Lembrete enviado (${label})`);
    } catch (error) {
      failed++;
      log(`❌ Falha ao enviar (${label}): ${error.message}`);
      await db.releaseReminder(booking.id, kind);
    }
  }

  log(
    dryRun
      ? `\n🧪 Dry-run concluído: ${due.length} lembrete(s) devido(s).`
      : `\nResumo: ${sent} enviado(s), ${skipped} já enviado(s), ${failed} falha(s).`
  );

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("❌ " + error.message);
  process.exitCode = 1;
});
