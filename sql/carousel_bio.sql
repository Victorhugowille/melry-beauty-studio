-- ==============================================================================
-- MERLY BEAUTY STUDIO · CARROSSEL DE FOTOS + BIOGRAFIA
-- ==============================================================================
-- COMO USAR:
-- 1. Acesse https://supabase.com/dashboard e abra seu projeto.
-- 2. No menu lateral, clique em "SQL Editor".
-- 3. Clique em "+ New query".
-- 4. Cole TODO este arquivo e clique em "Run" (ou Ctrl + Enter).
-- 5. Volte ao site e recarregue a página.
--
-- Observação: as fotos são salvas em Base64 na coluna "foto", igual já acontece
-- com as fotos dos serviços. Recomendamos no máximo 8 fotos no carrossel.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GALERIA DO CARROSSEL
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studio_gallery (
    id TEXT PRIMARY KEY,
    foto TEXT NOT NULL,                         -- Imagem em Base64 (data:image/...) ou URL
    legenda TEXT,                               -- Texto opcional exibido sobre a foto
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_studio_gallery_ordem
    ON studio_gallery(ordem);

ALTER TABLE studio_gallery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Galeria publica para leitura" ON studio_gallery;
CREATE POLICY "Galeria publica para leitura" ON studio_gallery
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gerenciamento da galeria" ON studio_gallery;
CREATE POLICY "Gerenciamento da galeria" ON studio_gallery
    FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. BIOGRAFIA DA PROFISSIONAL (linha única)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studio_bio (
    id TEXT PRIMARY KEY DEFAULT 'principal',
    nome TEXT NOT NULL DEFAULT 'Maria Clara',
    titulo TEXT,
    texto TEXT,
    foto TEXT,                                  -- Foto de perfil em Base64 ou URL
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE studio_bio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Biografia publica para leitura" ON studio_bio;
CREATE POLICY "Biografia publica para leitura" ON studio_bio
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gerenciamento da biografia" ON studio_bio;
CREATE POLICY "Gerenciamento da biografia" ON studio_bio
    FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. BIOGRAFIA INICIAL
--    Só insere se ainda não existir. Não sobrescreve o que você já editou.
-- ------------------------------------------------------------------------------
INSERT INTO studio_bio (id, nome, titulo, texto, updated_at)
VALUES (
    'principal',
    'Maria Clara',
    'Especialista em Cílios, Sobrancelhas e Unhas',
    'Realçando sua beleza natural com atendimento exclusivo, biossegurança e técnicas modernas de alta durabilidade.',
    '2000-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. ATUALIZA O CACHE DE SCHEMA DO SUPABASE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- PRONTO! As tabelas "studio_gallery" e "studio_bio" foram criadas.
-- Agora você já pode adicionar fotos na aba "Galeria" da Área da Profissional.
-- ==============================================================================
