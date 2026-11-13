/**
 * AGENDAMENTO DE CLIENTES E CALENDÁRIO
 * Calendário mensal, horários disponíveis, confirmação e resumo do agendamento.
 */

// -------------------------------------------------------------
// FLUXO DE AGENDAMENTO (CLIENTE)
// -------------------------------------------------------------
function validStarts(date, dur) {
  const now = new Date(), isToday = iso(now) === date, nowMin = now.getHours() * 60 + now.getMinutes();
  const bk = bookings.filter(b => b.date === date && b.status !== "cancelado");
  const res = [];
  for (let s = 0; s + dur <= 1440; s += 30) {
    if (isToday && s <= nowMin) continue;
    let ok = true;
    for (let k = s; k < s + dur; k += 30) {
      if (effectiveStatus(date, k) !== 1 || bk.some(b => k < b.start + b.dur && b.start < k + 30)) {
        ok = false;
        break;
      }
    }
    if (ok) res.push(s);
  }
  return res;
}

let calCursor = { y: null, m: null };
const BOOKING_DAYS_AHEAD = 60;

function resetCalendarCursor() {
  calCursor = { y: null, m: null };
}

function availableDaysFor(dur) {
  const set = new Set(), t = new Date();
  for (let i = 0; i < BOOKING_DAYS_AHEAD; i++) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
    if (validStarts(iso(d), dur).length) set.add(iso(d));
  }
  return set;
}

function renderCalendar(available) {
  const grid = $("cal-grid"), title = $("cal-title");
  if (!grid || !title) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (calCursor.y === null || calCursor.m === null) {
    const firstAvailable = [...available].sort()[0];
    const target = firstAvailable ? fromIso(firstAvailable) : today;
    calCursor = { y: target.getFullYear(), m: target.getMonth() };
  }

  const lastDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + BOOKING_DAYS_AHEAD - 1);
  const first = new Date(calCursor.y, calCursor.m, 1);
  const monthLabel = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  title.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const cells = [];
  for (let i = 0; i < first.getDay(); i++) {
    cells.push('<span class="cal-empty" aria-hidden="true"></span>');
  }

  const daysInMonth = new Date(calCursor.y, calCursor.m + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(calCursor.y, calCursor.m, day);
    const v = iso(d);
    const hasSlots = available.has(v);
    const selected = sel.date === v;
    const isToday = v === iso(today);
    const label = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

    cells.push(`<button type="button" class="cal-day${hasSlots ? " has-slots" : ""}${selected ? " selected" : ""}${isToday ? " is-today" : ""}"
      data-cal="${v}" ${hasSlots ? "" : "disabled"} aria-pressed="${selected}"
      aria-label="${esc(label)}${hasSlots ? "" : " — sem horários disponíveis"}">
      <span>${day}</span>${hasSlots ? '<i class="cal-dot" aria-hidden="true"></i>' : ""}
    </button>`);
  }
  grid.innerHTML = cells.join("");

  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const maxMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
  if ($("cal-prev")) $("cal-prev").disabled = first <= minMonth;
  if ($("cal-next")) $("cal-next").disabled = first >= maxMonth;
}

function moveCalendar(delta) {
  const d = new Date(calCursor.y, calCursor.m + delta, 1);
  calCursor = { y: d.getFullYear(), m: d.getMonth() };
  renderBooking();
}

function renderBooking() {
  const s = svcById(sel.svc);
  if (!s) {
    view("public");
    return;
  }
  $("chosen").innerHTML = `<b class="chosen-name">${esc(s.nome)}</b><span class="chosen-price">${brl(s.preco)}</span><span class="chosen-sep" aria-hidden="true">·</span><span class="chosen-dur">${durTxt(s.dur)}</span>`;

  const available = availableDaysFor(s.dur);

  $("bnone").hidden = available.size > 0;
  $("bflow").hidden = !available.size;
  if (!available.size) return;

  if (sel.date && !available.has(sel.date)) {
    sel.date = null;
    sel.time = null;
  }

  renderCalendar(available);

  const box = $("times");
  if (!sel.date) {
    box.innerHTML = '<p class="empty">Escolha um dia no calendário para ver os horários disponíveis.</p>';
  } else {
    const list = validStarts(sel.date, s.dur);
    if (sel.time !== null && !list.includes(sel.time)) sel.time = null;
    box.innerHTML = list.length
      ? list.map(m => `<button class="chip" data-t="${m}" aria-pressed="${sel.time === m}">${hm(m)}</button>`).join("")
      : '<p class="empty">Nenhum horário livre para este dia.</p>';
  }

  $("confirm").disabled = !(sel.date && sel.time !== null);
}

if ($("cal-grid")) {
  $("cal-grid").addEventListener("click", e => {
    const b = e.target.closest("[data-cal]");
    if (!b || b.disabled) return;
    sel.date = b.dataset.cal;
    sel.time = null;
    renderBooking();
  });
}
if ($("cal-prev")) $("cal-prev").onclick = () => moveCalendar(-1);
if ($("cal-next")) $("cal-next").onclick = () => moveCalendar(1);

$("times").addEventListener("click", e => {
  const b = e.target.closest("[data-t]");
  if (!b) return;
  sel.time = Number(b.dataset.t);
  renderBooking();
});

$("confirm").addEventListener("click", async () => {
  const name = $("name").value.trim();
  const phone = $("phone").value.trim();
  const digits = phone.replace(/\D/g, "");
  const err = $("err");
  err.textContent = "";

  const s = svcById(sel.svc);
  if (!s) return;

  if (name.length < 2) {
    err.textContent = "Por favor, digite seu nome.";
    $("name").focus();
    return;
  }
  if (digits.length < 10) {
    err.textContent = "Digite um número de WhatsApp válido com DDD (ex: 45 99999-9999).";
    $("phone").focus();
    return;
  }
  if (!validStarts(sel.date, s.dur).includes(sel.time)) {
    err.textContent = "Esse horário acabou de ser ocupado. Por favor, escolha outro.";
    sel.time = null;
    renderBooking();
    return;
  }

  const btnConfirm = $("confirm");
  btnConfirm.disabled = true;
  btnConfirm.textContent = "Confirmando...";

  const newBooking = {
    id: "b_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
    svc: s.id,
    nome: s.nome,
    preco: s.preco,
    date: sel.date,
    start: sel.time,
    dur: s.dur,
    name,
    phone
  };

  try {
    await window.db.createBooking(newBooking);
    bookings.push(newBooking);

    // Mensagem de confirmação na tela
    $("summary").innerHTML = `
      <p style="margin:0"><b>${esc(s.nome)}</b> · ${brl(s.preco)}</p>
      <p style="margin:4px 0 0">${esc(fmtLong(newBooking.date))}, às ${hm(newBooking.start)}</p>
      <p style="color:var(--muted);margin:8px 0 0">${esc(name)} · ${esc(phone)}</p>
    `;
    $("bflowwrap").hidden = true;
    $("done").hidden = false;
    if (window.MelryPush) window.MelryPush.offer(newBooking.id);
    window.scrollTo(0, 0);
  } catch (e) {
    err.textContent = "Não foi possível confirmar o agendamento no momento. Tente novamente.";
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.textContent = "Confirmar agendamento";
  }
});

function goHome() {
  sel.svc = sel.date = sel.time = null;
  resetCalendarCursor();
  $("name").value = "";
  $("phone").value = "";
  if (location.hash === "#agendar") history.back();
  else view("public");
}
$("home").onclick = goHome;
$("bback").onclick = goHome;

window.addEventListener("hashchange", () => {
  if (location.hash !== "#agendar" && !$("v-booking").hidden) view("public");
});
if (location.hash === "#agendar") {
  history.replaceState(null, "", location.pathname + location.search);
}
