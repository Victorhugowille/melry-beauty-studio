/**
 * AGENDA DE CLIENTES DO PAINEL
 * Lista de agendamentos futuros, contato por WhatsApp e cancelamento
 * (com e-mail para a cliente e justificativa, via fila email_outbox).
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
          <div class="m">${esc(b.name)} · ${esc(b.phone)}${b.email ? "" : ' · <em>sem e-mail</em>'}</div>
        </div>
        <div class="acts">
          <a class="mini" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>
          <button class="mini del" data-del="${b.id}">Cancelar</button>
        </div>
      </div>`;
  }
  list.innerHTML = html + "</div>";
}

// -------------------------------------------------------------
// MODAL DE CANCELAMENTO (com justificativa)
// -------------------------------------------------------------
let pendingCancelId = null;

function findBooking(id) {
  return (bookings || []).find(x => String(x.id) === String(id)) || null;
}

function openCancelModal(id) {
  const b = findBooking(id);
  pendingCancelId = b ? b.id : null;
  const modal = $("cancel-modal");
  if (!modal) return;
  $("cancel-modal-summary").textContent = b
    ? `${b.nome || b.svc} · ${fmtLong(b.date)} às ${hm(b.start)} · ${b.name}${b.email ? "" : " (sem e-mail cadastrado)"}`
    : "Agendamento não encontrado. Atualize a lista e tente de novo.";
  $("cancel-reason").value = "";
  $("cancel-err").textContent = "";
  const confirmBtn = $("cancel-confirm");
  if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "Cancelar e avisar a cliente"; }
  modal.hidden = false;
  $("cancel-reason").focus();
}

function closeCancelModal() {
  const modal = $("cancel-modal");
  if (modal) modal.hidden = true;
  pendingCancelId = null;
}

$("list").addEventListener("click", e => {
  const b = e.target.closest("[data-del]");
  if (!b) return;
  openCancelModal(b.dataset.del);
});

if ($("cancel-keep")) $("cancel-keep").addEventListener("click", closeCancelModal);
if ($("cancel-backdrop")) $("cancel-backdrop").addEventListener("click", closeCancelModal);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("cancel-modal") && !$("cancel-modal").hidden) closeCancelModal();
});

if ($("cancel-confirm")) $("cancel-confirm").addEventListener("click", async () => {
  const err = $("cancel-err");
  err.textContent = "";
  const booking = findBooking(pendingCancelId);
  if (!booking) {
    err.textContent = "Agendamento não encontrado. Atualize a lista e tente de novo.";
    return;
  }

  const btn = $("cancel-confirm");
  btn.disabled = true;
  btn.textContent = "Cancelando…";

  // 1) Cancela no banco
  try {
    await window.db.cancelBooking(booking.id);
  } catch (e) {
    err.textContent = "Erro ao cancelar: " + (e.message || "tente novamente");
    btn.disabled = false;
    btn.textContent = "Cancelar e avisar a cliente";
    return;
  }

  // 2) Enfileira o e-mail para a cliente (a Edge Function envia em até 1 minuto)
  const reason = $("cancel-reason").value.trim();
  let note;
  if (booking.email) {
    const queued = await window.db.queueRescheduleEmails([{
      to_email: booking.email,
      params: {
        title: "Seu agendamento foi cancelado",
        line1: `Oi, ${booking.name || "cliente"}! Precisamos cancelar seu agendamento:`,
        line2: `💅 ${booking.nome || booking.svc || "Atendimento"}`,
        line3: `📅 ${fmtLong(booking.date)} · 🕐 ${hm(booking.start)} às ${hm(booking.start + (Number(booking.dur) || 0))}`,
        line4: reason ? `💬 Motivo: ${reason}` : "",
        to_name: booking.name || "cliente"
      }
    }]);
    note = queued
      ? "A cliente será avisada por e-mail em até 1 minuto."
      : "Não consegui enfileirar o e-mail — confira a aba Testes.";
  } else {
    note = "A cliente não deixou e-mail cadastrado — avise pelo WhatsApp.";
  }

  closeCancelModal();
  bookings = await window.db.getBookings();
  renderAgenda();
  alert("Agendamento cancelado.\n" + note);
});
