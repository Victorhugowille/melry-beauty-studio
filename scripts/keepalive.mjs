/**
 * SUPABASE KEEP-ALIVE
 * Faz uma consulta leve todos os dias para o projeto gratuito não ser
 * pausado por inatividade (o Supabase pausa após ~7 dias sem uso).
 */

import { loadConfig } from "./lib/config.mjs";
import { createSupabase } from "./lib/supabase.mjs";

async function main() {
  const config = loadConfig();
  const db = createSupabase(config);

  const startedAt = Date.now();
  const result = await db.ping();
  const elapsed = Date.now() - startedAt;

  if (!result.ok) {
    throw new Error(`Ping no Supabase falhou (HTTP ${result.status}).`);
  }

  console.log(`✅ Supabase ativo: ${config.url} respondeu em ${elapsed}ms.`);
}

main().catch((error) => {
  console.error("❌ " + error.message);
  process.exitCode = 1;
});
