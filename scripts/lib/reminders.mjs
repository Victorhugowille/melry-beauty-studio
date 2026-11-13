/**
 * REGRAS DOS LEMBRETES
 * Decide, para cada agendamento confirmado, se já é hora de avisar a Maria:
 *   - "day":  exatamente 24h antes (tolerância p/ atraso do agendador)
 *   - "hour": pouco antes de faltar 1 hora
 * Também monta o texto da mensagem.
 */

import { addDays, formatDuration, formatLongDate, formatMinutes, formatPhone, tzParts, zonedToUtc } from "./time.mjs";

const HOUR = 60 * 60 * 1000;

// Janelas: o robô roda a cada 10 minutos, então há folga para atrasos do GitHub.
export const DAY_WINDOW = { maxMs: 24 * HOUR, minMs: 3 * HOUR };
export const HOUR_WINDOW = { maxMs: 75 * 60 * 1000, minMs: 0 };

/**
 * @returns {Array<{booking: object, kind: 'day'|'hour', remainingMs: number}>}
 */
export function findDueReminders(bookings, now, timeZone) {
  const nowMs = now.getTime();
  const today = tzParts(now, timeZone).date;
  const tomorrow = addDays(today, 1);
  const due = [];

  for (const booking of bookings || []) {
    if (!booking || (booking.status && booking.status !== "confirmado")) continue;

    const start = Number(booking.start);
    if (!Number.isFinite(start)) continue;

    const appointmentMs = zonedToUtc(booking.date, start, timeZone);
    if (!Number.isFinite(appointmentMs)) continue;

    const remainingMs = appointmentMs - nowMs;
    if (remainingMs <= 0) continue; // já começou

    const isTomorrow = booking.date === tomorrow;

    if (
      isTomorrow &&
      remainingMs <= DAY_WINDOW.maxMs &&
      remainingMs > DAY_WINDOW.minMs
    ) {
      due.push({ booking, kind: "day", remainingMs });
      continue;
    }

    if (remainingMs <= HOUR_WINDOW.maxMs) {
      due.push({ booking, kind: "hour", remainingMs });
    }
  }

  return due;
}

function relativeHourText(remainingMs) {
  const minutes = Math.max(1, Math.round(remainingMs / 60000));
  if (minutes <= 5) return "em instantes";
  if (minutes <= 55) return `em ${minutes} min`;
  return "em 1 hora";
}

export function buildMessage({ booking, kind, remainingMs }, timeZone) {
  const service = booking.nome || "Atendimento";
  const start = Number(booking.start);
  const end = start + (Number(booking.dur) || 0);
  const when = `${formatMinutes(start)} às ${formatMinutes(end)}`;
  const date = formatLongDate(booking.date);
  const client = booking.name || "Cliente";
  const phone = formatPhone(booking.phone);
  const price = Number(booking.preco);

  const headline =
    kind === "day"
      ? "Lembrete: você tem atendimento *amanhã*."
      : `Seu atendimento começa *${relativeHourText(remainingMs)}*.`;

  const lines = [
    "🌸 *Merly Beauty Studio*",
    "",
    `Oi, Maria! ${headline}`,
    "",
    `📅 ${date}`,
    `🕘 ${when}`,
    `💅 ${service}`,
    `👤 Cliente: ${client}`,
    `📱 ${phone}`
  ];

  if (Number.isFinite(price) && price > 0) {
    lines.push(`💰 R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
  }

  if (Number(booking.dur) > 0) {
    lines.push(`⏳ Duração: ${formatDuration(booking.dur)}`);
  }

  return lines.join("\n");
}

export function buildTestMessage() {
  return [
    "🌸 *Merly Beauty Studio*",
    "",
    "Teste do bot de lembretes ✅",
    "",
    "Se você recebeu esta mensagem, os avisos de agendamento",
    "vão chegar neste WhatsApp 24h e 1h antes de cada atendimento."
  ].join("\n");
}
