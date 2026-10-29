type PostgrestLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function fields(error: unknown): PostgrestLike {
  if (!error || typeof error !== "object") return { message: typeof error === "string" ? error : "" };
  const row = error as PostgrestLike;
  return {
    code: row.code,
    message: row.message,
    details: row.details,
    hint: row.hint,
  };
}

export function errorText(error: unknown): string {
  const row = fields(error);
  return [row.message, row.details, row.hint, row.code].filter(Boolean).join(" ");
}

export function rpcMissing(error: unknown): boolean {
  const row = fields(error);
  const text = errorText(error).toLowerCase();
  return row.code === "PGRST202" || row.code === "42883" || (text.includes("function") && (text.includes("schema cache") || text.includes("does not exist") || text.includes("could not find")));
}

export function relationMissing(error: unknown): boolean {
  const row = fields(error);
  const text = errorText(error).toLowerCase();
  return (
    row.code === "42P01" ||
    row.code === "PGRST205" ||
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    (text.includes("schema cache") && (text.includes("v4_") || text.includes("relation")))
  );
}
