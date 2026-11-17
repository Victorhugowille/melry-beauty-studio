/**
 * Cliente Supabase e Camada de Acesso a Dados (DAL)
 * Suporta Supabase com fallback seguro para LocalStorage caso as chaves ainda não tenham sido configuradas.
 */

(function () {
  const LOCAL_BKEY = "merly_studio_agendamentos";
  const LOCAL_SKEY = "merly_studio_servicos";
  const LOCAL_AKEY = "melry_disponibilidade";
  const LOCAL_GALKEY = "melry_studio_galeria";
  const LOCAL_BIOKEY = "melry_studio_bio";

  // Carrega configuração de js/config.js ou de override salvo no localStorage
  function getConfig() {
    let cfg = window.SUPABASE_CONFIG || {};
    try {
      const stored = localStorage.getItem("melry_supabase_custom_cfg");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) cfg = parsed;
      }
    } catch (e) {}
    // Limpeza de URL caso venha com /rest/v1 ou barra final
    if (cfg.url) {
      cfg.url = cfg.url.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
    }
    return cfg;
  }

  const cfg = getConfig();
  const isPlaceholder = !cfg.url || !cfg.anonKey ||
    cfg.url.includes("SEU_PROJETO") ||
    cfg.anonKey.includes("sua-chave-anon");

  let supabase = null;
  let isOnline = false;

  // Timeout por consulta: se o Supabase não responder (rede lenta ou
  // bloqueada), a consulta rejeita e o método cai para o cache local,
  // em vez de deixar a página presa esperando para sempre.
  const QUERY_TIMEOUT_MS = 8000;
  function q(promise) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tempo esgotado consultando o Supabase.")), QUERY_TIMEOUT_MS)
      )
    ]);
  }

  if (!isPlaceholder && window.supabase && typeof window.supabase.createClient === "function") {
    try {
      supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
      isOnline = true;
    } catch (err) {
      console.warn("Falha ao inicializar o Supabase SDK. Usando modo local:", err);
      isOnline = false;
    }
  }

  // Helpers de LocalStorage (fallback)
  function localLoad(k, fb) {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v == null ? fb : v;
    } catch (e) {
      return fb;
    }
  }
  function localSave(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Serviços Padrão (tabela de valores do estúdio)
  const defaultServices = [
    { id: "brow_design", nome: "Designer de Sobrancelhas", categoria: "sobrancelhas", preco: 35, dur: 30, foto: null },
    { id: "brow_henna", nome: "Designer com Henna", categoria: "sobrancelhas", preco: 40, dur: 60, foto: null },
    { id: "brow_tintura", nome: "Designer com Tintura", categoria: "sobrancelhas", preco: 40, dur: 60, foto: null },
    { id: "lash_classico", nome: "Extensão de Cílios", categoria: "cilios", preco: 150, dur: 150, foto: null },
    { id: "lash_russo", nome: "Extensão de Cílios Volume", categoria: "cilios", preco: 200, dur: 150, foto: null },
    { id: "lash_lifting", nome: "Lash Lifting", categoria: "cilios", preco: 90, dur: 60, foto: null },
    { id: "buco", nome: "Buço", categoria: "geral", preco: 5, dur: 10, foto: null },
    { id: "mani_tradicional", nome: "Manicure Tradicional", categoria: "manicure", preco: 30, dur: 60, foto: null },
    { id: "pedi_tradicional", nome: "Pedicure Tradicional", categoria: "manicure", preco: 40, dur: 60, foto: null }
  ];

  window.db = {
    isOnline: () => isOnline,
    hasValidConfig: () => !isPlaceholder,

    // -------------------------------------------------------------
    // SERVIÇOS
    // -------------------------------------------------------------
    async getServices() {
      if (isOnline) {
        try {
          const { data, error } = await q(supabase
            .from("services")
            .select("*")
            .eq("ativo", true)
            .order("ordem", { ascending: true })
            .order("created_at", { ascending: true }));

          if (!error && data && data.length) {
            localSave(LOCAL_SKEY, data);
            return data;
          }
          if (error) console.error("Erro ao carregar serviços do Supabase:", error);
        } catch (e) {
          console.error("Exceção ao consultar Supabase:", e);
        }
      }
      let list = localLoad(LOCAL_SKEY, null);
      if (!list || !list.length) {
        list = defaultServices;
        localSave(LOCAL_SKEY, list);
      }
      return list;
    },

    async saveService(service) {
      if (isOnline) {
        try {
          const { data, error } = await q(supabase
            .from("services")
            .upsert({
              id: service.id,
              nome: service.nome,
              categoria: service.categoria || "geral",
              preco: service.preco,
              dur: service.dur,
              foto: service.foto || null,
              ativo: true
            })
            .select());

          if (error) throw error;
        } catch (e) {
          console.error("Erro ao salvar serviço no Supabase:", e);
          throw e;
        }
      }
      // Atualiza também localmente
      let list = localLoad(LOCAL_SKEY, defaultServices);
      const idx = list.findIndex(s => s.id === service.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...service };
      else list.push(service);
      localSave(LOCAL_SKEY, list);
      return service;
    },

    async deleteService(id) {
      if (isOnline) {
        try {
          const { error } = await q(supabase
            .from("services")
            .update({ ativo: false })
            .eq("id", id));
          if (error) throw error;
        } catch (e) {
          console.error("Erro ao remover serviço no Supabase:", e);
          throw e;
        }
      }
      let list = localLoad(LOCAL_SKEY, defaultServices).filter(s => s.id !== id);
      localSave(LOCAL_SKEY, list);
      return true;
    },

    // -------------------------------------------------------------
    // GALERIA DO CARROSSEL
    // -------------------------------------------------------------
    async getGallery() {
      if (isOnline) {
        try {
          const { data, error } = await q(supabase
            .from("studio_gallery")
            .select("id, foto, legenda, ordem")
            .eq("ativo", true)
            .order("ordem", { ascending: true })
            .order("created_at", { ascending: true }));

          if (!error && data) {
            // Envia para o Supabase fotos que existiam apenas neste dispositivo.
            const localList = localLoad(LOCAL_GALKEY, []);
            const localOnly = localList.filter(item => !data.some(row => row.id === item.id));

            if (localOnly.length) {
              try {
                const { error: upError } = await q(supabase
                  .from("studio_gallery")
                  .upsert(localOnly.map(item => ({
                    id: item.id,
                    foto: item.foto,
                    legenda: item.legenda || null,
                    ordem: item.ordem || 0,
                    ativo: true
                  })), { onConflict: "id" }));

                if (upError) {
                  console.warn("Não foi possível sincronizar as fotos locais com o Supabase:", upError.message);
                }
              } catch (upException) {
                console.warn("Falha ao sincronizar fotos locais:", upException);
              }
            }

            const merged = [...data];
            localOnly.forEach(item => {
              if (!merged.some(row => row.id === item.id)) merged.push(item);
            });
            merged.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

            localSave(LOCAL_GALKEY, merged);
            return merged;
          }
          if (error) {
            console.warn("Galeria não encontrada no Supabase. Rode o arquivo sql/carousel_bio.sql no SQL Editor.", error.message);
          }
        } catch (e) {
          console.warn("Não foi possível carregar a galeria do Supabase:", e);
        }
      }
      return localLoad(LOCAL_GALKEY, []);
    },

    async saveGalleryPhoto(photo) {
      let synced = false;

      if (isOnline) {
        try {
          const { error } = await q(supabase
            .from("studio_gallery")
            .upsert({
              id: photo.id,
              foto: photo.foto,
              legenda: photo.legenda || null,
              ordem: photo.ordem || 0,
              ativo: true
            }, { onConflict: "id" }));

          if (error) throw error;
          synced = true;
        } catch (e) {
          console.warn("Foto salva apenas neste dispositivo. Rode o SQL da galeria no Supabase para sincronizar.", e.message || e);
        }
      }

      const list = localLoad(LOCAL_GALKEY, []);
      const idx = list.findIndex(g => g.id === photo.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...photo };
      else list.push(photo);
      localSave(LOCAL_GALKEY, list);

      return { item: photo, synced };
    },

    async deleteGalleryPhoto(id) {
      let synced = false;

      if (isOnline) {
        try {
          const { error } = await q(supabase
            .from("studio_gallery")
            .delete()
            .eq("id", id));
          if (error) throw error;
          synced = true;
        } catch (e) {
          console.warn("Não foi possível remover a foto do Supabase. Ela será removida apenas deste dispositivo.", e.message || e);
        }
      }

      const list = localLoad(LOCAL_GALKEY, []).filter(g => g.id !== id);
      localSave(LOCAL_GALKEY, list);

      return { synced };
    },

    // -------------------------------------------------------------
    // BIOGRAFIA DA PROFISSIONAL
    // -------------------------------------------------------------
    async getBio() {
      if (isOnline) {
        try {
          const { data, error } = await q(supabase
            .from("studio_bio")
            .select("nome, titulo, texto, foto, updated_at")
            .eq("id", "principal")
            .maybeSingle());

          if (!error && data) {
            const local = localLoad(LOCAL_BIOKEY, null);
            const remoteTs = Date.parse(data.updated_at) || 0;
            const localTs = local ? (Date.parse(local.updated_at) || 0) : 0;
            const legacyLocal = local && !local.updated_at;

            // Dados antigos salvos apenas no navegador têm prioridade até a
            // primeira sincronização, evitando perder o que já foi editado.
            const localWins = local && (localTs > remoteTs || (legacyLocal && remoteTs < Date.parse("2025-01-01")));

            if (localWins) {
              const merged = {
                ...data,
                ...local,
                updated_at: new Date().toISOString()
              };
              localSave(LOCAL_BIOKEY, merged);

              try {
                const { error: upError } = await q(supabase
                  .from("studio_bio")
                  .upsert({ ...merged, id: "principal" }, { onConflict: "id" }));
                if (upError) console.warn("Não foi possível sincronizar a biografia local:", upError.message);
              } catch (upException) {
                console.warn("Falha ao sincronizar a biografia local:", upException);
              }

              return merged;
            }

            localSave(LOCAL_BIOKEY, data);
            return data;
          }
          if (error) {
            console.warn("Biografia não encontrada no Supabase. Rode o arquivo sql/carousel_bio.sql no SQL Editor.", error.message);
          }
        } catch (e) {
          console.warn("Não foi possível carregar a biografia do Supabase:", e);
        }
      }
      return localLoad(LOCAL_BIOKEY, null);
    },

    async saveBio(bio) {
      const payload = {
        id: "principal",
        nome: bio.nome || "",
        titulo: bio.titulo || "",
        texto: bio.texto || "",
        foto: bio.foto || null,
        updated_at: new Date().toISOString()
      };
      let synced = false;

      if (isOnline) {
        try {
          const { error } = await q(supabase
            .from("studio_bio")
            .upsert(payload, { onConflict: "id" }));
          if (error) throw error;
          synced = true;
        } catch (e) {
          console.warn("Biografia salva apenas neste dispositivo. Rode o SQL da biografia no Supabase para sincronizar.", e.message || e);
        }
      }

      localSave(LOCAL_BIOKEY, payload);
      return { data: payload, synced };
    },

    // -------------------------------------------------------------
    // DISPONIBILIDADE
    // -------------------------------------------------------------
    async getAvailability() {
      if (isOnline) {
        try {
          const { data, error } = await q(supabase
            .from("availability")
            .select("date, minute, status"));

          if (!error && data) {
            const map = {};
            data.forEach(row => {
              if (!map[row.date]) map[row.date] = {};
              map[row.date][row.minute] = row.status;
            });
            localSave(LOCAL_AKEY, map);
            return map;
          }
        } catch (e) {
          console.error("Erro ao buscar disponibilidade no Supabase:", e);
        }
      }
      return localLoad(LOCAL_AKEY, {});
    },

    async setSlotStatus(date, minute, status) {
      const st = Number(status) || 0;

      if (isOnline) {
        try {
          const { error } = await q(supabase
            .from("availability")
            .upsert({ date, minute, status: st }, { onConflict: "date,minute" }));
          if (error) throw error;
        } catch (e) {
          console.error("Erro ao atualizar horário no Supabase:", e);
        }
      }

      const avail = localLoad(LOCAL_AKEY, {});
      avail[date] = avail[date] || {};
      // Guarda também o status 0 (fechado): assim a grade padrão não
      // reabre um horário que a profissional fechou de propósito.
      avail[date][minute] = st;
      localSave(LOCAL_AKEY, avail);
      return avail;
    },

    async saveDayStatuses(date, statuses) {
      const records = Object.keys(statuses).map(minute => ({
        date,
        minute: Number(minute),
        status: Number(statuses[minute]) || 0
      }));

      if (isOnline) {
        try {
          const { error } = await q(supabase
            .from("availability")
            .upsert(records, { onConflict: "date,minute" }));
          if (error) throw error;
        } catch (e) {
          console.error("Erro ao salvar a grade do dia no Supabase:", e);
        }
      }

      const avail = localLoad(LOCAL_AKEY, {});
      avail[date] = { ...(avail[date] || {}) };
      records.forEach(r => {
        avail[date][r.minute] = r.status;
      });
      localSave(LOCAL_AKEY, avail);
      return avail;
    },

    async clearDay(date) {
      const closed = {};
      for (let k = 0; k < 1440; k += 30) closed[k] = 0;
      return this.saveDayStatuses(date, closed);
    },

    // -------------------------------------------------------------
    // AGENDAMENTOS (BOOKINGS)
    // -------------------------------------------------------------
    async getBookings() {
      if (isOnline) {
        try {
          const { data, error } = await q(supabase
            .from("bookings")
            .select("*")
            .eq("status", "confirmado")
            .order("date", { ascending: true })
            .order("start", { ascending: true }));

          if (!error && data) {
            localSave(LOCAL_BKEY, data);
            return data;
          }
        } catch (e) {
          console.error("Erro ao buscar agendamentos no Supabase:", e);
        }
      }
      return localLoad(LOCAL_BKEY, []);
    },

    async createBooking(booking) {
      if (isOnline) {
        try {
          const payload = {
            id: booking.id,
            svc: booking.svc,
            nome: booking.nome,
            preco: booking.preco,
            date: booking.date,
            start: booking.start,
            dur: booking.dur,
            name: booking.name,
            phone: booking.phone,
            email: booking.email || null,
            consent_at: booking.consent_at || new Date().toISOString(),
            status: "confirmado"
          };

          let { error } = await q(supabase.from("bookings").insert(payload).select().single());

          // Se a coluna de consentimento ainda não existir no banco, salva sem ela.
          if (error && /consent_at/i.test(error.message || "")) {
            const { consent_at, ...legacy } = payload;
            ({ error } = await q(supabase.from("bookings").insert(legacy).select().single()));
            if (!error) console.warn("Coluna consent_at ausente: rode o sql/lgpd.sql no Supabase.");
          }

          if (error) throw error;
        } catch (e) {
          console.error("Erro ao salvar agendamento no Supabase:", e);
          throw e;
        }
      }
      const list = localLoad(LOCAL_BKEY, []);
      list.push(booking);
      localSave(LOCAL_BKEY, list);
      return booking;
    },

    async cancelBooking(id) {
      if (isOnline) {
        try {
          const { error } = await q(supabase
            .from("bookings")
            .update({ status: "cancelado" })
            .eq("id", id));
          if (error) throw error;
        } catch (e) {
          console.error("Erro ao cancelar agendamento no Supabase:", e);
          throw e;
        }
      }
      let list = localLoad(LOCAL_BKEY, []);
      list = list.filter(b => b.id !== id);
      localSave(LOCAL_BKEY, list);
      return true;
    },

    // -------------------------------------------------------------
    // FEEDBACKS DAS CLIENTES
    // -------------------------------------------------------------
    async getFeedbacks() {
      if (isOnline) {
        try {
          const { data, error } = await q(supabase
            .from("feedbacks")
            .select("id,nome,email,texto,foto_perfil,fotos,servico,booking_id,created_at")
            .eq("ativo", true)
            .order("ordem", { ascending: true })
            .order("created_at", { ascending: true }));
          if (!error && data) return data;
          if (error) console.error("Erro ao carregar feedbacks:", error);
        } catch (e) {
          console.error("Exceção ao carregar feedbacks:", e);
        }
      }
      return [];
    },

    async saveFeedback(fb) {
      if (!isOnline) return { ok: false, reason: "offline" };
      try {
        const { error } = await q(supabase.from("feedbacks").insert(fb));
        if (error) throw error;
        return { ok: true };
      } catch (e) {
        console.error("Erro ao salvar feedback:", e);
        return { ok: false };
      }
    },

    async deleteFeedback(id) {
      if (!isOnline) return;
      const { error } = await q(supabase.from("feedbacks").delete().eq("id", id));
      if (error) console.error("Erro ao remover feedback:", error);
    },

    // -------------------------------------------------------------
    // MINHAS AGENDAS (cliente busca e troca o próprio horário)
    // -------------------------------------------------------------
    async getMyBookings(email) {
      const now = new Date();
      const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
      if (isOnline) {
        try {
          const { data, error } = await q(supabase
            .from("bookings")
            .select("id,svc,nome,preco,date,start,dur,name,phone,email,status")
            .ilike("email", email)
            .eq("status", "confirmado")
            .gte("date", today)
            .order("date", { ascending: true })
            .order("start", { ascending: true })
            .limit(20));
          if (!error && data) return data;
          if (error) console.error("Erro ao buscar Meus Agendamentos:", error);
        } catch (e) {
          console.error("Exceção ao buscar Meus Agendamentos:", e);
        }
      }
      return [];
    },

    async rescheduleBooking(id, email, date, start) {
      if (isOnline) {
        try {
          const { data, error } = await q(supabase
            .from("bookings")
            .update({ date, start })
            .eq("id", id)
            .ilike("email", email)
            .select());
          if (error) throw error;
          if (!data || !data.length) return { ok: false, reason: "not-found" };
          return { ok: true, booking: data[0] };
        } catch (e) {
          console.error("Erro ao trocar horário:", e);
          return { ok: false, reason: "error" };
        }
      }
      return { ok: false, reason: "offline" };
    },

    // Enfileira e-mails relacionados ao agendamento: troca de horário e
    // cancelamento (com justificativa). A Edge Function (cron de 1 minuto)
    // envia em até 1 minuto e marca como enviado.
    async queueRescheduleEmails(rows) {
      if (!isOnline || !rows || !rows.length) return false;
      try {
        await q(supabase.from("email_outbox").insert(rows));
        return true;
      } catch (e) {
        console.warn("Não foi possível agendar os e-mails de alteração:", e);
        return false;
      }
    },

  };
})();

