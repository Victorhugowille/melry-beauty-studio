/**
 * ABA FATURAMENTO / ECONOMIA DO PAINEL
 * Faturamento do período, ticket médio, gráfico de pizza por serviço,
 * ranking de serviços e de clientes que mais gastaram.
 */

const ECON_COLORS = [
  "#9b5666", "#d89aa6", "#c58f9c", "#a86f5c",
  "#7f5a6b", "#e8bec7", "#b98a95", "#8b6871"
];

let econPeriod = "month";

// Preço do atendimento: usa o valor salvo; se faltar, o preço atual do serviço.
function econPrice(b) {
  const p = Number(b.preco);
  if (Number.isFinite(p) && p > 0) return p;
  const svc = typeof svcById === "function" ? svcById(b.svc) : null;
  const sp = Number(svc && svc.preco);
  return Number.isFinite(sp) && sp > 0 ? sp : 0;
}

// Primeiro dia do período (null = tudo)
function econStart(period, today) {
  if (period === "all") return null;
  const d = fromIso(today);
  if (period === "month") return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  if (period === "year") return iso(new Date(d.getFullYear(), 0, 1));
  const days = Number(period) || 30;
  return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (days - 1)));
}

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
  const start = econStart(econPeriod, today);
  const list = rows.filter(b =>
    b.status !== "cancelado" && b.date <= today && (!start || b.date >= start)
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

  // ---- gráfico de pizza (por quantidade de atendimentos) ----
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

  // ---- ranking de serviços ----
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

  // ---- clientes que mais gastaram ----
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

if ($("econ-filter")) {
  $("econ-filter").addEventListener("click", e => {
    const btn = e.target.closest("[data-period]");
    if (!btn) return;
    econPeriod = btn.dataset.period;
    $("econ-filter").querySelectorAll("[data-period]").forEach(b => {
      b.setAttribute("aria-pressed", String(b === btn));
    });
    renderEconomia();
  });
}
