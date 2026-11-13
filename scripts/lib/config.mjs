/**
 * CONFIGURAÇÃO DOS ROBÔS (GitHub Actions)
 * Lê as credenciais do Supabase das variáveis de ambiente e, se elas não
 * existirem, cai para o js/config.js (que já é público no site).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readConfigFile() {
  try {
    const src = readFileSync(path.join(ROOT, "js", "config.js"), "utf8");
    return {
      url: src.match(/url:\s*["']([^"']+)["']/)?.[1] || "",
      anonKey: src.match(/anonKey:\s*["']([^"']+)["']/)?.[1] || ""
    };
  } catch {
    return { url: "", anonKey: "" };
  }
}

export function loadConfig() {
  const file = readConfigFile();

  const url = String(process.env.SUPABASE_URL || file.url || "")
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/+$/, "");

  const anonKey = String(process.env.SUPABASE_ANON_KEY || file.anonKey || "");

  if (!url || !anonKey) {
    throw new Error(
      "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY " +
        "nos secrets do GitHub ou preencha o js/config.js."
    );
  }

  return {
    url,
    anonKey,
    timezone: process.env.STUDIO_TIMEZONE || "America/Campo_Grande"
  };
}
