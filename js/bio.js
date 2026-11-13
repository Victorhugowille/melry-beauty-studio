/**
 * BIOGRAFIA DA PROFISSIONAL
 * Carregamento, exibição pública e formulário de edição da biografia.
 */

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

async function loadBio() {
  // Mostra primeiro a versão salva neste dispositivo (abertura instantânea).
  try {
    const local = JSON.parse(localStorage.getItem(BIO_KEY));
    if (local) {
      bioData = { ...bioData, ...local };
      renderBio();
    }
  } catch (e) {}

  try {
    const saved = await window.db.getBio();
    if (saved) bioData = { ...bioData, ...saved };
  } catch (e) {
    console.warn("Não foi possível carregar a biografia do banco:", e);
  }
  renderBio();
}

function renderBio() {
  if ($("admin-greeting")) $("admin-greeting").textContent = "Olá, " + (bioData.nome || "Maria Clara") + ".";
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
  $("bio-save-btn").addEventListener("click", async () => {
    const nome = $("bio-name-input").value.trim();
    const titulo = $("bio-role-input").value.trim();
    const texto = $("bio-text-input").value.trim();
    const err = $("bio-err");
    const btn = $("bio-save-btn");
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

    btn.disabled = true;
    btn.textContent = "Salvando...";

    try {
      const res = await window.db.saveBio(bioData);
      await loadBio();
      initBioAdminForm();
      alert(res && res.synced === false
        ? "Biografia salva neste dispositivo. Rode o SQL no Supabase para publicar online."
        : "Biografia atualizada com sucesso!");
    } catch (e) {
      err.textContent = "Erro ao salvar a biografia. Tente novamente.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Salvar Apresentação";
    }
  });
}
