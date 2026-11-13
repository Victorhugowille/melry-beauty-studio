/**
 * GALERIA E CARROSSEL DE FOTOS
 * Carrossel da página pública e gerenciamento das fotos no painel.
 */

// -------------------------------------------------------------
// GALERIA / CARROSSEL
// -------------------------------------------------------------
const GALLERY_KEY = "melry_studio_galeria";
const MAX_GALLERY = 8;
let gallery = [];
let pendingGalleryPhoto = null;
let carouselIndex = 0;
let carouselTimer = null;

async function loadGallery() {
  // Mostra primeiro as fotos salvas neste dispositivo (abertura instantânea).
  try {
    const local = JSON.parse(localStorage.getItem(GALLERY_KEY));
    if (Array.isArray(local)) {
      gallery = local;
      if (carouselIndex >= gallery.length) carouselIndex = 0;
      renderCarousel();
      renderGalleryAdmin();
    }
  } catch (e) {}

  try {
    const data = await window.db.getGallery();
    gallery = Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("Não foi possível carregar a galeria:", e);
    gallery = [];
  }

  if (carouselIndex >= gallery.length) carouselIndex = 0;
  renderCarousel();
  renderGalleryAdmin();
}

function renderCarousel() {
  const section = $("gallery-section");
  const track = $("carousel-track");
  const dots = $("car-dots");
  if (!section || !track || !dots) return;

  if (!gallery.length) {
    section.hidden = true;
    stopCarousel();
    track.innerHTML = "";
    dots.innerHTML = "";
    return;
  }

  section.hidden = false;
  if (carouselIndex >= gallery.length) carouselIndex = 0;

  track.innerHTML = gallery.map((p, i) => `
    <figure class="carousel-slide" aria-hidden="${i !== carouselIndex}">
      <img src="${p.foto}" alt="${esc(p.legenda || "Foto do Melry Beauty Studio")}" ${i === 0 ? 'loading="eager"' : 'loading="lazy"'}>
      ${p.legenda ? `<figcaption>${esc(p.legenda)}</figcaption>` : ""}
    </figure>`).join("");

  dots.innerHTML = gallery.map((_, i) => `
    <button class="car-dot${i === carouselIndex ? " active" : ""}" type="button" data-slide="${i}" aria-label="Ir para a foto ${i + 1}"></button>`).join("");

  const many = gallery.length > 1;
  $("car-prev").hidden = !many;
  $("car-next").hidden = !many;
  dots.hidden = !many;

  updateCarousel();
  startCarousel();
}

function updateCarousel() {
  const track = $("carousel-track");
  if (!track) return;

  track.style.transform = `translateX(-${carouselIndex * 100}%)`;

  Array.from(track.children).forEach((slide, i) => {
    slide.setAttribute("aria-hidden", i === carouselIndex ? "false" : "true");
  });

  document.querySelectorAll(".car-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === carouselIndex);
  });
}

function goToSlide(index) {
  if (!gallery.length) return;
  carouselIndex = (index + gallery.length) % gallery.length;
  updateCarousel();
  startCarousel();
}

function startCarousel() {
  stopCarousel();
  if (gallery.length < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  carouselTimer = setInterval(() => {
    carouselIndex = (carouselIndex + 1) % gallery.length;
    updateCarousel();
  }, 6000);
}

function stopCarousel() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

if ($("car-prev")) $("car-prev").onclick = () => goToSlide(carouselIndex - 1);
if ($("car-next")) $("car-next").onclick = () => goToSlide(carouselIndex + 1);

if ($("car-dots")) {
  $("car-dots").addEventListener("click", e => {
    const dot = e.target.closest("[data-slide]");
    if (!dot) return;
    goToSlide(Number(dot.dataset.slide));
  });
}

if ($("carousel")) {
  $("carousel").addEventListener("mouseenter", stopCarousel);
  $("carousel").addEventListener("mouseleave", startCarousel);
  $("carousel").addEventListener("focusin", stopCarousel);
  $("carousel").addEventListener("focusout", startCarousel);
}

if ($("carousel-track")) {
  let dragStartX = null;

  $("carousel-track").addEventListener("pointerdown", e => {
    dragStartX = e.clientX;
    stopCarousel();
  });

  $("carousel-track").addEventListener("pointerup", e => {
    if (dragStartX === null) return;
    const dx = e.clientX - dragStartX;
    dragStartX = null;
    if (Math.abs(dx) > 45) goToSlide(carouselIndex + (dx < 0 ? 1 : -1));
    else startCarousel();
  });

  $("carousel-track").addEventListener("pointercancel", () => {
    dragStartX = null;
    startCarousel();
  });
}

function renderGalleryAdmin() {
  const list = $("gal-list");
  if (!list) return;

  list.innerHTML = gallery.length ? gallery.map((p, i) => `
    <div class="gal-item">
      <div class="gal-thumb"><img src="${p.foto}" alt="${esc(p.legenda || "Foto do carrossel")}" loading="lazy"></div>
      <div class="gal-meta">
        <span>${esc(p.legenda || "Sem legenda")}</span>
        <small>Foto ${i + 1} de ${gallery.length}</small>
      </div>
      <button class="mini del" type="button" data-gal-rm="${p.id}">Remover</button>
    </div>`).join("") : '<p class="empty">Nenhuma foto publicada ainda.</p>';

  if ($("gal-add")) {
    $("gal-add").disabled = !pendingGalleryPhoto || gallery.length >= MAX_GALLERY;
  }
}

if ($("gal-file")) {
  $("gal-file").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;

    $("gal-err").textContent = "";
    readPhoto(f, d => {
      if (!d) {
        $("gal-err").textContent = "Não foi possível carregar a imagem. Tente outra.";
        return;
      }
      pendingGalleryPhoto = d;
      $("gal-previmg").src = d;
      $("gal-prev").hidden = false;
      $("gal-add").disabled = false;
    }, 1200, 0.8);
  });
}

if ($("gal-add")) {
  $("gal-add").addEventListener("click", async () => {
    const err = $("gal-err");
    const btn = $("gal-add");
    err.textContent = "";

    if (!pendingGalleryPhoto) {
      err.textContent = "Escolha uma foto primeiro.";
      return;
    }
    if (gallery.length >= MAX_GALLERY) {
      err.textContent = `Limite de ${MAX_GALLERY} fotos no carrossel. Remova uma para adicionar outra.`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Adicionando...";

    const photo = {
      id: "g_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      foto: pendingGalleryPhoto,
      legenda: $("gal-caption").value.trim() || null,
      ordem: gallery.length
    };

    try {
      const res = await window.db.saveGalleryPhoto(photo);
      pendingGalleryPhoto = null;
      $("gal-file").value = "";
      $("gal-caption").value = "";
      $("gal-prev").hidden = true;
      gallery = await window.db.getGallery();
      if (!Array.isArray(gallery)) gallery = [];
      renderCarousel();
      renderGalleryAdmin();

      if (res && res.synced === false) {
        err.textContent = "Foto salva neste dispositivo. Rode o SQL no Supabase para publicar online.";
      }
    } catch (e) {
      err.textContent = "Erro ao adicionar a foto. Tente novamente.";
    } finally {
      btn.textContent = "Adicionar ao carrossel";
      btn.disabled = !pendingGalleryPhoto || gallery.length >= MAX_GALLERY;
    }
  });
}

if ($("gal-list")) {
  $("gal-list").addEventListener("click", async e => {
    const btn = e.target.closest("[data-gal-rm]");
    if (!btn) return;
    if (!confirm("Remover esta foto do carrossel?")) return;

    try {
      await window.db.deleteGalleryPhoto(btn.dataset.galRm);
      gallery = await window.db.getGallery();
      if (!Array.isArray(gallery)) gallery = [];
      renderCarousel();
      renderGalleryAdmin();
    } catch (e) {
      alert("Erro ao remover a foto. Tente novamente.");
    }
  });
}
