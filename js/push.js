/* =============================================================
   PUSH · LEMBRETES PARA O CLIENTE (grátis)
   Mostra, na tela de "Agendamento confirmado", a opção de receber
   a confirmação e os avisos (1 dia e 1 hora antes) no próprio
   aparelho — sem custo e sem cadastro.
   iPhone: precisa estar com a PWA instalada (Adicionar à Tela de
   Início) — Safari antigo não libera push para sites.
============================================================= */

(function () {
  var offer = $("push-offer");
  var btn = $("push-enable");
  var msg = $("push-msg");
  if (!offer || !btn || !msg) return;

  var supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!window.PUSH_VAPID_PUBLIC_KEY;

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  var lastBookingId = null;

  // Mostra o convite depois de um agendamento confirmado
  window.MelryPush = {
    offer: function (bookingId) {
      lastBookingId = bookingId || null;
      offer.hidden = false;

      if (!supported) {
        btn.hidden = true;
        msg.textContent = isIOS && !isStandalone
          ? "No iPhone: toque em Compartilhar → Adicionar à Tela de Início e abra o site pelo ícone para ativar os avisos."
          : "Este aparelho não aceita avisos push — os avisos da Maria continuam funcionando normalmente.";
        return;
      }

      if (Notification.permission === "granted" && localStorage.getItem("melry_push_sub_id")) {
        // Já ativado antes: apenas registra a associação com este agendamento
        msg.textContent = "Lembretes já ativados neste aparelho ✓";
      }
    }
  };

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    btn.textContent = "Ativando…";
    msg.textContent = "";

    try {
      await navigator.serviceWorker.register("sw.js", { scope: "./" });

      var permission = await Notification.requestPermission();
      if (permission !== "granted") {
        msg.textContent = "Permissão negada. Para receber os avisos, permita as notificações deste site.";
        return;
      }

      var registration = await navigator.serviceWorker.ready;
      var subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.PUSH_VAPID_PUBLIC_KEY)
      });

      var payload = subscription.toJSON();
      await window.db.savePushSubscription(payload, lastBookingId);
      localStorage.setItem("melry_push_sub_id", payload.endpoint || "1");

      btn.hidden = true;
      msg.textContent = "Lembretes ativados neste aparelho ✓ Você recebe a confirmação e os avisos de 1 dia e 1 hora antes.";
    } catch (e) {
      console.error("Falha ao ativar push:", e);
      msg.textContent = "Não foi possível ativar os avisos. Tente pelo Chrome (Android) ou pelo Safari com o site na Tela de Início (iPhone).";
    } finally {
      btn.disabled = false;
      btn.textContent = "Ativar lembretes neste aparelho";
    }
  });
})();
