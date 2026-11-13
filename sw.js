/* =============================================================
   MELRY · SERVICE WORKER
   Recebe os lembretes do servidor (1 dia e 1 hora antes do
   atendimento) e mostra a notificação no aparelho do cliente,
   mesmo com o site fechado.
============================================================= */

self.addEventListener("push", (event) => {
  let data = {
    title: "Melry Beauty Studio",
    body: "Você tem uma novidade do seu atendimento.",
    icon: "assets/app-icon.png",
    url: "./"
  };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    // payload inválido: usa o padrão acima
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Melry Beauty Studio", {
      body: data.body || "",
      icon: data.icon || "assets/app-icon.png",
      badge: "assets/app-icon.png",
      vibrate: [120, 60, 120],
      tag: data.tag || undefined,
      data: { url: data.url || "./" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(self.clients.openWindow(target));
});
