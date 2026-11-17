/**
 * INICIALIZAÇÃO, LOGIN, PAINEL E TEMA
 * Ponto de entrada da aplicação.
 */

// -------------------------------------------------------------
// TELA DE CARREGAMENTO
// Some assim que os dados sobem (ou no máximo em LOADER_MAX_MS),
// com tempo mínimo de exibição pra animação respirar.
// -------------------------------------------------------------
const LOADER_MIN_MS = 1600;
const LOADER_MAX_MS = 5000;
const loaderStart = performance.now();
let loaderGone = false;

function hideLoader() {
  if (loaderGone) return;
  loaderGone = true;
  const el = $("app-loader");
  if (!el) return;
  const wait = Math.max(0, LOADER_MIN_MS - (performance.now() - loaderStart));
  setTimeout(() => {
    el.classList.add("done");
    setTimeout(() => el.remove(), 700);
  }, wait);
}
// Rede: se qualquer coisa travar, a tela some mesmo assim.
setTimeout(hideLoader, LOADER_MAX_MS);
window.addEventListener("load", hideLoader);

// -------------------------------------------------------------
// INICIALIZAÇÃO DE DADOS
// -------------------------------------------------------------
async function initApp() {
  try {
    // Dispara as três consultas em paralelo — em série, uma consulta
    // travada atrasava a página pelo triplo do timeout.
    const [s, a, b] = await Promise.all([
      window.db.getServices(),
      window.db.getAvailability(),
      window.db.getBookings()
    ]);
    services = s;
    avail = a;
    bookings = b;
  } catch (err) {
    console.error("Erro na inicialização dos dados:", err);
  }

  loadBio();
  loadGallery();
  renderServices();
  updateDbStatusIndicator();
  hideLoader();
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
  closeDrawer();
  renderServices();
  view("public");
};

// -------------------------------------------------------------
// PAINEL DE CONTROLE (ADMIN)
// -------------------------------------------------------------
function adminTab(t) {
  const m = { econ: "p-econ", serv: "p-serv", gal: "p-gal", hor: "p-hor", ag: "p-ag", bio: "p-bio", pdf: "p-pdf", zap: "p-zap" };
  for (const k in m) {
    const el = $(m[k]);
    if (el) el.hidden = k !== t;
    const tabBtn = $("at-" + k);
    if (tabBtn) tabBtn.setAttribute("aria-selected", k === t);
  }
  if (t === "econ") renderEconomia();
  if (t === "ag") renderAgenda();
  if (t === "gal") renderGalleryAdmin();
  if (t === "bio") initBioAdminForm();
  if (t === "hor") {
    if (!$("hdate").value) $("hdate").value = iso(new Date());
    $("hdate").min = iso(new Date());
    renderSlots();
  }
}

// -------------------------------------------------------------
// MENU LATERAL (DRAWER)
// -------------------------------------------------------------
function openDrawer() {
  const drawer = $("admin-drawer");
  const backdrop = $("drawer-backdrop");
  if (!drawer) return;
  drawer.classList.add("open");
  if (backdrop) backdrop.hidden = false;
  document.body.classList.add("drawer-open");
  if ($("drawer-toggle")) $("drawer-toggle").setAttribute("aria-expanded", "true");
  const first = drawer.querySelector('[role="tab"]');
  if (first) first.focus();
}

function closeDrawer() {
  const drawer = $("admin-drawer");
  const backdrop = $("drawer-backdrop");
  if (!drawer) return;
  drawer.classList.remove("open");
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove("drawer-open");
  if ($("drawer-toggle")) $("drawer-toggle").setAttribute("aria-expanded", "false");
}

if ($("drawer-toggle")) $("drawer-toggle").onclick = openDrawer;
if ($("drawer-close")) $("drawer-close").onclick = closeDrawer;
if ($("drawer-backdrop")) $("drawer-backdrop").onclick = closeDrawer;
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeDrawer();
});

const ADMIN_TABS = ["econ", "serv", "gal", "hor", "ag", "bio", "pdf", "zap"];
for (const t of ADMIN_TABS) {
  const btn = $("at-" + t);
  if (!btn) continue;
  btn.onclick = () => {
    adminTab(t);
    closeDrawer();
  };
}

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
