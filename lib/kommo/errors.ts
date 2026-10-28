export function describeError(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = typeof record.message === "string" ? record.message.trim() : "";
    const details = typeof record.details === "string" ? record.details.trim() : "";
    const hint = typeof record.hint === "string" ? record.hint.trim() : "";
    const code = typeof record.code === "string" ? record.code.trim() : "";
    const text = [message, details, hint].filter(Boolean).join(" ");
    if (text) return code ? `${text} (${code})` : text;
  }
  if (error instanceof Error && error.message) return error.message;
  return "A sincronização falhou.";
}

export function explainKommoDb(error: unknown): string {
  const text = describeError(error);
  if (/relation .* does not exist|schema cache|could not find the table|column .* does not exist/i.test(text)) {
    return "As tabelas do Comercial Kommo ainda não existem ou estão desatualizadas. Execute supabase/kommo.sql de novo no SQL Editor.";
  }
  if (/cannot affect row a second time|duplicate key/i.test(text)) {
    return "As etapas se repetem entre os funis. Execute supabase/kommo.sql de novo no SQL Editor e clique em Continuar.";
  }
  if (/row-level security|permission denied|42501/i.test(text)) {
    return "O Supabase recusou a gravação do comercial. Execute supabase/kommo.sql de novo no SQL Editor e confira a chave service role na Vercel.";
  }
  return text;
}
