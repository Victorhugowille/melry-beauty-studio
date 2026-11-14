/**
 * BOT DE LEMBRETES PARA O CLIENTE (WhatsApp Web — grátis)
 *
 * Roda a cada N minutos no host sempre ligado e envia:
 *   - confirmação do agendamento,
 *   - lembretes de 1 dia antes,
 *   - lembretes de ~1 hora antes.
 *
 * Usa whatsapp-web.js + QR code para login uma vez.
 */

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";

import { loadConfig } from "../../scripts/lib/config.mjs";
import { createSupabase } from "../../scripts/lib/supabase.mjs";
import { findDueReminders } from "../../scripts/lib/reminders.mjs";
import {
  addDays,
  formatLongDate,
  formatMinutes,
  tzParts,
  formatPhone,
  formatDuration,
} from "../../scripts/lib/time.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const flags = new Set(process.argv.slice(2));
const truthy = (value) => ["1", "true", "yes"].includes(String(value || "").toLowerCase());
const dryRun = flags.has("--dry-run") || truthy(process.env.DRY_RUN);
const testMode = flags.has("--test") || truthy(process.env.TEST_MESSAGE);

function log(...args) {
  console.log(...args);
}

// Formatação do número de WhatsApp
function getChatId(rawNumber) {
  const digits = String(rawNumber || "").replace(/\D/g, "");
  if (digits.length === 12 || digits.length === 13) return `+${digits.slice(2)}@c.us`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}@c.us`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}@c.us`;
  return null;
}

// Confirmação do agendamento
function buildConfirmation(booking) {
  const lines = [
    "🌸 *Melry Beauty Studio*",
    "",
    "🌸 *Agendamento confirmado!*",
    "",
    `📅 ${formatLongDate(booking.date)}`,
    `🕘 ${formatMinutes(Number(booking.start))} às ${formatMinutes(Number(booking.start) + (Number(booking.dur) || 0))}`,
    `💅 ${booking.nome || "Atendimento"}`,
    "",
    `👤 ${booking.name || "Cliente"}`,
    `📱 ${getChatId(booking.phone)}`,
    "",
    "(Mensagem de confirmação automática)",
  ];
  if (Number.isFinite(Number(booking.preco)) && Number(booking.preco) > 0) {
    lines.push(`💰 R$ ${Number(booking.preco).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
  }
  if (Number(booking.dur) > 0) {
    lines.push(`⏳ Duração: ${formatDuration(Number(booking.dur))}`);
  }
  return lines.join("\n");
}

// Lembrete de 1 dia ou 1 hora antes
function buildReminder(item) {
  const { booking, kind, remainingMs } = item;
  const start = Number(booking.start);
  const end = start + (Number(booking.dur) || 0);
  const when = `${formatMinutes(start)} às ${formatMinutes(end)}`;
  const date = formatLongDate(booking.date);
  const service = booking.nome || "Atendimento";
  const minutes = Math.max(1, Math.round(remainingMs / 60000));
  const relative = minutes <= 5 ? "em instantes" : minutes <= 55 ? `em ${minutes} min` : "em 1 hora";
  const clientName = booking.name || "Cliente";
  const phone = formatPhone(booking.phone);

  if (kind === "day") {
    return [
      "🌸 *Melry Beauty Studio*",
      "",
      `🌸 *Lembrete: seu atendimento é amanhã!*`,
      "",
      `📅 ${date}`,
      `🕘 ${when} · ${service}`,
      `👤 ${clientName}`,
      `📱 ${phone}`,
      "",
      "Te esperamos 💛"
    ].join("\n");
  }

  return [
    "🌸 *Melry Beauty Studio*",
    "",
    `🌸 Seu atendimento começa *${relative}*!`,
    "",
    `🕘 Hoje, ${when}`,
    `💅 ${service}`,
    `👤 ${clientName}`,
    `📱 ${phone}`,
    "",
    "Te esperamos ✨"
  ].join("\n");
}

async function sendMessage(client, chatId, text) {
  try {
    await client.sendMessage(chatId, text);
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  const config = loadConfig();
  const supabase = createSupabase({ url: config.url, anonKey: config.anonKey });
  const timezone = config.timezone || "America/Campo_Grande";

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" })
  });

  // Mostra o QR Code quando o cliente ainda não está autenticado
  client.on("qr", (qr) => {
    console.log("📲 QR Code gerado! Escaneie com o app do WhatsApp.");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp conectado! Bot aguardando agendamentos...");
  });

  client.on("message", async (msg) => {
    // Opcional: ignorar mensagens recebidas
  });

  await client.initialize();

  let firstRun = true;

  async function tick() {
    if (firstRun) {
      firstRun = false;
      log("🔁 Primeiro ciclo inicializado (sem confirmados antigos).");
    }

    const now = new Date();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    const fromDate = new Date().toISOString().split("T")[0];
    const toDate = new Date(Date.now() + sixtyDaysMs).toISOString().split("T")[0];

    try {
      const bookings = await supabase.listConfirmedBookings(fromDate, toDate);
      // 1) Confirmações de agendamento
      for (const b of bookings) {
        const text = buildConfirmation(b);
        if (dryRun) {
          log(`🧪 [dry-run] Confirmado • ${b.id} ${b.date}`);
          log(text);
          continue;
        }
        const chatId = getChatId(b.phone);
        if (!chatId) {
          console.warn(`⚠️ Não foi possível formatar o número ${b.phone}`);
          continue;
        }
        const reservation = await supabase.reserveReminder(b.id, "client_wa_booked");
        if (reservation.status === "duplicate") {
          continue;
        }
        try {
          await client.sendMessage(chatId, text);
          log(`✅ Confirmado enviado para ${b.id} (${b.date})`);
        } catch (e) {
          console.error(`❌ Falha ao enviar confirmação para ${b.id}:`, e.message);
          await supabase.releaseReminder(b.id, "client_wa_booked");
        }
      }

      // 2) Lembretes de 1 dia e 1 hora antes
      const due = findDueReminders(bookings, now, timezone);
      for (const item of due) {
        const text = buildReminder(item);
        if (dryRun) {
          log(`🧪 [dry-run] Lembrete ${item.kind} • ${item.booking.id} ${item.booking.date}`);
          log(text);
          continue;
        }
        const reservation = await supabase.reserveReminder(item.booking.id, `client_wa_${item.kind}`);
        if (reservation.status === "duplicate") {
          continue;
        }
        const chatId = getChatId(item.booking.phone);
        if (!chatId) {
          console.warn(`⚠️ Não foi possível formatar o número ${item.booking.phone}`);
          await supabase.releaseReminder(item.booking.id, `client_wa_${item.kind}`);
          continue;
        }
        try {
          await client.sendMessage(chatId, text);
          log(`✅ Lembrete ${item.kind} enviado para ${item.booking.id} (${item.booking.date})`);
        } catch (e) {
          console.error(`❌ Falha ao enviar lembrete ${item.kind} para ${item.booking.id}:`, e.message);
          await supabase.releaseReminder(item.booking.id, `client_wa_${item.kind}`);
        }
      }
    } catch (e) {
      console.error("❌ Erro no tick:", e.message);
    }
  }

  // Executa imediatamente e depois a cada POLL_INTERVAL
  const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS) || 120000; // 2 min
  tick(); // inicialização
  setInterval(tick, POLL_INTERVAL);
}

main().catch((error) => {
  console.error("❌ Bot falhou:", error.message);
  process.exitCode = 1;
});
