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
                    'client_email_booked', 'client_email_day', 'client_email_hour',
                    'studio_email_booked', 'studio_email_day', 'studio_email_hour'));

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

-- 5) CRON: chama a função de e-mails a cada 5 minutos (dentro do próprio Supabase)
--    ATENÇÃO: se você criar o secret CRON_SECRET na Edge Function, edite também
--    o headers abaixo ({"x-cron-secret":"MESMO_VALOR"}) — senão o cron será
--    rejeitado com 401 e os e-mails param de novo.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('melry-send-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'melry-send-reminders',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url := 'https://oahywgiwvrjpnqwuffem.supabase.co/functions/v1/send-reminders',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);

