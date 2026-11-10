/**
 * Cliente Supabase e Camada de Acesso a Dados (DAL)
 * Suporta Supabase com fallback seguro para LocalStorage caso as chaves ainda não tenham sido configuradas.
 */

(function () {
  const LOCAL_BKEY = "merly_studio_agendamentos";
  const LOCAL_SKEY = "merly_studio_servicos";
  const LOCAL_AKEY = "melry_disponibilidade";

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

  // Serviços Padrão (Manicure, Sobrancelha, Cílios)
  const defaultServices = [
    { id: "lash_classico", nome: "Extensão Fio a Fio Clássico", categoria: "cilios", preco: 120, dur: 90, foto: null },
    { id: "lash_russo", nome: "Volume Russo Glamour", categoria: "cilios", preco: 160, dur: 120, foto: null },
    { id: "lash_lifting", nome: "Lash Lifting & Nutrição", categoria: "cilios", preco: 90, dur: 60, foto: null },
    { id: "brow_design", nome: "Design de Sobrancelhas", categoria: "sobrancelhas", preco: 35, dur: 30, foto: null },
    { id: "brow_henna", nome: "Design com Henna", categoria: "sobrancelhas", preco: 50, dur: 45, foto: null },
    { id: "brow_lamination", nome: "Brow Lamination", categoria: "sobrancelhas", preco: 110, dur: 60, foto: null },
    { id: "mani_tradicional", nome: "Manicure Tradicional Completa", categoria: "manicure", preco: 40, dur: 45, foto: null },
    { id: "mani_gel", nome: "Esmaltação em Gel", categoria: "manicure", preco: 70, dur: 60, foto: null },
    { id: "mani_alongamento", nome: "Alongamento em Fibra de Vidro", categoria: "manicure", preco: 140, dur: 120, foto: null },
    { id: "pedi_spa", nome: "Spa dos Pés & Pedicure", categoria: "manicure", preco: 55, dur: 50, foto: null }
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
          const { data, error } = await supabase
            .from("services")
            .select("*")
            .eq("ativo", true)
            .order("ordem", { ascending: true })
            .order("created_at", { ascending: true });

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
          const { data, error } = await supabase
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
            .select();

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
          const { error } = await supabase
            .from("services")
            .update({ ativo: false })
            .eq("id", id);
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
    // DISPONIBILIDADE
    // -------------------------------------------------------------
    async getAvailability() {
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from("availability")
            .select("date, minute, status");

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
      if (isOnline) {
        try {
          if (status === 0) {
            await supabase
              .from("availability")
              .delete()
              .eq("date", date)
              .eq("minute", minute);
          } else {
            await supabase
              .from("availability")
              .upsert({ date, minute, status }, { onConflict: "date,minute" });
          }
        } catch (e) {
          console.error("Erro ao atualizar slot no Supabase:", e);
        }
      }
      const avail = localLoad(LOCAL_AKEY, {});
      avail[date] = avail[date] || {};
      if (status) avail[date][minute] = status;
      else delete avail[date][minute];
      if (!Object.keys(avail[date]).length) delete avail[date];
      localSave(LOCAL_AKEY, avail);
      return avail;
    },

    async batchOpenDay(date, startMin, endMin) {
      const records = [];
      for (let k = startMin; k < endMin; k += 30) {
        records.push({ date, minute: k, status: 1 });
      }

      if (isOnline) {
        try {
          await supabase
            .from("availability")
            .upsert(records, { onConflict: "date,minute" });
        } catch (e) {
          console.error("Erro ao abrir horários em lote no Supabase:", e);
        }
      }
      const avail = localLoad(LOCAL_AKEY, {});
      avail[date] = avail[date] || {};
      records.forEach(r => {
        if (!avail[date][r.minute]) avail[date][r.minute] = 1;
      });
      localSave(LOCAL_AKEY, avail);
      return avail;
    },

    async clearDay(date) {
      if (isOnline) {
        try {
          await supabase.from("availability").delete().eq("date", date);
        } catch (e) {
          console.error("Erro ao limpar dia no Supabase:", e);
        }
      }
      const avail = localLoad(LOCAL_AKEY, {});
      delete avail[date];
      localSave(LOCAL_AKEY, avail);
      return avail;
    },

    // -------------------------------------------------------------
    // AGENDAMENTOS (BOOKINGS)
    // -------------------------------------------------------------
    async getBookings() {
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from("bookings")
            .select("*")
            .eq("status", "confirmado")
            .order("date", { ascending: true })
            .order("start", { ascending: true });

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
          const { data, error } = await supabase
            .from("bookings")
            .insert({
              id: booking.id,
              svc: booking.svc,
              nome: booking.nome,
              preco: booking.preco,
              date: booking.date,
              start: booking.start,
              dur: booking.dur,
              name: booking.name,
              phone: booking.phone,
              status: "confirmado"
            })
            .select()
            .single();

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
          const { error } = await supabase
            .from("bookings")
            .update({ status: "cancelado" })
            .eq("id", id);
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
    }
  };
})();
