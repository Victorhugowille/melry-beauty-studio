-- ============================================================
-- MELry BEAUTY STUDIO — FEEDBACK DAS CLIENTES
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- É idempotente: pode rodar mais de uma vez sem duplicar dados.
-- ============================================================

-- 1) Tabela de feedbacks
create table if not exists public.feedbacks (
  id text primary key,
  nome text not null,
  email text not null,
  texto text not null default '',
  foto_perfil text,                -- data URL (opcional)
  fotos jsonb not null default '[]'::jsonb,  -- 1+ fotos (paths do site ou data URLs)
  servico text,                    -- serviço vinculado, extraído do agendamento
  booking_id text,                 -- id do agendamento que gerou o feedback
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.feedbacks enable row level security;

drop policy if exists feedbacks_select on public.feedbacks;
drop policy if exists feedbacks_insert on public.feedbacks;
drop policy if exists feedbacks_update on public.feedbacks;
drop policy if exists feedbacks_delete on public.feedbacks;

-- Mesmo padrão do resto do projeto (app estático com anon key).
create policy feedbacks_select on public.feedbacks for select using (true);
create policy feedbacks_insert on public.feedbacks for insert with check (true);
create policy feedbacks_update on public.feedbacks for update using (true);
create policy feedbacks_delete on public.feedbacks for delete using (true);

-- 2) Feedbacks DE TESTE (apague/edite no painel: Feedbacks → Remover)
insert into public.feedbacks (id, nome, email, texto, fotos, servico, ordem, ativo)
select * from (values
  ('f_teste_1', 'Ana Paula', 'ana.paula@example.com',
   'As unhas ficaram perfeitas e o atendimento é impecável. O ambiente é acolhedor e me senti em casa. Recomendo de olhos fechados!',
   '["assets/carrocel/03-unha-vermelha-luxo.jpg"]'::jsonb, 'Manicure & Pedicure', 0, true),
  ('f_teste_2', 'Juliana Mendes', 'ju.mendes@example.com',
   'A extensão de cílios mudou minha rotina de beleza. Acordo pronta e me sinto linda todos os dias. Gratidão, Maria Clara!',
   '["assets/carrocel/02-cilios-que-falam.jpg","assets/carrocel/11-beleza-natural.jpg"]'::jsonb, 'Extensão Fio a Fio', 1, true),
  ('f_teste_3', 'Fernanda Lima', 'fe.lima@example.com',
   'O design de sobrancelhas valorizou meu rosto de um jeito que eu não esperava. Profissional muito atenciosa e detalhista.',
   '["assets/carrocel/01-destaque-seu-olhar.jpg"]'::jsonb, 'Designer de Sobrancelhas', 2, true)
) as v(id, nome, email, texto, fotos, servico, ordem, ativo)
where not exists (select 1 from public.feedbacks where id = v.id);
