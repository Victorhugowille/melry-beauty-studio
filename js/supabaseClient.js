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
    // GALERIA DO CARROSSEL
    // -------------------------------------------------------------
    async getGallery() {
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from("studio_gallery")
            .select("id, foto, legenda, ordem")
            .eq("ativo", true)
            .order("ordem", { ascending: true })
            .order("created_at", { ascending: true });

          if (!error && data) {
            // Envia para o Supabase fotos que existiam apenas neste dispositivo.
            const localList = localLoad(LOCAL_GALKEY, []);
            const localOnly = localList.filter(item => !data.some(row => row.id === item.id));

            if (localOnly.length) {
              try {
                const { error: upError } = await supabase
                  .from("studio_gallery")
                  .upsert(localOnly.map(item => ({
                    id: item.id,
                    foto: item.foto,
                    legenda: item.legenda || null,
                    ordem: item.ordem || 0,
                    ativo: true
                  })), { onConflict: "id" });

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
          const { error } = await supabase
            .from("studio_gallery")
            .upsert({
              id: photo.id,
              foto: photo.foto,
              legenda: photo.legenda || null,
              ordem: photo.ordem || 0,
              ativo: true
            }, { onConflict: "id" });

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
          const { error } = await supabase
            .from("studio_gallery")
            .delete()
            .eq("id", id);
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
          const { data, error } = await supabase
            .from("studio_bio")
            .select("nome, titulo, texto, foto, updated_at")
            .eq("id", "principal")
            .maybeSingle();

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
                const { error: upError } = await supabase
                  .from("studio_bio")
                  .upsert({ ...merged, id: "principal" }, { onConflict: "id" });
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
          const { error } = await supabase
            .from("studio_bio")
            .upsert(payload, { onConflict: "id" });
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
      const st = Number(status) || 0;

      if (isOnline) {
        try {
          const { error } = await supabase
            .from("availability")
            .upsert({ date, minute, status: st }, { onConflict: "date,minute" });
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
          const { error } = await supabase
            .from("availability")
            .upsert(records, { onConflict: "date,minute" });
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
