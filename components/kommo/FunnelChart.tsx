import { formatBrl, formatInt } from "@/lib/format";
import { kindLabel } from "@/lib/kommo/metrics";
import type { CommercialReport } from "@/lib/kommo/types";

export function FunnelChart({ funnels }: { funnels: CommercialReport["funnels"] }) {
  return (
    <article className="panel min-w-0 p-5">
      <h2 className="font-serif text-2xl">Etapas do funil</h2>
      <p className="mt-1 text-sm text-mute">
        Quantidade de negócios em cada etapa neste momento. O período escolhido não redistribui essas etapas.
      </p>
      <div className="mt-4 space-y-5">
        {funnels.length ? (
          funnels.map((funnel) => {
            const max = Math.max(1, ...funnel.stages.map((stage) => stage.count));
            return (
              <section key={funnel.pipelineId}>
                <h3 className="text-sm font-semibold">{funnel.pipelineName}</h3>
                <ul className="mt-2 space-y-2">
                  {funnel.stages.map((stage) => (
                    <li key={stage.statusId}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span>
                          {stage.name} <span className="text-mute">· {kindLabel(stage.kind)}</span>
                        </span>
                        <span>
                          {formatInt(stage.count)} · {formatBrl(stage.value)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-line">
                        <div
                          className="h-2 rounded-full bg-sea"
                          style={{ width: `${Math.max(stage.count ? 4 : 0, (stage.count / max) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        ) : (
          <p className="text-sm text-mute">As etapas aparecem depois da primeira importação.</p>
        )}
      </div>
    </article>
  );
}
