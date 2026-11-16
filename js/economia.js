/**
 * ABA FATURAMENTO / ECONOMIA DO PAINEL
 * Faturamento do período, ticket médio, gráfico de pizza por serviço,
 * ranking de serviços e de clientes que mais gastaram.
 * Período: botões rápidos ou calendário (1º clique = início, 2º clique = fim).
 */

const ECON_COLORS = [
  "#9b5666", "#d89aa6", "#c58f9c", "#a86f5c",
  "#7f5a6b", "#e8bec7", "#b98a95", "#8b6871"
];

let econPeriod = "30";
let econFrom = "";
let econTo = "";
let econCursor = { y: null, m: null };

// Preço do atendimento: usa o valor salvo; se faltar, o preço atual do serviço.
function econPrice(b) {
  const p = Number(b.preco);
  if (Number.isFinite(p) && p > 0) return p;
  const svc = typeof svcById === "function" ? svcById(b.svc) : null;
  const sp = Number(svc && svc.preco);
  return Number.isFinite(sp) && sp > 0 ? sp : 0;
}

// Intervalo de datas do período escolhido (from pode ser null = sem início)
function econRange(period, today) {
  if (period === "custom") {
    const to = econTo && econTo < today ? econTo : today;
    return { from: econFrom || null, to };
  }
  if (period === "all") return { from: null, to: today };
  if (period === "today") return { from: today, to: today };
  if (period === "yesterday") {
    const d = fromIso(today);
    const y = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
    return { from: y, to: y };
  }
  if (period === "month") {
    const d = fromIso(today);
    return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: today };
  }
  if (period === "year") {
    const d = fromIso(today);
    return { from: iso(new Date(d.getFullYear(), 0, 1)), to: today };
  }
  const days = Number(period) || 30;
  const d = fromIso(today);
  return {
    from: iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (days - 1))),
    to: today
  };
}

const econBrDate = s => {
  if (!s) return "";
  const [y, m, d] = String(s).split("-");
  return `${d}/${m}/${y}`;
};

function econSyncRangeLabel(range) {
  const label = $("econ-range");
  if (!label) return;
  if (!range.from) {
    label.textContent = `Tudo até ${econBrDate(range.to)}`;
    return;
  }
  if (range.from === range.to) {
    label.textContent = econBrDate(range.from);
    return;
  }
  label.textContent = `De ${econBrDate(range.from)} até ${econBrDate(range.to)}`;
}

function econSyncInputs(range) {
  econFrom = range.from || "";
  econTo = range.to || "";
}

// ---------------------------------------------------------------
// CALENDÁRIO DE SELEÇÃO DE PERÍODO (igual ao do agendamento)
// 1º clique = início · 2º clique = fim
// ---------------------------------------------------------------
function econRenderCalendar() {
  const grid = $("econ-cal-grid"), title = $("econ-cal-title");
  if (!grid || !title) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (econCursor.y === null || econCursor.m === null) {
    econCursor = { y: today.getFullYear(), m: today.getMonth() };
  }

  const first = new Date(econCursor.y, econCursor.m, 1);
  const monthLabel = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  title.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const cells = [];
  for (let i = 0; i < first.getDay(); i++) {
    cells.push('<span class="cal-empty" aria-hidden="true"></span>');
  }

  const from = econFrom, to = econTo;
  const daysInMonth = new Date(econCursor.y, econCursor.m + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(econCursor.y, econCursor.m, day);
    const v = iso(d);
    const isFuture = d > today;
    const isToday = v === iso(today);
    const isStart = !!from && v === from;
    const isEnd = !!to && v === to;
    const inRange = !!from && !!to && v >= from && v <= to;
    const label = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

    const cls = ["cal-day"];
    if (isToday) cls.push("is-today");
    if (inRange) cls.push("in-range");
    if (isStart) cls.push("range-start");
    if (isEnd) cls.push("range-end");

    cells.push(`<button type="button" class="${cls.join(" ")}"
      data-cal="${v}" ${isFuture ? "disabled" : ""} aria-pressed="${isStart || isEnd}"
      aria-label="${esc(label)}${isFuture ? " — dia futuro" : ""}${isStart ? " — início do período" : ""}${isEnd ? " — fim do período" : ""}">
      <span>${day}</span>
    </button>`);
  }
  grid.innerHTML = cells.join("");

  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  if ($("econ-cal-prev")) $("econ-cal-prev").disabled = first <= minMonth;
  if ($("econ-cal-next")) $("econ-cal-next").disabled = first >= minMonth;
}

function econPickDay(v) {
  const today = iso(new Date());
  if (v > today) return; // dias futuros não entram

  if (!econFrom || (econFrom && econTo)) {
    // 1º clique (ou recomeço): define o início
    econFrom = v;
    econTo = "";
  } else if (v >= econFrom) {
    // 2º clique: define o fim (clicou no mesmo dia = dia único)
    econTo = v;
  } else {
    // clicou antes do início: o clique vira o início
    econFrom = v;
  }

  econPeriod = "custom";
  if (econFrom && econTo) {
    // intervalo completo: destaca os dois no calendário e atualiza os relatórios
    if ($("econ-filter")) {
      $("econ-filter").querySelectorAll("[data-period]").forEach(b => b.setAttribute("aria-pressed", "false"));
    }
    renderEconomia();
  } else {
    // ainda falta o 2º clique: só redesenha o calendário
    const label = $("econ-range");
    if (label) label.textContent = `Início em ${econBrDate(econFrom)} — toque no dia final`;
    econRenderCalendar();
  }
}

function econMarkQuickRange(from, to) {
  econFrom = from;
  econTo = to;
  // navega o calendário para o mês de início
  if (from) {
    const d = fromIso(from);
    econCursor = { y: d.getFullYear(), m: d.getMonth() };
  }
}

// ---------------------------------------------------------------
// GRÁFICO DE PIZZA
// ---------------------------------------------------------------
function econDrawPie(slices) {
  const canvas = $("econ-pie");
  if (!canvas) return;

  const size = 300;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const total = slices.reduce((n, s) => n + s.count, 0);

  const rootStyle = getComputedStyle(document.documentElement);
  const surface = rootStyle.getPropertyValue("--surface").trim() || "#fff";
  const cx = size / 2, cy = size / 2, r = size / 2 - 6;

  if (!total) {
    ctx.beginPath();
    ctx.arc(cx, cy, r - 14, 0, Math.PI * 2);
    ctx.lineWidth = 28;
    ctx.strokeStyle = rootStyle.getPropertyValue("--soft").trim() || "#f7e8ea";
    ctx.stroke();
    return;
  }

  const gap = slices.length > 1 ? 0.02 : 0;

  let angle = -Math.PI / 2;
  slices.forEach(s => {
    const arc = (s.count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle + gap / 2, angle + arc - gap / 2);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = surface;
    ctx.stroke();
    angle += arc;
  });
}

// ---------------------------------------------------------------
// RENDERIZAÇÃO PRINCIPAL
// ---------------------------------------------------------------
async function renderEconomia() {
  const cards = $("econ-cards");
  const legend = $("econ-legend");
  const svcBox = $("econ-services");
  const cliBox = $("econ-clients");
  if (!cards) return;

  cards.innerHTML = '<p class="empty">Calculando...</p>';

  let rows = [];
  try {
    rows = await window.db.getBookings();
  } catch (err) {
    console.error("Erro ao carregar faturamento:", err);
    rows = bookings || [];
  }

  const today = iso(new Date());
  const range = econRange(econPeriod, today);
  econSyncInputs(range);
  econSyncRangeLabel(range);
  econRenderCalendar();

  const list = rows.filter(b =>
    b.status !== "cancelado" &&
    b.date <= range.to &&
    (!range.from || b.date >= range.from)
  );

  const byService = new Map();
  const byClient = new Map();
  let total = 0;

  for (const b of list) {
    const price = econPrice(b);
    total += price;

    const svcName = (b.nome || (svcById(b.svc) || {}).nome || "Outros").trim();
    const svc = byService.get(svcName) || { name: svcName, count: 0, total: 0 };
    svc.count += 1;
    svc.total += price;
    byService.set(svcName, svc);

    const clientName = (b.name || "Sem nome").trim();
    const cli = byClient.get(clientName) || { name: clientName, count: 0, total: 0 };
    cli.count += 1;
    cli.total += price;
    byClient.set(clientName, cli);
  }

  const visits = list.length;
  const ticket = visits ? total / visits : 0;

  const cardHtml = (label, value, hint) => `
    <div class="econ-card">
      <span class="econ-k">${label}</span>
      <strong class="econ-v">${value}</strong>
      ${hint ? `<small>${hint}</small>` : ""}
    </div>`;

  cards.innerHTML = [
    cardHtml("Faturamento", brl(total), "atendimentos já realizados"),
    cardHtml("Atendimentos", String(visits), visits === 1 ? "1 cliente atendida" : `${byClient.size} clientes`),
    cardHtml("Ticket médio", brl(ticket), "por atendimento"),
    cardHtml("Clientes", String(byClient.size), byClient.size === 1 ? "1 nome na lista" : "nomes diferentes")
  ].join("");

  const slices = [...byService.values()]
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .map((s, i) => ({ ...s, color: ECON_COLORS[i % ECON_COLORS.length] }));

  econDrawPie(slices);

  if (legend) {
    legend.innerHTML = slices.length
      ? slices.map(s => {
          const pct = visits ? Math.round((s.count / visits) * 100) : 0;
          return `<li>
            <span class="dot" style="background:${s.color}"></span>
            <span class="econ-legend-name">${esc(s.name)}</span>
            <span class="econ-legend-val">${s.count}× · ${brl(s.total)} <em>${pct}%</em></span>
          </li>`;
        }).join("")
      : '<li class="empty">Sem atendimentos neste período.</li>';
  }

  if (svcBox) {
    svcBox.innerHTML = slices.length
      ? slices.map((s, i) => `
          <div class="econ-rank">
            <div class="econ-rank-top">
              <span class="econ-rank-name"><em>${i + 1}</em> ${esc(s.name)}</span>
              <span class="econ-rank-val">${s.count}× · ${brl(s.total)}</span>
            </div>
            <div class="econ-bar"><span style="width:${Math.max(6, Math.round((s.count / slices[0].count) * 100))}%;background:${s.color}"></span></div>
          </div>`).join("")
      : '<p class="empty">Nenhum atendimento neste período.</p>';
  }

  const clients = [...byClient.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  if (cliBox) {
    cliBox.innerHTML = clients.length
      ? clients.map((c, i) => `
          <div class="econ-rank">
            <div class="econ-rank-top">
              <span class="econ-rank-name"><em>${i + 1}</em> ${esc(c.name)}</span>
              <span class="econ-rank-val">${brl(c.total)} · ${c.count}×</span>
            </div>
            <div class="econ-bar"><span style="width:${Math.max(6, Math.round((c.total / (clients[0].total || 1)) * 100))}%"></span></div>
          </div>`).join("")
      : '<p class="empty">Nenhuma cliente neste período.</p>';
  }
}

// ---------------------------------------------------------------
// BOTÕES RÁPIDOS (hoje, ontem, 1 semana, 1 mês, 3 meses, 6 meses, 1 ano)
// ---------------------------------------------------------------
if ($("econ-filter")) {
  $("econ-filter").addEventListener("click", e => {
    const btn = e.target.closest("[data-period]");
    if (!btn) return;
    econPeriod = btn.dataset.period;

    const today = iso(new Date());
    const range = econRange(econPeriod, today);
    econMarkQuickRange(range.from, range.to);

    $("econ-filter").querySelectorAll("[data-period]").forEach(b => {
      b.setAttribute("aria-pressed", String(b === btn));
    });
    renderEconomia();
  });
}

// ---------------------------------------------------------------
// CLIQUE NO CALENDÁRIO: 1º = início, 2º = fim
// ---------------------------------------------------------------
if ($("econ-cal-grid")) {
  $("econ-cal-grid").addEventListener("click", e => {
    const b = e.target.closest("[data-cal]");
    if (!b || b.disabled) return;
    econPickDay(b.dataset.cal);
  });
}

if ($("econ-cal-prev")) $("econ-cal-prev").addEventListener("click", () => {
  if (econCursor.y === null) econCursor = { y: new Date().getFullYear(), m: new Date().getMonth() };
  const d = new Date(econCursor.y, econCursor.m - 1, 1);
  econCursor = { y: d.getFullYear(), m: d.getMonth() };
  econRenderCalendar();
});

if ($("econ-cal-next")) $("econ-cal-next").addEventListener("click", () => {
  if (econCursor.y === null) econCursor = { y: new Date().getFullYear(), m: new Date().getMonth() };
  const d = new Date(econCursor.y, econCursor.m + 1, 1);
  econCursor = { y: d.getFullYear(), m: d.getMonth() };
  econRenderCalendar();
});
