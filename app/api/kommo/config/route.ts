import { commercialReader } from "@/lib/kommo/access";
import { kommoCredentials } from "@/lib/kommo/client";
import { explainKommoDb, kommoStore } from "@/lib/kommo/db";
import { privateJson } from "@/lib/kommo/http";
import { publicSync } from "@/lib/kommo/read";

export const dynamic = "force-dynamic";

export async function GET() {
  const reader = await commercialReader();
  if ("error" in reader) return privateJson({ error: reader.error }, reader.status);
  const credentials = kommoCredentials();
  if (!credentials) return privateJson({ configured: false, subdomain: "", sync: null, error: "" });
  try {
    const state = await kommoStore(reader.supabase).getState(credentials.subdomain);
    return privateJson({
      configured: true,
      subdomain: credentials.subdomain,
      sync: state ? publicSync(state) : null,
      error: "",
    });
  } catch (error) {
    return privateJson({
      configured: true,
      subdomain: credentials.subdomain,
      sync: null,
      error: explainKommoDb(error),
    });
  }
}
