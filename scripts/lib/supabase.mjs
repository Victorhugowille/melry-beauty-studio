/**
 * CLIENTE SUPABASE (REST)
 * Só o necessário para os robôs: ler agendamentos confirmados e
 * registrar lembretes já enviados. Sem SDK, sem dependências.
 */

export function createSupabase({ url, anonKey }) {
  const base = `${url}/rest/v1`;

  async function request(pathname, { method = "GET", body, prefer } = {}) {
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json"
    };
    if (prefer) headers.Prefer = prefer;

    const response = await fetch(`${base}/${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return { ok: response.ok, status: response.status, data, text };
  }

  return {
    /** Agendamentos confirmados entre duas datas (inclusive). */
    async listConfirmedBookings(fromDate, toDate) {
      // PostgREST aceita "date" repetido para montar o intervalo.
      const path =
        `bookings?select=id,svc,nome,preco,date,start,dur,name,phone,status` +
        `&status=eq.confirmado&date=gte.${fromDate}&date=lte.${toDate}` +
        `&order=date.asc,start.asc&limit=200`;

      const res = await request(path);
      if (!res.ok) throw new Error(`Falha ao ler agendamentos (HTTP ${res.status}): ${res.text}`);
      return Array.isArray(res.data) ? res.data : [];
    },

    /**
     * Reserva o envio de um lembrete. Retorna:
     *  - "reserved": pode enviar agora (com `degraded: true` se a tabela não existe:
     *    envia mesmo assim, sem controle de duplicatas)
     *  - "duplicate": já foi enviado antes
     */
    async reserveReminder(bookingId, kind) {
      const res = await request("reminders_log", {
        method: "POST",
        body: [{ booking_id: bookingId, kind }],
        prefer: "return=minimal"
      });

      if (res.ok) return { status: "reserved" };
      if (res.status === 409) return { status: "duplicate" };

      if (res.status === 404 || /PGRST205|not find the table/i.test(res.text)) {
        // Sem a tabela não dá para evitar mensagens duplicadas, mas o robô
        // continua enviando — é melhor avisar do que ficar mudo.
        console.warn(
          "⚠️  Tabela reminders_log não existe. Enviando SEM controle de duplicatas. " +
            "Rode o arquivo sql/notifications.sql no SQL Editor do Supabase."
        );
        return { status: "reserved", degraded: true };
      }

      throw new Error(`Falha ao registrar lembrete (HTTP ${res.status}): ${res.text}`);
    },

    /** Libera a reserva quando o envio falha, para tentar de novo depois. */
    async releaseReminder(bookingId, kind) {
      const res = await request(
        `reminders_log?booking_id=eq.${encodeURIComponent(bookingId)}&kind=eq.${encodeURIComponent(kind)}`,
        { method: "DELETE", prefer: "return=minimal" }
      );
      if (!res.ok) {
        console.warn(`⚠️  Não foi possível liberar a reserva do lembrete (HTTP ${res.status}).`);
      }
    },

    /** Ping leve para manter o projeto ativo. */
    async ping() {
      const res = await request("services?select=id&limit=1");
      return { ok: res.ok, status: res.status };
    }
  };
}
