/**
 * EXPORTAÇÃO DA PÁGINA EM PDF
 * Gera o catálogo vertical com a página principal, carrossel e biografia.
 */

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
    const bodyStyle = getComputedStyle(document.body);
    const stage = document.createElement("div");
    stage.style.cssText = "position:fixed;left:-10000px;top:0;width:680px;z-index:-1;pointer-events:none;";
    exportPage.style.width = "680px";
    exportPage.style.maxWidth = "680px";
    exportPage.style.position = "relative";
    exportPage.style.backgroundColor = bodyStyle.backgroundColor;
    exportPage.style.backgroundImage = bodyStyle.backgroundImage;
    exportPage.style.backgroundSize = "cover";

    for (const selector of ["#v-booking", "#v-login", "#v-admin", "#theme", ".carousel-arrow", ".carousel-dots"]) {
      exportPage.querySelectorAll(selector).forEach(el => el.remove());
    }
    if (publicCopy) publicCopy.hidden = false;

    // Mantém no PDF apenas a foto atual do carrossel, sem controles.
    const exportTrack = exportPage.querySelector("#carousel-track");
    if (exportTrack) {
      Array.from(exportTrack.children).forEach((slide, i) => {
        if (i !== carouselIndex) slide.remove();
      });
      exportTrack.style.transition = "none";
      exportTrack.style.transform = "none";
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
