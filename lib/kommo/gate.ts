export function kommoGate(path: string, method: string, signedIn: boolean): "allow" | "login" | "unauthorized" {
  if (signedIn) return "allow";
  const clean = path.replace(/\/$/, "") || "/";
  const isPage = clean === "/kommo" || clean.startsWith("/kommo/");
  const isPublicPage = clean === "/kommo" || clean === "/kommo/vendas";
  const isApi = clean.startsWith("/api/kommo");
  const isPublicApi = method === "GET" && (clean === "/api/kommo/dashboard" || clean === "/api/kommo/vendas");
  const isCron = method === "GET" && clean === "/api/kommo/sync";
  if (isPage && !isPublicPage) return "login";
  if (isApi && !isCron && !isPublicApi) return "unauthorized";
  return "allow";
}
