-- ==============================================================================
-- FILA DE E-MAIS (email_outbox) — MINHAS AGENDAS
-- Quando a cliente troca o horário no site, o aviso por e-mail fica aqui e a
-- Edge Function send-reminders (cron a cada 5 min) envia e marca como enviado.
-- Rode este arquivo inteiro no SQL Editor do Supabase. Pode rodar de novo.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.email_outbox (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    to_email   TEXT NOT NULL,
    params     JSONB NOT NULL,           -- variaveis do template do EmailJS
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    sent_at    TIMESTAMPTZ,
    error      TEXT
);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- O site (anon) só pode ENFILEIRAR avisos; ler/marcar enviado e papel da
-- Edge Function, que roda com service_role e ignora a RLS.
DROP POLICY IF EXISTS "Site pode enfileirar e-mails" ON email_outbox;
CREATE POLICY "Site pode enfileirar e-mails" ON email_outbox
    FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_outbox_unsent ON email_outbox(sent_at) WHERE sent_at IS NULL;
