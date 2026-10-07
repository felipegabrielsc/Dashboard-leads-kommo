# Leads do dia a dia

Dashboard para lançar, filtrar e acompanhar os leads da planilha `relatorio-leads.xlsx`. Os totais seguem a mesma conta da aba Dashboard: interessados, compras, sem retorno, perdidos, leads em análise e taxa de interesse.

O histórico da planilha entra no banco na primeira execução do SQL (23/06/2026 a 01/10/2026). Dali em diante cada dia novo é lançado na dashboard e salvo no Supabase.

## Entrar

A tela só abre com login. Quem entra vê e edita os mesmos lançamentos da empresa.

## Rodar localmente

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

Preencha `.env.local` com a URL e a chave anon do projeto.

## Ligar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra o SQL Editor e execute `supabase/schema.sql`.
3. Em Authentication → Users, crie o primeiro e-mail e senha. Desative "Confirm email" se quiser entrar sem esperar o e-mail.
4. Depois da primeira conta, desative novas inscrições em Authentication → Sign In / Providers. Isso impede que outra pessoa crie conta e veja os telefones.
5. Em Authentication → URL Configuration, coloque o endereço local (`http://localhost:3000`) e, depois, o endereço da Vercel.

## Publicar na Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Adicione as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Confirme o deploy e inclua a URL publicada nas URLs permitidas do Supabase.
