/**
 * INICIALIZAÇÃO, LOGIN, PAINEL E TEMA
 * Ponto de entrada da aplicação.
 */

// -------------------------------------------------------------
// INICIALIZAÇÃO DE DADOS
// -------------------------------------------------------------
async function initApp() {
  const loader = $("app-loader");
  const startTime = Date.now();

  try {
    services = await window.db.getServices();
    avail = await window.db.getAvailability();
    bookings = await window.db.getBookings();
  } catch (err) {
    console.error("Erro na inicialização dos dados:", err);
  }

  loadBio();
  loadGallery();
  renderServices();
  updateDbStatusIndicator();

  // Fecha a splash de carregamento de forma fluida e suave assim que o catálogo carregar
  if (loader) {
    const elapsed = Date.now() - startTime;
    // Garante no mínimo 800ms para o vídeo reproduzir com elegância
    const remaining = Math.max(0, 900 - elapsed);
    setTimeout(() => {
      loader.classList.add("fade-out");
      setTimeout(() => {
        loader.style.display = "none";
      }, 700);
    }, remaining);
  }
}

// -------------------------------------------------------------
// LOGIN DA PROFISSIONAL
// -------------------------------------------------------------
$("enter").onclick = () => {
  $("lerr").textContent = "";
  $("lp").value = "";
  view("login");
  $("lp").focus();
};
$("lback").onclick = () => view("public");

function doLogin() {
  if ($("lp").value === PASS) {
    $("lerr").textContent = "";
    resetForm();
    adminTab("serv");
    renderAdminServices();
    updateDbStatusIndicator();
    view("admin");
  } else {
    $("lerr").textContent = $("lp").value
      ? "Senha incorreta. Tente novamente."
      : "Digite a senha para continuar.";
    $("lp").focus();
  }
}
$("login").onclick = doLogin;
$("lp").addEventListener("input", () => { $("lerr").textContent = ""; });
$("lp").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
$("logout").onclick = () => {
  renderServices();
  view("public");
};

// -------------------------------------------------------------
// PAINEL DE CONTROLE (ADMIN)
// -------------------------------------------------------------
function adminTab(t) {
  const m = { serv: "p-serv", gal: "p-gal", hor: "p-hor", ag: "p-ag", bio: "p-bio", pdf: "p-pdf", zap: "p-zap" };
  for (const k in m) {
    const el = $(m[k]);
    if (el) el.hidden = k !== t;
    const tabBtn = $("at-" + k);
    if (tabBtn) tabBtn.setAttribute("aria-selected", k === t);
  }
  if (t === "ag") renderAgenda();
  if (t === "gal") renderGalleryAdmin();
  if (t === "bio") initBioAdminForm();
  if (t === "hor") {
    if (!$("hdate").value) $("hdate").value = iso(new Date());
    $("hdate").min = iso(new Date());
    renderSlots();
  }
}
$("at-serv").onclick = () => adminTab("serv");
$("at-gal").onclick = () => adminTab("gal");
$("at-hor").onclick = () => adminTab("hor");
$("at-ag").onclick = () => adminTab("ag");
if ($("at-bio")) $("at-bio").onclick = () => adminTab("bio");
if ($("at-pdf")) $("at-pdf").onclick = () => adminTab("pdf");
if ($("at-zap")) $("at-zap").onclick = () => adminTab("zap");

function updateDbStatusIndicator() {
  const el = $("db-status");
  if (!el) return;
  const isOnline = window.db.isOnline();
  const hasConfig = window.db.hasValidConfig();

  if (isOnline) {
    el.innerHTML = '<span class="db-dot online"></span> Conectado ao Supabase';
    el.title = "Banco de dados sincronizado em tempo real com o Supabase";
  } else if (!hasConfig) {
    el.innerHTML = '<span class="db-dot offline"></span> Modo Demonstração (Local)';
    el.title = "Configure o Supabase em js/config.js para ativar o banco online";
  } else {
    el.innerHTML = '<span class="db-dot offline"></span> Modo Offline (Falha de conexão)';
    el.title = "Não foi possível conectar ao Supabase. Verifique a URL e a Anon Key.";
  }
}

// -------------------------------------------------------------
// TEMA CLARO / ESCURO
// -------------------------------------------------------------
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  $("theme").setAttribute("aria-pressed", t === "dark");
  $("theme").setAttribute("aria-label", t === "dark" ? "Ativar modo claro" : "Ativar modo escuro");
  try {
    localStorage.setItem("melry_tema", t);
  } catch (e) {}
}

$("theme").onclick = () => setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
let t0 = "light";
try {
  t0 = localStorage.getItem("melry_tema") || "light";
} catch (e) {}
setTheme(t0 === "dark" ? "dark" : "light");

// Disparo Inicial
initApp();
