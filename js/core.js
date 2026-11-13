/**
 * NÚCLEO DA APLICAÇÃO
 * Utilidades, estado global, navegação entre telas e grade padrão de horários.
 */

/**
 * APLICATIVO DE AGENDAMENTO - MERLY BEAUTY STUDIO
 * Manicure, Designer de Sobrancelha e Cílios
 */

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Senha de acesso ao Painel da Profissional
const PASS = "0000";

// Estado da Aplicação
let services = [];
let bookings = [];
let avail = {};
const sel = { svc: null, date: null, time: null };

// Utilitários de Data e Moeda
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const hm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const fromIso = s => {
  const [a, b, c] = s.split("-").map(Number);
  return new Date(a, b - 1, c);
};
const fmtLong = s => fromIso(s).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const brl = n => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: Number(n) % 1 ? 2 : 0 });
const durTxt = m => m < 60 ? m + " min" : (Math.floor(m / 60) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : ""));
const svcById = id => services.find(s => s.id === id);
const monogram = name => String(name || "")
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map(w => w[0])
  .slice(0, 2)
  .join("")
  .toUpperCase();
const pic = s => s.foto
  ? `<img src="${s.foto}" alt="${esc(s.nome)}" loading="lazy">`
  : `<div class="ph"><span>${esc(monogram(s.nome) || "M")}</span></div>`;

const categoryLabels = {
  todos: "Todos",
  cilios: "Cílios",
  sobrancelhas: "Sobrancelhas",
  manicure: "Manicure & Pedicure",
  geral: "Outros"
};

// -------------------------------------------------------------
// GRADE PADRÃO DE ATENDIMENTO
// Usada sempre que o dia não tiver horários personalizados.
// Intervalos em minutos: 420 = 7h · 690 = 11h30 · 780 = 13h
// 1140 = 19h · 1200 = 20h
// -------------------------------------------------------------
const DEFAULT_HOURS = {
  0: [],                                  // Domingo · fechado
  1: [[420, 690], [1140, 1200]],          // Segunda · 7h–11h30 e 19h–20h
  2: [[420, 690], [1140, 1200]],          // Terça
  3: [[420, 690], [1140, 1200]],          // Quarta
  4: [[420, 690], [1140, 1200]],          // Quinta
  5: [[420, 690], [1140, 1200]],          // Sexta
  6: [[780, 1140]]                        // Sábado · 13h–19h
};

function defaultStatusFor(date, minute) {
  const ranges = DEFAULT_HOURS[fromIso(date).getDay()] || [];
  return ranges.some(([start, end]) => minute >= start && minute <= end) ? 1 : 0;
}

function defaultDayStatuses(date) {
  const map = {};
  for (let k = 0; k < 1440; k += 30) map[k] = defaultStatusFor(date, k);
  return map;
}

// Prioridade: horário personalizado salvo > grade padrão do dia da semana.
function effectiveStatus(date, minute) {
  const day = avail[date];
  if (day && Object.prototype.hasOwnProperty.call(day, minute)) {
    return Number(day[minute]) || 0;
  }
  return defaultStatusFor(date, minute);
}

// Navegação entre Telas
function view(v) {
  for (const n of ["public", "booking", "login", "admin"]) {
    const el = $("v-" + n);
    if (el) el.hidden = n !== v;
  }
  window.scrollTo(0, 0);
}
