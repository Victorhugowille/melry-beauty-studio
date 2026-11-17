/**
 * EXPORTAÇÃO DA PÁGINA EM PDF
 * Gera o catálogo da página principal (sem o carrossel e sem os botões Agendar).
 */

const PDF_EXPORT_WIDTH = 800;

// Ajustes só para o PDF: o html2canvas perde sombras, curvas e gradientes.
// Simplificamos esses pontos sem mudar o visual do catálogo.
function pdfExportStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .svc-row, .svc-row.flip {
      box-shadow: none !important;
      background: #fffcfb !important;
      border: 1px solid rgba(140, 84, 98, 0.16) !important;
    }
    .svc-row .pic, .svc-row.flip .pic {
      overflow: hidden !important;
      background: #f7e8ea !important;
    }
    .svc-row .ph {
      border-radius: 22px !important;
      background: #f7e8ea !important;
    }
    .ph span { box-shadow: none !important; }
    .btn { box-shadow: none !important; }
    /* O PDF é só catálogo: botão "Agendar" não entra na exportação. */
    .svc-row .btn, .svc-row.flip .btn { display: none !important; }

    /* Letra maior no PDF: o catálogo é lido no celular, onde a folha
       de 210mm deixa o texto pequeno demais. Só a tipografia muda. */
    .sname { font-size: 3.1rem !important; }
    .sprice { font-size: 2.3rem !important; }
    .sdur { font-size: 1.15rem !important; }
    .sdot { font-size: 1.3rem !important; }
    .sbadge { font-size: 0.95rem !important; }
    .ph span { font-size: 3.6rem !important; }
    .bio-title { font-size: 3rem !important; }
    .bio-role { font-size: 1rem !important; }
    .bio-text { font-size: 1.35rem !important; }
    footer .contact { font-size: 1.3rem !important; }
    .footer-legal { font-size: 1.1rem !important; }
    .enter { font-size: 1.2rem !important; }
  `;
  return style;
}

async function buildPdfCanvas() {
  const publicScreen = $("v-public");
  const page = document.querySelector(".wrap");
  if (!publicScreen || !page) throw new Error("Tela principal não encontrada.");
  if (!window.html2canvas) throw new Error("A biblioteca de PDF não foi carregada.");

  // Moldura com o fundo rosinha texturizado igual ao do site
  const shot = document.createElement("div");
  shot.style.cssText = `position:relative;width:${PDF_EXPORT_WIDTH}px;overflow:hidden;background:#fbf4f2;`;

  const bg = document.createElement("div");
  bg.style.cssText =
    "position:absolute;inset:0;opacity:0.3;" +
    "background-image:url('assets/nail-box-card.jpg');" +
    "background-repeat:repeat;background-size:240px 240px;";
  shot.appendChild(bg);

  const exportPage = page.cloneNode(true);
  const publicCopy = exportPage.querySelector("#v-public");
  exportPage.style.width = PDF_EXPORT_WIDTH + "px";
  exportPage.style.maxWidth = PDF_EXPORT_WIDTH + "px";
  exportPage.style.position = "relative";
  exportPage.style.zIndex = "1";
  exportPage.style.backgroundColor = "transparent";
  exportPage.style.backgroundImage = "none";

  for (const selector of ["#v-booking", "#v-login", "#v-admin", "#theme", "#gallery-section", ".hero-intro", "#client-corner"]) {
    exportPage.querySelectorAll(selector).forEach(el => el.remove());
  }
  if (publicCopy) publicCopy.hidden = false;
  exportPage.prepend(pdfExportStyles());

  // A animação da logo é um iframe e não sai na exportação (ficaria em branco):
  // no PDF entra a logo normal, em PNG.
  const logoBox = document.createElement("div");
  logoBox.style.cssText =
    "display:flex;justify-content:center;align-items:center;padding:16px 0 30px;";
  const logoImg = document.createElement("img");
  logoImg.src = "assets/logo-256.png";
  logoImg.alt = "Melry Beauty Studio";
  logoImg.style.cssText =
    "display:block;width:min(94%,440px);height:auto;border-radius:26px;background:#fbe1e2;";
  logoBox.appendChild(logoImg);
  exportPage.prepend(logoBox);

  shot.appendChild(exportPage);

  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;pointer-events:none;";
  stage.appendChild(shot);
  document.body.appendChild(stage);

  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const images = Array.from(shot.querySelectorAll("img"));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));

    return await window.html2canvas(shot, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: "#fbf4f2",
      width: PDF_EXPORT_WIDTH,
      windowWidth: 1280
    });
  } finally {
    stage.remove();
  }
}

// -------------------------------------------------------------
// BOTÃO DE EXPORTAR
// -------------------------------------------------------------
if ($("btn-export-pdf")) {
  $("btn-export-pdf").addEventListener("click", async () => {
    const btn = $("btn-export-pdf");
    const originalText = btn.textContent;

    btn.disabled = true;
    btn.textContent = "Gerando PDF da página principal...";

    try {
      if (!window.jspdf) throw new Error("A biblioteca de PDF não foi carregada.");

      const canvas = await buildPdfCanvas();
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
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}
