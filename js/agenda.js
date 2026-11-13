/**
 * AGENDA DE CLIENTES DO PAINEL
 * Lista de agendamentos futuros, contato por WhatsApp e cancelamento.
 */

// -------------------------------------------------------------
// AGENDA E GESTÃO DE CLIENTES
// -------------------------------------------------------------
async function renderAgenda() {
  const list = $("list");
  if (!list) return;

  bookings = await window.db.getBookings();
  const today = iso(new Date());
  const up = bookings
    .filter(b => b.date >= today && b.status !== "cancelado")
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);

  if (!up.length) {
    list.innerHTML = '<p class="empty">Nenhum agendamento futuro no momento.</p>';
    return;
  }

  let html = "", last = "";
  for (const b of up) {
    if (b.date !== last) {
      html += `${last ? "</div>" : ""}<div class="dayhead">${esc(fmtLong(b.date))}</div><div class="card">`;
      last = b.date;
    }
    const cleanPhone = b.phone.replace(/\D/g, "");
    const wa = "https://wa.me/55" + cleanPhone;
    html += `
      <div class="row">
        <div>
          <div class="t">${hm(b.start)} – ${hm(b.start + b.dur)} · ${esc(b.nome || b.svc)}</div>
          <div class="m">${esc(b.name)} · ${esc(b.phone)}</div>
        </div>
        <div class="acts">
          <a class="mini" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>
          <button class="mini del" data-del="${b.id}">Cancelar</button>
        </div>
      </div>`;
  }
  list.innerHTML = html + "</div>";
}

$("list").addEventListener("click", async e => {
  const b = e.target.closest("[data-del]");
  if (!b) return;
  if (!confirm("Deseja realmente cancelar este agendamento?")) return;

  try {
    await window.db.cancelBooking(b.dataset.del);
    bookings = await window.db.getBookings();
    renderAgenda();
  } catch (err) {
    alert("Erro ao cancelar: " + (err.message || "Tente novamente"));
  }
});
