-- ==============================================================================
-- LEMBRETES POR E-MAIL (Brevo) — MERLY BEAUTY STUDIO
-- Rode este arquivo inteiro no SQL Editor do Supabase. Pode rodar de novo.
-- ==============================================================================

-- 1) E-mail na tabela de agendamentos (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'email'
  ) THEN
    ALTER TABLE bookings ADD COLUMN email TEXT;
  END IF;
END $$;

-- 2) Controle de lembretes já enviados (cria só se não existir)
CREATE TABLE IF NOT EXISTS reminders_log (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id TEXT NOT NULL,
    kind       TEXT NOT NULL,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (booking_id, kind)
);

-- 3) Tipos de aviso aceitos
ALTER TABLE reminders_log DROP CONSTRAINT IF EXISTS reminders_log_kind_check;
ALTER TABLE reminders_log ADD CONSTRAINT reminders_log_kind_check
    CHECK (kind IN ('day', 'hour',
                    'client_email_booked', 'client_email_day', 'client_email_hour'));

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

-- 4) Push notifications: desativado (substituído pelos e-mails).
DROP TABLE IF EXISTS push_subscriptions;
