/**
 * MINHAS AGENDAS
 * A cliente encontra o próprio agendamento pelo e-mail e troca de horário.
 * A troca gera e-mail para ela e para o estúdio (via email_outbox).
 */
(function () {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MAX_DAYS_AHEAD = 60;

  const corner = $("client-corner");
  const panel = $("client-panel");
  const backdrop = $("client-panel-backdrop");
  const closeBtn = $("client-panel-close");
  const emailInput = $("cp-email");
  const searchBtn = $("cp-search");
  const errBox = $("cp-err");
  const listBox = $("cp-list");

  let cpBookings = [];
  let editingId = null;
  let selDate = null;
  let selStart = null;

  // -------------------------------------------------------------
  // ABERTURA / FECHAMENTO
  // -------------------------------------------------------------
  function openPanel() {
    panel.hidden = false;
    backdrop.hidden = false;
    corner.setAttribute("aria-expanded", "true");
    emailInput.focus();
  }

  function closePanel() {
    panel.hidden = true;
    backdrop.hidden = true;
    corner.setAttribute("aria-expanded", "false");
    editingId = null;
    selDate = null;
    selStart = null;
    corner.focus();
  }

  if (corner) corner.addEventListener("click", openPanel);
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  if (backdrop) backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !panel.hidden) closePanel();
  });

  // -------------------------------------------------------------
  // BUSCA POR E-MAIL
  // -------------------------------------------------------------
  async function search() {
    const email = emailInput.value.trim().toLowerCase();
    errBox.textContent = "";
    if (!EMAIL_RE.test(email)) {
      errBox.textContent = "Digite o e-mail que você usou no agendamento.";
      emailInput.focus();
      return;
    }
    searchBtn.disabled = true;
    searchBtn.textContent = "Buscando...";
    try {
      cpBookings = await window.db.getMyBookings(email);
      renderList(email);
    } catch (e) {
      errBox.textContent = "Não conseguimos buscar agora. Tente de novo em instantes.";
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = "Buscar meus agendamentos";
    }
  }

  if (searchBtn) searchBtn.addEventListener("click", search);
  if (emailInput) {
    emailInput.addEventListener("input", () => { errBox.textContent = ""; });
    emailInput.addEventListener("keydown", e => { if (e.key === "Enter") search(); });
  }

  // -------------------------------------------------------------
  // LISTA
  // -------------------------------------------------------------
  function renderList() {
    editingId = null;
    selDate = null;
    selStart = null;

    if (!cpBookings.length) {
      listBox.innerHTML = '<p class="empty">Nenhum agendamento confirmado para esse e-mail.</p>';
      return;
    }

    listBox.innerHTML = cpBookings.map(b => {
      const when = `${fmtLong(b.date)}, ${hm(b.start)} às ${hm(b.start + b.dur)}`;
      return `
      <article class="cp-item" data-id="${esc(b.id)}">
        <div class="cp-item-top">
          <div>
            <span class="cp-item-name">${esc(b.nome)}</span>
            <span class="cp-item-when">${esc(when)}</span>
            <span class="cp-item-price">${brl(b.preco)}</span>
          </div>
          <div class="cp-item-actions">
            <button class="mini" type="button" data-review="${esc(b.id)}">Avaliar</button>
            <button class="mini" type="button" data-resched="${esc(b.id)}">Trocar horário</button>
          </div>
        </div>
        <div class="cp-edit" data-edit="${esc(b.id)}" hidden>
          <label for="cp-date-${esc(b.id)}">Nova data</label>
          <input type="date" id="cp-date-${esc(b.id)}" data-date="${esc(b.id)}"
                 min="${iso(new Date())}" max="${iso(new Date(Date.now() + (MAX_DAYS_AHEAD - 1) * 864e5))}"
                 value="${esc(b.date)}">
          <div class="chips" data-times="${esc(b.id)}"></div>
          <div class="cp-actions">
            <button class="cta" type="button" data-save="${esc(b.id)}" disabled>Salvar novo horário</button>
            <button class="link" type="button" data-cancel>Cancelar</button>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  // -------------------------------------------------------------
  // TROCA DE HORÁRIO
  // -------------------------------------------------------------
  function openEditor(id) {
    const b = cpBookings.find(x => x.id === id);
    if (!b) return;
    editingId = id;
    selDate = b.date;
    selStart = null;

    listBox.querySelectorAll(".cp-edit").forEach(box => { box.hidden = box.dataset.edit !== id; });
    renderTimes(id);
  }

  function renderTimes(id) {
    const b = cpBookings.find(x => x.id === id);
    const box = listBox.querySelector(`[data-times="${id}"]`);
    if (!b || !box) return;
    const list = selDate ? validStarts(selDate, b.dur, id) : [];
    box.innerHTML = list.length
      ? list.map(m => `<button type="button" class="chip" data-st="${m}" aria-pressed="${selStart === m}">${hm(m)}</button>`).join("")
      : '<p class="empty">Nenhum horário livre para este dia.</p>';
    const saveBtn = listBox.querySelector(`[data-save="${id}"]`);
    if (saveBtn) saveBtn.disabled = selStart === null;
  }

  async function save(id) {
    const b = cpBookings.find(x => x.id === id);
    const email = emailInput.value.trim().toLowerCase();
    if (!b || selDate === null || selStart === null) return;
    errBox.textContent = "";

    // Checa de novo na hora: o horário pode ter sido ocupado neste meio-tempo.
    if (!validStarts(selDate, b.dur, id).includes(selStart)) {
      errBox.textContent = "Esse horário acabou de ser ocupado. Escolha outro.";
      selStart = null;
      renderTimes(id);
      return;
    }

    const saveBtn = listBox.querySelector(`[data-save="${id}"]`);
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Salvando..."; }

    let res;
    try {
      res = await window.db.rescheduleBooking(id, email, selDate, selStart);
    } catch (err) {
      console.error("Erro ao trocar o horário:", err);
      res = { ok: false, reason: "error" };
    }

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Salvar novo horário"; }

    if (!res || !res.ok) {
      errBox.textContent = res && res.reason === "not-found"
        ? "Não encontramos esse agendamento. Busque de novo, por favor."
        : "Não conseguimos salvar agora. Tente de novo em instantes.";
      return;
    }

    // Atualiza a cópia local da agenda (painel da profissional e PDF usam a mesma).
    const local = bookings.find(x => x.id === id);
    if (local) { local.date = selDate; local.start = selStart; }
    if (res.booking) {
      const i = cpBookings.findIndex(x => x.id === id);
      if (i >= 0) cpBookings[i] = { ...cpBookings[i], ...res.booking };
    }

    // E-mails: avisa a cliente e o estúdio (a fila é enviada pelo cron a cada 5 min).
    const when = `${fmtLong(selDate)}, ${hm(selStart)} às ${hm(selStart + b.dur)}`;
    const priceLine = Number(b.preco) > 0 ? `💰 ${brl(b.preco)}` : "";
    const base = {
      line2: `💅 ${b.nome}`,
      line3: `📅 ${when}`,
      line4: priceLine
    };
    const rows = [
      {
        to_email: email,
        params: {
          title: "Seu horário foi alterado! 💛",
          line1: `Oi, ${b.name}! Seu agendamento mudou de horário:`,
          ...base,
          to_name: b.name
        }
      },
      {
        to_email: window.STUDIO_EMAIL || "mlemepadilha@gmail.com",
        params: {
          title: "Cliente trocou de horário 💛",
          line1: `${b.name} pediu para trocar o horário de um agendamento:`,
          ...base,
          to_name: "Estúdio Melry"
        }
      }
    ];
    await window.db.queueRescheduleEmails(rows);

    cpBookings = cpBookings.map(x => x.id === id ? { ...x, date: selDate, start: selStart } : x);
    renderList();
    const msg = listBox.querySelector(".cp-msg-ok");
    if (!msg) {
      const p = document.createElement("p");
      p.className = "cp-msg cp-msg-ok";
      p.setAttribute("role", "status");
      p.textContent = "Horário alterado! Você e o estúdio recebem um e-mail avisando.";
      listBox.prepend(p);
    }
    editingId = null;
    selDate = null;
    selStart = null;
  }

  // -------------------------------------------------------------
  // CLIQUES DENTRO DA LISTA
  // -------------------------------------------------------------
  if (listBox) {
    listBox.addEventListener("change", e => {
      const dateInput = e.target.closest("[data-date]");
      if (dateInput) {
        selDate = dateInput.value;
        selStart = null;
        renderTimes(dateInput.dataset.date);
      }
    });

    listBox.addEventListener("click", e => {
      const resched = e.target.closest("[data-resched]");
      if (resched) { openEditor(resched.dataset.resched); return; }

      const review = e.target.closest("[data-review]");
      if (review) {
        const b = cpBookings.find(x => x.id === review.dataset.review);
        if (b) window.dispatchEvent(new CustomEvent("melry:review", { detail: b }));
        return;
      }

      const chip = e.target.closest("[data-st]");
      if (chip && editingId) {
        selStart = Number(chip.dataset.st);
        renderTimes(editingId);
        return;
      }

      const saveBtn = e.target.closest("[data-save]");
      if (saveBtn) { save(saveBtn.dataset.save); return; }

      if (e.target.closest("[data-cancel]")) {
        editingId = null;
        selDate = null;
        selStart = null;
        listBox.querySelectorAll(".cp-edit").forEach(box => { box.hidden = true; });
      }
    });
  }
})();
