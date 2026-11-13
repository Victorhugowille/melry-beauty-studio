/**
 * UTILITÁRIOS DE DATA E HORA
 * O site guarda datas como "YYYY-MM-DD" e horários como minutos do dia
 * (ex.: 540 = 09:00). Aqui convertemos isso para instantes reais no fuso
 * do estúdio, sem depender da máquina que executa o robô.
 */

/** Partes de data/hora de um instante no fuso informado. */
export function tzParts(instant, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

/** Diferença (ms) entre o horário de parede do fuso e o UTC. */
function offsetMs(instant, timeZone) {
  const p = tzParts(instant, timeZone);
  const [y, m, d] = p.date.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Converte uma data local + minuto do dia no instante UTC correspondente.
 * Ex.: ("2026-11-14", 540, "America/Campo_Grande") -> 2026-11-14T13:00:00Z
 */
export function zonedToUtc(dateStr, minutesOfDay, timeZone) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d || !Number.isFinite(minutesOfDay)) return NaN;

  const wallClock = Date.UTC(y, m - 1, d, 0, 0, 0) + minutesOfDay * 60000;
  let guess = wallClock;

  // Duas passadas cobrem fusos com horário de verão.
  for (let i = 0; i < 2; i++) {
    const next = wallClock - offsetMs(new Date(guess), timeZone);
    if (next === guess) break;
    guess = next;
  }

  return guess;
}

/** Soma dias a uma data "YYYY-MM-DD" sem sofrer com fuso. */
export function addDays(dateStr, days) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** "09:00" a partir de 540. */
export function formatMinutes(minutes) {
  const total = Number(minutes) || 0;
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** 90 -> "1h30", 60 -> "1h", 45 -> "45 min". */
export function formatDuration(minutes) {
  const total = Number(minutes) || 0;
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** "sábado, 14 de novembro" (com inicial maiúscula). */
export function formatLongDate(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const text = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC"
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "45999887766" -> "(45) 99988-7766". */
export function formatPhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");

  // Remove o código do país (55) quando presente.
  if (digits.length === 12 || digits.length === 13) digits = digits.slice(2);

  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return String(raw || "");
}
