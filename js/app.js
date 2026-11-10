/**
 * APLICATIVO DE AGENDAMENTO - MERLY BEAUTY STUDIO
 * Manicure, Designer de Sobrancelha e Cílios
 */

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Credenciais do Painel da Administradora
const USER = "maria clara";
const PASS = "0000";

// Estado da Aplicação
let services = [];
let bookings = [];
let avail = {};
let currentCategory = "todos";
const sel = { svc: null, date: null, time: null };

// Utilitários de Data e Moeda
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const hm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const fromIso = s => {
  const [a, b, c] = s.split("-").map(Number);
  return new Date(a, b - 1, c);
};
const fmtLong = s => fromIso(s).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const brl = n => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: Number(n) % 1 ? 2 : 0 });
const durTxt = m => m < 60 ? m + " min" : (Math.floor(m / 60) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : ""));
const svcById = id => services.find(s => s.id === id);
const pic = s => s.foto ? `<img src="${s.foto}" alt="${esc(s.nome)}">` : `<div class="ph">${esc(s.nome.charAt(0).toUpperCase())}</div>`;

const categoryLabels = {
  todos: "Todos",
  cilios: "Cílios",
  sobrancelhas: "Sobrancelhas",
  manicure: "Manicure & Pedicure",
  geral: "Outros"
};

// Navegação entre Telas
function view(v) {
  for (const n of ["public", "booking", "login", "admin"]) {
    const el = $("v-" + n);
    if (el) el.hidden = n !== v;
  }
  window.scrollTo(0, 0);
}

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
// SEÇÃO "QUEM SOU EU" (BIO DA PROFISSIONAL)
// -------------------------------------------------------------
const BIO_KEY = "melry_studio_bio";
let bioData = {
  nome: "Maria Clara",
  titulo: "Especialista em Cílios, Sobrancelhas e Unhas",
  texto: "Realçando sua beleza natural com atendimento exclusivo, biossegurança e técnicas modernas de alta durabilidade.",
  foto: null
};

let pendingBioPhoto = null;

function loadBio() {
  try {
    const saved = localStorage.getItem(BIO_KEY);
    if (saved) bioData = { ...bioData, ...JSON.parse(saved) };
  } catch (e) {}

  if ($("bio-name-public")) $("bio-name-public").textContent = bioData.nome || "Maria Clara";
  if ($("bio-role-public")) $("bio-role-public").textContent = bioData.titulo || "";
  if ($("bio-text-public")) $("bio-text-public").textContent = bioData.texto || "";
  
  const imgPub = $("bio-img-public");
  const phPub = $("bio-ph-public");
  if (imgPub && phPub) {
    if (bioData.foto) {
      imgPub.src = bioData.foto;
      imgPub.style.display = "block";
      phPub.style.display = "none";
    } else {
      imgPub.style.display = "none";
      phPub.style.display = "grid";
      const initials = (bioData.nome || "MC").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
      phPub.textContent = initials || "MC";
    }
  }
}

function initBioAdminForm() {
  if (!$("bio-name-input")) return;
  $("bio-name-input").value = bioData.nome || "";
  $("bio-role-input").value = bioData.titulo || "";
  $("bio-text-input").value = bioData.texto || "";
  pendingBioPhoto = null;

  const prev = $("bio-prev");
  const previmg = $("bio-previmg");
  if (bioData.foto) {
    previmg.src = bioData.foto;
    prev.hidden = false;
  } else {
    prev.hidden = true;
  }
}

if ($("bio-file-input")) {
  $("bio-file-input").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    readPhoto(f, d => {
      if (!d) {
        $("bio-err").textContent = "Não foi possível carregar a imagem. Tente outra.";
        return;
      }
      pendingBioPhoto = d;
      $("bio-previmg").src = d;
      $("bio-prev").hidden = false;
      $("bio-err").textContent = "";
    });
  });
}

if ($("bio-save-btn")) {
  $("bio-save-btn").addEventListener("click", () => {
    const nome = $("bio-name-input").value.trim();
    const titulo = $("bio-role-input").value.trim();
    const texto = $("bio-text-input").value.trim();
    const err = $("bio-err");
    err.textContent = "";

    if (!nome) {
      err.textContent = "Digite o seu nome.";
      $("bio-name-input").focus();
      return;
    }

    bioData.nome = nome;
    bioData.titulo = titulo;
    bioData.texto = texto;
    if (pendingBioPhoto) bioData.foto = pendingBioPhoto;

    try {
      localStorage.setItem(BIO_KEY, JSON.stringify(bioData));
      loadBio();
      alert("Apresentação 'Quem Sou Eu' atualizada com sucesso!");
    } catch (e) {
      err.textContent = "Erro ao salvar: imagem muito pesada ou sem espaço local.";
    }
  });
}

// -------------------------------------------------------------
// CATÁLOGO PÚBLICO (EXIBINDO TODOS OS SERVIÇOS)
// -------------------------------------------------------------
function renderServices() {
  const box = $("services");
  if (!box) return;

  if (!services.length) {
    box.innerHTML = '<p class="empty">Nenhum serviço disponível no momento.</p>';
    return;
  }

  box.innerHTML = services.map((s, i) => `
    <div class="svc-row${i % 2 ? " flip" : ""}">
      <div class="txt">
        <h3 class="sname">${esc(s.nome)}</h3>
        <span class="sdur">${durTxt(s.dur)}</span>
        <div class="sprice">${brl(s.preco)}</div>
        <button class="btn" data-pick="${s.id}">Agendar</button>
      </div>
      <div class="pic">${pic(s)}</div>
    </div>`).join("");
}

$("services").addEventListener("click", e => {
  const b = e.target.closest("[data-pick]");
  if (!b) return;
  sel.svc = b.dataset.pick;
  sel.date = null;
  sel.time = null;
  $("done").hidden = true;
  $("bflowwrap").hidden = false;
  $("err").textContent = "";
  renderBooking();
  view("booking");
  location.hash = "agendar";
});

// -------------------------------------------------------------
// FLUXO DE AGENDAMENTO (CLIENTE)
// -------------------------------------------------------------
function validStarts(date, dur) {
  const a = avail[date];
  if (!a) return [];
  const now = new Date(), isToday = iso(now) === date, nowMin = now.getHours() * 60 + now.getMinutes();
  const bk = bookings.filter(b => b.date === date && b.status !== "cancelado");
  const res = [];
  for (let s = 0; s + dur <= 1440; s += 30) {
    if (isToday && s <= nowMin) continue;
    let ok = true;
    for (let k = s; k < s + dur; k += 30) {
      if (a[k] !== 1 || bk.some(b => k < b.start + b.dur && b.start < k + 30)) {
        ok = false;
        break;
      }
    }
    if (ok) res.push(s);
  }
  return res;
}

function renderBooking() {
  const s = svcById(sel.svc);
  if (!s) {
    view("public");
    return;
  }
  $("chosen").innerHTML = `<b style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem">${esc(s.nome)}</b><br>${brl(s.preco)} · ${durTxt(s.dur)}`;
  
  const days = [], t = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
    if (validStarts(iso(d), s.dur).length) days.push(d);
  }

  $("bnone").hidden = days.length > 0;
  $("bflow").hidden = !days.length;
  if (!days.length) return;

  if (sel.date && !days.some(d => iso(d) === sel.date)) {
    sel.date = null;
    sel.time = null;
  }

  $("days").innerHTML = days.map(d => {
    const v = iso(d);
    return `<button class="chip day" data-d="${v}" aria-pressed="${sel.date === v}">
      <small>${d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small>
      <b>${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}</b>
    </button>`;
  }).join("");

  const box = $("times");
  if (!sel.date) {
    box.innerHTML = '<p class="empty">Escolha um dia para ver os horários disponíveis.</p>';
  } else {
    const list = validStarts(sel.date, s.dur);
    if (sel.time !== null && !list.includes(sel.time)) sel.time = null;
    box.innerHTML = list.length
      ? list.map(m => `<button class="chip" data-t="${m}" aria-pressed="${sel.time === m}">${hm(m)}</button>`).join("")
      : '<p class="empty">Nenhum horário livre para este dia.</p>';
  }

  $("confirm").disabled = !(sel.date && sel.time !== null);
}

$("days").addEventListener("click", e => {
  const b = e.target.closest("[data-d]");
  if (!b) return;
  sel.date = b.dataset.d;
  sel.time = null;
  renderBooking();
});

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

// -------------------------------------------------------------
// LOGIN DA ADMINISTRADORA
// -------------------------------------------------------------
const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

$("enter").onclick = () => {
  $("lerr").textContent = "";
  $("lu").value = "";
  $("lp").value = "";
  view("login");
  $("lu").focus();
};
$("lback").onclick = () => view("public");

function doLogin() {
  if (norm($("lu").value) === USER && $("lp").value === PASS) {
    resetForm();
    adminTab("serv");
    renderAdminServices();
    updateDbStatusIndicator();
    view("admin");
  } else {
    $("lerr").textContent = "Nome ou senha incorretos.";
  }
}
$("login").onclick = doLogin;
$("lp").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
$("logout").onclick = () => {
  renderServices();
  view("public");
};

// -------------------------------------------------------------
// PAINEL DE CONTROLE (ADMIN)
// -------------------------------------------------------------
function adminTab(t) {
  const m = { serv: "p-serv", hor: "p-hor", ag: "p-ag", bio: "p-bio", pdf: "p-pdf" };
  for (const k in m) {
    const el = $(m[k]);
    if (el) el.hidden = k !== t;
    const tabBtn = $("at-" + k);
    if (tabBtn) tabBtn.setAttribute("aria-selected", k === t);
  }
  if (t === "ag") renderAgenda();
  if (t === "bio") initBioAdminForm();
  if (t === "hor") {
    if (!$("hdate").value) $("hdate").value = iso(new Date());
    $("hdate").min = iso(new Date());
    renderSlots();
  }
}
$("at-serv").onclick = () => adminTab("serv");
$("at-hor").onclick = () => adminTab("hor");
$("at-ag").onclick = () => adminTab("ag");
if ($("at-bio")) $("at-bio").onclick = () => adminTab("bio");
if ($("at-pdf")) $("at-pdf").onclick = () => adminTab("pdf");

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
// GESTÃO DE HORÁRIOS (DISPONIBILIDADE)
// -------------------------------------------------------------
function renderSlots() {
  const d = $("hdate").value;
  if (!d) {
    $("slots").innerHTML = '<p class="empty">Escolha um dia.</p>';
    return;
  }
  const a = avail[d] || {}, booked = {};
  bookings.filter(b => b.date === d && b.status !== "cancelado").forEach(b => {
    for (let k = b.start; k < b.start + b.dur; k += 30) booked[k] = b;
  });

  let h = "";
  for (let k = 0; k < 1440; k += 30) {
    if (booked[k]) {
      h += `<button class="slot booked" disabled><b>${hm(k)}</b><small>Agendado</small></button>`;
      continue;
    }
    const st = a[k] || 0;
    h += `<button class="slot ${st === 1 ? "free" : st === 2 ? "busy" : ""}" data-k="${k}">
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
  avail[d] = avail[d] || {};
  const next = ((avail[d][k] || 0) + 1) % 3;
  avail = await window.db.setSlotStatus(d, k, next);
  renderSlots();
});

$("open9").onclick = async () => {
  const d = $("hdate").value;
  if (!d) return;
  avail = await window.db.batchOpenDay(d, 540, 1080); // 9h às 18h (540 a 1080 min)
  renderSlots();
};

$("clearday").onclick = async () => {
  const d = $("hdate").value;
  if (!d || !confirm("Limpar todos os horários deste dia?")) return;
  avail = await window.db.clearDay(d);
  renderSlots();
};

// -------------------------------------------------------------
// GESTÃO DE SERVIÇOS (CRUD)
// -------------------------------------------------------------
let editId = null, pendingPhoto = null, keepPhoto = null;

function resetForm() {
  editId = null;
  pendingPhoto = null;
  keepPhoto = null;
  $("sn").value = "";
  $("scat").value = "cilios";
  $("sp").value = "";
  $("sd").value = "60";
  $("sf").value = "";
  $("prev").hidden = true;
  $("serr").textContent = "";
  $("ftitle").textContent = "Novo serviço";
  $("ssave").textContent = "Adicionar serviço";
  $("scancelwrap").hidden = true;
}

function readPhoto(file, cb) {
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const M = 700, k = Math.min(1, M / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", 0.78));
    };
    im.onerror = () => cb(null);
    im.src = r.result;
  };
  r.onerror = () => cb(null);
  r.readAsDataURL(file);
}

$("sf").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  readPhoto(f, d => {
    if (!d) {
      $("serr").textContent = "Não foi possível carregar a imagem. Tente outra.";
      return;
    }
    pendingPhoto = d;
    $("previmg").src = d;
    $("prev").hidden = false;
    $("serr").textContent = "";
  });
});

$("ssave").onclick = async () => {
  const nome = $("sn").value.trim();
  const categoria = $("scat").value;
  const preco = parseFloat($("sp").value);
  const dur = Number($("sd").value);
  const err = $("serr");
  err.textContent = "";

  if (nome.length < 2) {
    err.textContent = "Digite o nome do serviço.";
    $("sn").focus();
    return;
  }
  if (!(preco >= 0)) {
    err.textContent = "Digite um valor válido para o serviço.";
    $("sp").focus();
    return;
  }

  const foto = pendingPhoto || keepPhoto || null;
  const serviceObj = {
    id: editId || ("s_" + Date.now().toString(36)),
    nome,
    categoria,
    preco,
    dur,
    foto
  };

  const btn = $("ssave");
  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {
    await window.db.saveService(serviceObj);
    services = await window.db.getServices();
    resetForm();
    renderAdminServices();
  } catch (e) {
    err.textContent = "Erro ao salvar serviço: " + (e.message || "Tente novamente");
  } finally {
    btn.disabled = false;
    btn.textContent = editId ? "Salvar alterações" : "Adicionar serviço";
  }
};

$("scancel").onclick = resetForm;

function renderAdminServices() {
  const list = $("slist");
  if (!list) return;

  list.innerHTML = services.length ? services.map(s => `
    <div class="row">
      <div class="left">
        <div class="thumb">${pic(s)}</div>
        <div>
          <div class="t">${esc(s.nome)}</div>
          <div class="m">${esc(categoryLabels[s.categoria] || s.categoria || "Geral")} · ${brl(s.preco)} · ${durTxt(s.dur)}</div>
        </div>
      </div>
      <div class="acts">
        <button class="mini" data-edit="${s.id}">Editar</button>
        <button class="mini del" data-rm="${s.id}">Excluir</button>
      </div>
    </div>`).join("") : '<p class="empty">Nenhum serviço cadastrado ainda.</p>';
}

$("slist").addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]");
  const rm = e.target.closest("[data-rm]");

  if (ed) {
    const s = svcById(ed.dataset.edit);
    if (!s) return;
    editId = s.id;
    pendingPhoto = null;
    keepPhoto = s.foto;
    $("sn").value = s.nome;
    $("scat").value = s.categoria || "cilios";
    $("sp").value = s.preco;
    $("sd").value = String(s.dur);
    $("sf").value = "";
    if (s.foto) {
      $("previmg").src = s.foto;
      $("prev").hidden = false;
    } else {
      $("prev").hidden = true;
    }
    $("ftitle").textContent = "Editar serviço";
    $("ssave").textContent = "Salvar alterações";
    $("scancelwrap").hidden = false;
    $("ftitle").scrollIntoView({ behavior: "smooth" });
  }

  if (rm) {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    try {
      await window.db.deleteService(rm.dataset.rm);
      services = await window.db.getServices();
      if (editId === rm.dataset.rm) resetForm();
      renderAdminServices();
    } catch (err) {
      alert("Erro ao excluir: " + (err.message || "Tente novamente"));
    }
  }
});

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

// -------------------------------------------------------------
// EXPORTAÇÃO DA TELA PRINCIPAL EM PDF
// -------------------------------------------------------------
if ($("btn-export-pdf")) {
  $("btn-export-pdf").addEventListener("click", async () => {
    const btn = $("btn-export-pdf");
    const originalText = btn.textContent;
    const publicScreen = $("v-public");
    const page = document.querySelector(".wrap");
    if (!publicScreen || !page) return;

    btn.disabled = true;
    btn.textContent = "Gerando PDF da página principal...";

    const exportPage = page.cloneNode(true);
    const publicCopy = exportPage.querySelector("#v-public");
    const themeButton = exportPage.querySelector("#theme");
    const bodyStyle = getComputedStyle(document.body);
    const stage = document.createElement("div");
    stage.style.cssText = "position:fixed;left:-10000px;top:0;width:680px;z-index:-1;pointer-events:none;";
    exportPage.style.width = "680px";
    exportPage.style.maxWidth = "680px";
    exportPage.style.position = "relative";
    exportPage.style.backgroundColor = bodyStyle.backgroundColor;
    exportPage.style.backgroundImage = bodyStyle.backgroundImage;
    exportPage.style.backgroundSize = "cover";

    for (const selector of ["#v-booking", "#v-login", "#v-admin"]) {
      const section = exportPage.querySelector(selector);
      if (section) section.remove();
    }
    if (publicCopy) publicCopy.hidden = false;
    if (themeButton) {
      themeButton.style.position = "absolute";
      themeButton.style.top = "10px";
      themeButton.style.right = "12px";
    }

    stage.appendChild(exportPage);
    document.body.appendChild(stage);

    try {
      if (!window.html2canvas || !window.jspdf) {
        throw new Error("As bibliotecas necessárias para gerar o PDF não foram carregadas.");
      }

      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const images = Array.from(exportPage.querySelectorAll("img"));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      const canvas = await window.html2canvas(exportPage, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: null,
        width: 680,
        windowWidth: 680
      });
      const image = canvas.toDataURL("image/jpeg", 0.96);
      const pdfWidth = 210;
      const pdfHeight = canvas.height * pdfWidth / canvas.width;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfWidth, pdfHeight]
      });
      pdf.addImage(image, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("catalogo-melry-beauty-studio.pdf");
    } catch (err) {
      console.error("Erro na geração do PDF:", err);
      alert("Não foi possível gerar o PDF da página principal. Verifique sua conexão e tente novamente.");
    } finally {
      stage.remove();
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
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
