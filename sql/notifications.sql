-- ==============================================================================
-- CONTROLE DE LEMBRETES ENVIADOS
-- Usado pelo bot (GitHub Actions) para não repetir a mesma mensagem no WhatsApp.
-- Rode este arquivo no SQL Editor do Supabase antes de ativar o bot.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS reminders_log (
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('day', 'hour')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (booking_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_reminders_log_sent_at ON reminders_log(sent_at);

ALTER TABLE reminders_log ENABLE ROW LEVEL SECURITY;

-- O bot usa a chave anon (a mesma do site), então as políticas são abertas,
-- seguindo o padrão já usado nas demais tabelas deste projeto.
DROP POLICY IF EXISTS "Leitura dos lembretes enviados" ON reminders_log;
CREATE POLICY "Leitura dos lembretes enviados" ON reminders_log
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Registro de lembretes enviados" ON reminders_log;
CREATE POLICY "Registro de lembretes enviados" ON reminders_log
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Remocao de reservas de lembrete" ON reminders_log;
CREATE POLICY "Remocao de reservas de lembrete" ON reminders_log
    FOR DELETE USING (true);
