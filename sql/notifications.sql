-- ==============================================================================
-- CONTROLE DE LEMBRETES ENVIADOS + LEMBRETES PUSH DO CLIENTE
-- Usado pelos robôs (GitHub Actions) para não repetir mensagens.
-- Rode este arquivo inteiro no SQL Editor do Supabase (pode rodar de novo).
-- ==============================================================================

-- 1) Estende os tipos de aviso aceitos (agora também para o cliente)
ALTER TABLE reminders_log DROP CONSTRAINT IF EXISTS reminders_log_kind_check;
ALTER TABLE reminders_log ADD CONSTRAINT reminders_log_kind_check
    CHECK (kind IN ('day', 'hour', 'client_booked', 'client_day', 'client_hour'));

-- 2) Tabela de inscrições push (navegador do cliente ↔ agendamento)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id    TEXT REFERENCES bookings(id) ON DELETE CASCADE,
    subscription  JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_booking_id ON push_subscriptions(booking_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- O site grava a inscrição (anon) e o bot lê e remove (anon) — mesmo padrão aberto
-- das demais tabelas deste projeto.
DROP POLICY IF EXISTS "Inscricao de push" ON push_subscriptions;
CREATE POLICY "Inscricao de push" ON push_subscriptions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura das inscricoes push" ON push_subscriptions;
CREATE POLICY "Leitura das inscricoes push" ON push_subscriptions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Remocao das inscricoes push" ON push_subscriptions;
CREATE POLICY "Remocao das inscricoes push" ON push_subscriptions
    FOR DELETE USING (true);

-- 3) Segurança do controle de duplicatas (igual à versão anterior, sem mudanças)
CREATE INDEX IF NOT EXISTS idx_reminders_log_sent_at ON reminders_log(sent_at);

ALTER TABLE reminders_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura dos lembretes enviados" ON reminders_log;
CREATE POLICY "Leitura dos lembretes enviados" ON reminders_log
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Registro de lembretes enviados" ON reminders_log;
CREATE POLICY "Registro de lembretes enviados" ON reminders_log
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Remocao de reservas de lembrete" ON reminders_log;
CREATE POLICY "Remocao de reservas de lembrete" ON reminders_log
    FOR DELETE USING (true);
