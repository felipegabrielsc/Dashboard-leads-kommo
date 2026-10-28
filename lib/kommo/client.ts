import { classifyStatuses, type StatusInput } from "./classify";
import type { StatusKind } from "./types";

export type KommoCredentials = {
  subdomain: string;
  token: string;
};

export class KommoApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function kommoCredentials(): KommoCredentials | null {
  const raw = process.env.KOMMO_SUBDOMAIN?.trim().toLowerCase() || "";
  const subdomain = raw
    .replace(/^https?:\/\//, "")
    .replace(/\.kommo\.com\/?.*$/, "")
    .replace(/\/.*$/, "");
  const token = process.env.KOMMO_ACCESS_TOKEN?.trim() || "";
  if (!subdomain || !/^[a-z0-9-]+$/.test(subdomain) || !token) return null;
  return { subdomain, token };
}

export function kommoOrigin(subdomain: string): string {
  return `https://${subdomain}.kommo.com`;
}

export function leadsUrl(subdomain: string, options?: { updatedFrom?: number | null; deleted?: boolean }): string {
  const url = new URL("/api/v4/leads", kommoOrigin(subdomain));
  url.searchParams.set("limit", "250");
  url.searchParams.set("page", "1");
  if (options?.deleted) url.searchParams.set("with", "only_deleted");
  if (options?.updatedFrom) url.searchParams.set("filter[updated_at][from]", String(options.updatedFrom));
  return url.toString();
}

export function readPage<T>(body: unknown, key: string): { items: T[]; next: string | null } {
  if (!body || typeof body !== "object") return { items: [], next: null };
  const record = body as {
    _embedded?: Record<string, T[]>;
    _links?: { next?: { href?: string } };
  };
  const items = record._embedded?.[key];
  const href = record._links?.next?.href || "";
  return { items: Array.isArray(items) ? items : [], next: href || null };
}

export function absoluteKommoUrl(subdomain: string, href: string): string {
  if (!href) return "";
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  return new URL(href, kommoOrigin(subdomain)).toString();
}

export function safeKommoApiUrl(subdomain: string, href: string): string {
  if (!href) return "";
  const absolute = absoluteKommoUrl(subdomain, href);
  const url = new URL(absolute);
  const host = `${subdomain}.kommo.com`;
  if (url.protocol !== "https:" || url.hostname !== host || !url.pathname.startsWith("/api/v4/")) {
    throw new KommoApiError("A importação só continua em endereços da API do Kommo.", 0);
  }
  return url.toString();
}

function problemMessage(status: number, body: unknown): string {
  if (status === 401) return "O Kommo recusou o token. Gere outro token de longa duração com acesso a leads, funis e usuários.";
  if (status === 403) return "O token não tem permissão para ler leads, funis ou usuários.";
  if (status === 429) return "O Kommo limitou as consultas. A importação continua de onde parou.";
  const detail =
    body && typeof body === "object" && "detail" in body ? String((body as { detail: unknown }).detail) : "";
  return detail ? `O Kommo respondeu ${status}: ${detail.slice(0, 180)}` : `O Kommo respondeu ${status}.`;
}

export async function kommoJson(
  credentials: KommoCredentials,
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; body: unknown }> {
  safeKommoApiUrl(credentials.subdomain, url);
  let lastError: KommoApiError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      lastError = new KommoApiError("Não consegui falar com o Kommo. Tente de novo em instantes.", 0);
      await delay(200 * (attempt + 1));
      continue;
    }
    if (response.status === 204) return { status: 204, body: null };
    const text = await response.text();
    const body = text ? safeJson(text) : null;
    if (response.ok) return { status: response.status, body };
    lastError = new KommoApiError(problemMessage(response.status, body), response.status);
    if (response.status !== 429 && response.status < 500) throw lastError;
    await delay(500 * (attempt + 1));
  }
  throw lastError || new KommoApiError("Não consegui falar com o Kommo.", 0);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RawStatus = {
  id?: number;
  name?: string;
  sort?: number;
  type?: number;
  is_editable?: boolean;
  pipeline_id?: number;
  color?: string;
};

export type RawPipeline = {
  id?: number;
  name?: string;
  sort?: number;
  is_main?: boolean;
  is_archive?: boolean;
  _embedded?: { statuses?: RawStatus[] };
};

export type RawUser = { id?: number; name?: string; email?: string; rights?: { is_active?: boolean } };

export type RawLead = {
  id?: number;
  name?: string;
  price?: number;
  pipeline_id?: number;
  status_id?: number;
  responsible_user_id?: number;
  created_at?: number;
  updated_at?: number;
  closed_at?: number;
  is_deleted?: boolean;
};

export function unixToIso(value: unknown): string | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return new Date(number * 1000).toISOString();
}

export function statusMap(pipelines: RawPipeline[]): Map<string, StatusKind> {
  const map = new Map<string, StatusKind>();
  for (const pipeline of pipelines) {
    const inputs: StatusInput[] = (pipeline._embedded?.statuses || []).flatMap((status) => {
      const id = Number(status.id);
      if (!id) return [];
      return [
        {
          id,
          name: status.name || "",
          sort: Number(status.sort) || 0,
          type: Number(status.type) || 0,
          isEditable: Boolean(status.is_editable),
        },
      ];
    });
    const kinds = classifyStatuses(inputs);
    for (const [id, kind] of kinds) map.set(`${pipeline.id}:${id}`, kind);
  }
  return map;
}

export function leadUrl(subdomain: string, id: number): string {
  return `${kommoOrigin(subdomain)}/leads/detail/${id}`;
}
