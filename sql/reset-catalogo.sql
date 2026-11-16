-- ==============================================================================
-- RESET DE PEDIDOS E CATÁLOGO — MERLY BEAUTY STUDIO
-- O que este script faz:
--   1) APAGA todos os agendamentos já feitos (e o histórico de lembretes).
--   2) Aplica a NOVA TABELA DE VALORES (nomes, preços e durações).
--   3) Desativa os serviços que saíram da tabela (não apaga — ficam no banco
--      com ativo = false, então podem ser reativados depois se quiser).
--
-- Rode no SQL Editor do Supabase. É SEGURO rodar quantas vezes quiser.
-- ==============================================================================

-- 1) APAGAR TODOS OS PEDIDOS JÁ FEITOS -----------------------------------
DELETE FROM public.reminders_log;  -- lembretes de e-mail/WhatsApp enviados
DELETE FROM public.bookings;       -- todos os agendamentos (pedidos)

-- 2) NOVO CATÁLOGO (preços e durações da tabela do estúdio) ---------------
-- Obs.: as fotos já cadastradas dos serviços mantidos são preservadas.
INSERT INTO public.services (id, nome, categoria, preco, dur, foto, ativo, ordem) VALUES
  ('brow_design',      'Designer de Sobrancelhas',  'sobrancelhas', 35.00,  30,  null, true, 1),
  ('brow_henna',       'Designer com Henna',        'sobrancelhas', 40.00,  60,  null, true, 2),
  ('brow_tintura',     'Designer com Tintura',      'sobrancelhas', 40.00,  60,  null, true, 3),
  ('lash_classico',    'Extensão de Cílios',        'cilios',       150.00, 150, null, true, 4),
  ('lash_russo',       'Extensão de Cílios Volume', 'cilios',       200.00, 150, null, true, 5),
  ('lash_lifting',     'Lash Lifting',              'cilios',        90.00,  60,  null, true, 6),
  ('buco',             'Buço',                      'geral',          5.00,  10,  null, true, 7),
  ('mani_tradicional', 'Manicure Tradicional',      'manicure',      30.00,  60,  null, true, 8),
  ('pedi_tradicional', 'Pedicure Tradicional',      'manicure',      40.00,  60,  null, true, 9)
ON CONFLICT (id) DO UPDATE SET
  nome      = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  preco     = EXCLUDED.preco,
  dur       = EXCLUDED.dur,
  ativo     = true,
  ordem     = EXCLUDED.ordem;

-- 3) SERVIÇOS QUE SAÍRAM DA TABELA (inativos, não apagados) ---------------
UPDATE public.services SET ativo = false WHERE id IN (
  'brow_lamination',   -- Brow Lamination (removido do catálogo)
  'mani_gel',          -- Esmaltação em Gel (removido do catálogo)
  'mani_alongamento',  -- Alongamento em Fibra de Vidro (removido do catálogo)
  'pedi_spa'           -- Spa dos Pés & Pedicure (removido do catálogo)
);
