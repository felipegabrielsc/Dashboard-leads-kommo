"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { commercialSearch, localToday, monthStart } from "./query";

export function useCommercialQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const from = params.get("from") || monthStart();
  const to = params.get("to") || localToday();
  const pipeline = params.get("pipeline") || "";
  const user = params.get("user") || "";
  const q = params.get("q") || "";
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));

  useEffect(() => {
    if (params.get("from") && params.get("to")) return;
    const text = commercialSearch({ from, to, pipeline, user, q, page });
    router.replace(`${pathname}?${text}`);
  }, [from, page, params, pathname, pipeline, q, router, to, user]);

  function update(
    next: { from?: string; to?: string; pipeline?: string; user?: string; q?: string; page?: number },
    keepPage = false,
  ) {
    const text = commercialSearch({
      from: next.from ?? from,
      to: next.to ?? to,
      pipeline: next.pipeline === undefined ? pipeline : next.pipeline,
      user: next.user === undefined ? user : next.user,
      q: next.q === undefined ? q : next.q,
      page: keepPage ? (next.page ?? page) : next.page,
    });
    router.replace(`${pathname}?${text}`);
  }

  return {
    from,
    to,
    pipeline,
    user,
    q,
    page,
    update,
    query: commercialSearch({ from, to, pipeline, user }),
  };
}
