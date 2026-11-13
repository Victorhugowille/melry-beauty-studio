/**
 * CATÁLOGO PÚBLICO E CADASTRO DE SERVIÇOS
 * Cartões da página inicial, formulário de cadastro e lista administrativa.
 */

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
    <article class="svc-row${i % 2 ? " flip" : ""}">
      <div class="txt">
        <span class="sbadge">${esc(categoryLabels[s.categoria] || categoryLabels.geral)}</span>
        <h3 class="sname">${esc(s.nome)}</h3>
        <div class="smeta">
          <span class="sprice">${brl(s.preco)}</span>
          <span class="sdot" aria-hidden="true">·</span>
          <span class="sdur">${durTxt(s.dur)}</span>
        </div>
        <button class="btn" data-pick="${s.id}" aria-label="Agendar ${esc(s.nome)}">Agendar</button>
      </div>
      <div class="pic" aria-hidden="true">${pic(s)}</div>
    </article>`).join("");
}

$("services").addEventListener("click", e => {
  const b = e.target.closest("[data-pick]");
  if (!b) return;
  sel.svc = b.dataset.pick;
  sel.date = null;
  sel.time = null;
  resetCalendarCursor();
  $("done").hidden = true;
  $("bflowwrap").hidden = false;
  $("err").textContent = "";
  renderBooking();
  view("booking");
  location.hash = "agendar";
});

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

function readPhoto(file, cb, maxSize = 700, quality = 0.78) {
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const M = maxSize, k = Math.min(1, M / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", quality));
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
