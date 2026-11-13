/**
 * GRADE DE HORÁRIOS DO PAINEL
 * Slots de 30 minutos, horário padrão, fechamento do dia e status salvos.
 */

// -------------------------------------------------------------
// GESTÃO DE HORÁRIOS (DISPONIBILIDADE)
// -------------------------------------------------------------
function renderSlots() {
  const d = $("hdate").value;
  if (!d) {
    $("slots").innerHTML = '<p class="empty">Escolha um dia.</p>';
    return;
  }
  const booked = {};
  bookings.filter(b => b.date === d && b.status !== "cancelado").forEach(b => {
    for (let k = b.start; k < b.start + b.dur; k += 30) booked[k] = b;
  });

  let h = "";
  for (let k = 0; k < 1440; k += 30) {
    if (booked[k]) {
      h += `<button class="slot booked" disabled><b>${hm(k)}</b><small>Agendado</small></button>`;
      continue;
    }
    const st = effectiveStatus(d, k);
    h += `<button class="slot ${st === 1 ? "free" : st === 2 ? "busy" : ""}" data-k="${k}" aria-label="${hm(k)} · ${["Fechado", "Livre", "Ocupado"][st]}">
      <b>${hm(k)}</b>
      <small>${["Fechado", "Livre", "Ocupado"][st]}</small>
    </button>`;
  }
  $("slots").innerHTML = h;
}

$("hdate").addEventListener("change", renderSlots);

$("slots").addEventListener("click", async e => {
  const b = e.target.closest("[data-k]");
  if (!b) return;
  const d = $("hdate").value, k = Number(b.dataset.k);
  const next = (effectiveStatus(d, k) + 1) % 3;
  avail = await window.db.setSlotStatus(d, k, next);
  renderSlots();
});

$("applydefault").onclick = async () => {
  const d = $("hdate").value;
  if (!d) return;
  avail = await window.db.saveDayStatuses(d, defaultDayStatuses(d));
  renderSlots();
};

$("clearday").onclick = async () => {
  const d = $("hdate").value;
  if (!d || !confirm("Fechar o dia inteiro para agendamentos?")) return;
  const closed = {};
  for (let k = 0; k < 1440; k += 30) closed[k] = 0;
  avail = await window.db.saveDayStatuses(d, closed);
  renderSlots();
};
