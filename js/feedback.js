/**
 * FEEDBACK DAS CLIENTES
 * - Carrossel público de avaliações (após os serviços).
 * - No "Minhas Agendas": a cliente avalia o atendimento vinculado ao e-mail.
 * - No painel admin: lista e remove avaliações.
 */
(function () {
  const section = $("feedbacks-section");
  const track = $("fb-track");
  const dotsBox = $("fb-dots");
  const fbSectionPrev = $("fb-prev");
  const fbSectionNext = $("fb-next");

  // -------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------
  function escHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function resizeImage(file, maxDim, quality) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(null);
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function asFotos(f) {
    if (Array.isArray(f)) return f;
    try { return JSON.parse(f || "[]"); } catch (e) { return []; }
  }

  function dateShort(created) {
    try {
      const d = new Date(created);
      if (isNaN(d)) return "";
      return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return ""; }
  }

  // -------------------------------------------------------------
  // CARROSSEL PÚBLICO
  // -------------------------------------------------------------
  let fbIndex = 0;
  let fbTimer = null;
  let feedbackList = [];

  function renderCarousel() {
    if (!section || !track) return;
    if (!feedbackList.length) {
      section.hidden = true;
      track.innerHTML = "";
      if (dotsBox) dotsBox.innerHTML = "";
      return;
    }

    section.hidden = false;
    fbIndex = Math.min(fbIndex, feedbackList.length - 1);

    track.innerHTML = feedbackList.map((f, i) => {
      const fotos = asFotos(f.fotos);
      const main = fotos[0] || "assets/logo-256.png";
      const avatar = f.foto_perfil || "assets/logo-256.png";
      const thumbs = fotos.map((src, j) =>
        `<button type="button" class="fb-thumb${j === 0 ? " active" : ""}" data-fb-full="${j}" aria-label="Ver foto ${j + 1}"><img src="${src}" alt=""></button>`
      ).join("");

      return `
      <figure class="carousel-slide fb-slide" aria-hidden="${i !== fbIndex}">
        <div class="fb-card">
          <div class="fb-photo-wrap">
            <img class="fb-photo" src="${main}" alt="Foto do feedback de ${escHtml(f.nome)}" loading="${i === 0 ? "eager" : "lazy"}">
            ${fotos.length > 1 ? `<div class="fb-thumbs">${thumbs}</div>` : ""}
          </div>
          <div class="fb-body">
            <div class="fb-top">
              <img class="fb-avatar" src="${avatar}" alt="Foto de ${escHtml(f.nome)}" width="54" height="54" onerror="this.src='assets/logo-256.png'">
              <div>
                <p class="fb-name">${escHtml(f.nome)}</p>
                ${f.servico ? `<p class="fb-service">${escHtml(f.servico)}</p>` : ""}
              </div>
            </div>
            <blockquote class="fb-text">“${escHtml(f.texto)}”</blockquote>
            <p class="fb-date">${escHtml(dateShort(f.created_at))}</p>
          </div>
        </div>
      </figure>`;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = feedbackList.map((_, i) =>
        `<button class="car-dot${i === fbIndex ? " active" : ""}" type="button" data-fb-slide="${i}" aria-label="Ir para o feedback ${i + 1}"></button>`
      ).join("");
      dotsBox.hidden = feedbackList.length < 2;
    }
    if (fbSectionPrev) fbSectionPrev.hidden = feedbackList.length < 2;
    if (fbSectionNext) fbSectionNext.hidden = feedbackList.length < 2;

    updateCarousel();
    startAutoplay();
  }

  function updateCarousel() {
    if (!track) return;
    track.style.transform = `translateX(-${fbIndex * 100}%)`;
    Array.from(track.children).forEach((slide, i) => {
      slide.setAttribute("aria-hidden", i === fbIndex ? "false" : "true");
    });
    if (dotsBox) {
      dotsBox.querySelectorAll(".car-dot").forEach((dot, i) => {
        dot.classList.toggle("active", i === fbIndex);
      });
    }
  }

  function goTo(index) {
    if (!feedbackList.length) return;
    fbIndex = (index + feedbackList.length) % feedbackList.length;
    updateCarousel();
    startAutoplay();
  }

  function startAutoplay() {
    stopAutoplay();
    if (feedbackList.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    fbTimer = setInterval(() => {
      fbIndex = (fbIndex + 1) % feedbackList.length;
      updateCarousel();
    }, 6500);
  }

  function stopAutoplay() {
    if (fbTimer) { clearInterval(fbTimer); fbTimer = null; }
  }

  if (fbSectionPrev) fbSectionPrev.onclick = () => goTo(fbIndex - 1);
  if (fbSectionNext) fbSectionNext.onclick = () => goTo(fbIndex + 1);
  if (dotsBox) {
    dotsBox.addEventListener("click", e => {
      const dot = e.target.closest("[data-fb-slide]");
      if (dot) goTo(Number(dot.dataset.fbSlide));
    });
  }
  if (track) {
    // Trocar foto principal ao tocar numa miniatura
    track.addEventListener("click", e => {
      const thumb = e.target.closest("[data-fb-full]");
      if (!thumb) return;
      const wrap = thumb.closest(".fb-photo-wrap");
      const mainImg = wrap ? wrap.querySelector(".fb-photo") : null;
      if (!mainImg) return;
      const img = thumb.querySelector("img");
      if (img) mainImg.src = img.currentSrc || img.src;
      wrap.querySelectorAll(".fb-thumb").forEach(t => t.classList.toggle("active", t === thumb));
    });
  }
  if (section) {
    section.addEventListener("mouseenter", stopAutoplay);
    section.addEventListener("mouseleave", startAutoplay);
    section.addEventListener("focusin", stopAutoplay);
    section.addEventListener("focusout", startAutoplay);
  }

  // -------------------------------------------------------------
  // CARREGAR LISTA
  // -------------------------------------------------------------
  async function loadFeedbacks() {
    try {
      const data = await window.db.getFeedbacks();
      feedbackList = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Não foi possível carregar os feedbacks:", e);
      feedbackList = [];
    }
    renderCarousel();
    renderAdminList();
  }

  // -------------------------------------------------------------
  // AVALIAR PELO PAINEL "MINHAS AGENDAS"
  // -------------------------------------------------------------
  const form = $("cp-fb-form");
  const errBox = $("fbf-err");
  const sendBtn = $("fbf-send");
  const nomeInput = $("fbf-nome");
  const textoInput = $("fbf-texto");
  const fotosInput = $("fbf-fotos");
  const perfilInput = $("fbf-perfil");
  const servicoLabel = $("fbf-servico");
  const hiddenBooking = $("fbf-booking");
  const cancelBtn = $("fbf-cancel");

  function openForm(booking) {
    if (!form) return;
    form.hidden = false;
    if (errBox) errBox.textContent = "";
    if (hiddenBooking) hiddenBooking.value = booking.id || "";
    if (servicoLabel) servicoLabel.textContent = booking.nome || "seu atendimento";
    if (nomeInput) nomeInput.value = booking.name || "";
    if (textoInput) textoInput.value = "";
    if (fotosInput) fotosInput.value = "";
    if (perfilInput) perfilInput.value = "";
    form.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (nomeInput) nomeInput.focus();
  }

  function closeForm() {
    if (form) form.hidden = true;
  }

  window.addEventListener("melry:review", e => {
    const booking = e.detail || {};
    openForm(booking);
  });

  if (cancelBtn) cancelBtn.addEventListener("click", closeForm);

  if (fotosInput) {
    fotosInput.addEventListener("change", () => {
      if (errBox) errBox.textContent = "";
      if (fotosInput.files.length > 3) {
        errBox.textContent = "Escolha no máximo 3 fotos.";
        fotosInput.value = "";
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (errBox) errBox.textContent = "";

      const email = ($("cp-email") && $("cp-email").value ? $("cp-email").value : "").trim().toLowerCase();
      const bookingId = hiddenBooking ? hiddenBooking.value : "";
      const nome = (nomeInput.value || "").trim();
      const texto = (textoInput.value || "").trim();
      const arquivos = fotosInput ? Array.from(fotosInput.files || []) : [];

      if (!nome) { errBox.textContent = "Digite seu nome."; return; }
      if (!texto) { errBox.textContent = "Escreva sua avaliação."; return; }
      if (!arquivos.length) { errBox.textContent = "Coloque ao menos 1 foto."; return; }
      if (arquivos.length > 3) { errBox.textContent = "Escolha no máximo 3 fotos."; return; }

      sendBtn.disabled = true;
      sendBtn.textContent = "Enviando...";

      try {
        const fotos = [];
        for (const f of arquivos) {
          const d = await resizeImage(f, 1000, 0.8);
          if (d) fotos.push(d);
        }
        let fotoPerfil = null;
        const perfil = perfilInput && perfilInput.files && perfilInput.files[0];
        if (perfil) fotoPerfil = await resizeImage(perfil, 400, 0.85);

        const servicoTexto = servicoLabel && servicoLabel.textContent ? servicoLabel.textContent : null;
        const res = await window.db.saveFeedback({
          id: "f_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          nome,
          email,
          texto,
          foto_perfil: fotoPerfil,
          fotos,
          servico: servicoTexto,
          booking_id: bookingId || null
        });

        if (res && res.ok) {
          errBox.textContent = "";
          closeForm();
          const ok = document.createElement("p");
          ok.className = "fb-thanks";
          ok.textContent = "Avaliação enviada! Obrigada 💜";
          $("cp-list").prepend(ok);
          await loadFeedbacks();
        } else {
          errBox.textContent = "Não conseguimos enviar agora. Tente de novo em instantes.";
        }
      } catch (err) {
        console.error("Erro ao enviar avaliação:", err);
        errBox.textContent = "Não conseguimos enviar agora. Tente de novo em instantes.";
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "Enviar avaliação";
      }
    });
  }

  // -------------------------------------------------------------
  // PAINEL ADMIN — listar e remover
  // -------------------------------------------------------------
  const adminList = $("fb-admin-list");

  function renderAdminList() {
    if (!adminList) return;
    if (!feedbackList.length) {
      adminList.innerHTML = '<p class="empty">Nenhum feedback publicado ainda.</p>';
      return;
    }
    adminList.innerHTML = feedbackList.map(f => {
      const fotos = asFotos(f.fotos);
      const thumb = fotos[0] || f.foto_perfil || "assets/logo-256.png";
      return `
      <div class="gal-item">
        <div class="gal-thumb"><img src="${thumb}" alt="Foto do feedback de ${escHtml(f.nome)}" loading="lazy"></div>
        <div class="gal-meta">
          <span>${escHtml(f.nome)}${f.servico ? ` · ${escHtml(f.servico)}` : ""}</span>
          <small>${escHtml((f.texto || "").slice(0, 90))}${(f.texto || "").length > 90 ? "…" : ""}</small>
        </div>
        <button class="mini del" type="button" data-fb-rm="${escHtml(f.id)}">Remover</button>
      </div>`;
    }).join("");
  }

  if (adminList) {
    adminList.addEventListener("click", async e => {
      const btn = e.target.closest("[data-fb-rm]");
      if (!btn) return;
      if (!confirm("Remover este feedback do site?")) return;
      try {
        await window.db.deleteFeedback(btn.dataset.fbRm);
        await loadFeedbacks();
      } catch (err) {
        alert("Erro ao remover. Tente novamente.");
      }
    });
  }

  // Inicia quando a página estiver pronta
  loadFeedbacks();

  // Exposto para o painel admin (atualiza a lista ao abrir a aba)
  window.feedbackUI = { refresh: loadFeedbacks };
})();
