export function SetupScreen() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">Kommo</p>
      <h1 className="mt-2 font-serif text-4xl">Ligue o Supabase para salvar</h1>
      <ol className="mt-6 space-y-3 text-sm leading-relaxed">
        <li>Crie um projeto em supabase.com.</li>
        <li>No SQL Editor, execute o arquivo supabase/schema.sql deste repositório. Ele cria as tabelas e traz a planilha.</li>
        <li>Em Authentication, crie o primeiro usuário. Pode desativar a confirmação de e-mail para entrar na hora.</li>
        <li>
          Copie a Project URL e a chave anon para <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, no arquivo .env.local e nas variáveis da Vercel.
        </li>
        <li>Em Authentication → URL Configuration, coloque o endereço do site publicado.</li>
        <li>Se o SQL antigo já rodou, execute também supabase/leitura-publica.sql para liberar a consulta sem login.</li>
      </ol>
    </main>
  );
}
