import Link from "next/link";

export function MetricCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <article className={`panel h-full p-4 ${href ? "transition hover:border-ink/30" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className="mt-2 font-serif text-3xl leading-none">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-mute">{hint}</p> : null}
    </article>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  );
}
