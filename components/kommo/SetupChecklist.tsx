export function SetupChecklist({ message }: { message?: string }) {
  const steps = [
    "No Kommo, abra Configurações, Integrações e crie uma integração com token de longa duração. Marque permissão para leads, funis e usuários.",
    "Copie o subdomínio, o trecho antes de .kommo.com.",
    "No Supabase, abra o SQL Editor e execute o arquivo supabase/kommo.sql. Ele cria tabelas novas e não altera os lançamentos.",
    "Na Vercel e no .env.local, preencha KOMMO_SUBDOMAIN, KOMMO_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY e CRON_SECRET. Essas chaves ficam só no servidor.",
    "Entre na conta, abra Configurações e clique em Trazer histórico. Espere a mensagem de conclusão.",
  ];
  return (
    <section className="panel p-5">
      <h2 className="font-serif text-2xl">Para ligar o Kommo</h2>
      {message ? <p className="mt-2 text-sm text-wine">{message}</p> : null}
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-ink">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
