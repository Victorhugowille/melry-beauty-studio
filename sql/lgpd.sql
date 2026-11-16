-- =============================================================
-- LGPD · Registro do consentimento no agendamento
-- Rode este script no SQL Editor do Supabase (é seguro rodar de novo).
-- =============================================================

-- 1) Guarda data e hora do aceite da Política de Privacidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'consent_at'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN consent_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN public.bookings.consent_at IS
  'Data/hora do aceite da Política de Privacidade (LGPD) no formulário de agendamento';

CREATE INDEX IF NOT EXISTS idx_bookings_consent_at ON public.bookings (consent_at);

-- 2) Consulta rápida para atender pedidos do titular (art. 18 da LGPD)
--    Troque o e-mail/telefone pelos da cliente que fez o pedido.
--
-- SELECT id, name, phone, email, nome, date, start, preco, status, created_at, consent_at
--   FROM public.bookings
--  WHERE lower(email) = lower('cliente@email.com')
--     OR regexp_replace(phone, '\D', '', 'g') = '45999999999'
--  ORDER BY created_at DESC;

-- 3) Exclusão dos dados de uma cliente (quando não houver obrigação legal de guardar)
--
-- DELETE FROM public.bookings
--  WHERE lower(email) = lower('cliente@email.com');
