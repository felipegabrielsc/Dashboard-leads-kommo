# Leads do dia a dia

Dashboard para lançar, filtrar e acompanhar os leads da planilha `relatorio-leads.xlsx`. Os totais seguem a mesma conta da aba Dashboard: interessados, compras, sem retorno, perdidos, leads em análise e taxa de interesse.

O histórico da planilha entra no banco na primeira execução do SQL (23/06/2026 a 01/10/2026). Dali em diante cada dia novo é lançado na dashboard e salvo no Supabase.

## Quem vê e quem edita

Qualquer visitante vê o painel, os filtros e os lançamentos. Só uma conta logada pode adicionar, editar ou apagar. O telefone da lista em análise também fica só para quem entrou.

O painel compara o período escolhido com o intervalo anterior da mesma duração e aponta dias úteis sem lançamento. A aba Histórico mostra quem alterou cada célula, dia ou motivo.

Quem está logado também abre o botão Orçamentos: pesquisa caixas pela medida em milímetros ou centímetros, cadastra uma medida na mão e importa um txt com quantidade e valor unitário. O catálogo baixa em PDF já em centímetros, com os preços ou só com as medidas. Corte e vinco entra no mesmo painel e nos mesmos PDFs, numa seção separada das caixas comuns. O nome, o WhatsApp e a validade preenchidos no painel saem nos dois arquivos.

O histórico mostra o e-mail de quem alterou só para quem está logado. O visitante vê “equipe”.

Se o `schema.sql` antigo já foi executado, rode `supabase/leitura-publica.sql`, `supabase/historico-e-telefones.sql`, `supabase/orcamentos.sql`, `supabase/catalogo-identidade.sql` e `supabase/corte-vinco.sql` no SQL Editor.

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
4. Depois da primeira conta, desative novas inscrições em Authentication → Sign In / Providers. A consulta continua pública; a inscrição nova é que deixa de existir.
5. Em Authentication → URL Configuration, coloque o endereço local (`http://localhost:3000`) e, depois, o endereço da Vercel.

## Publicar na Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Adicione as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Confirme o deploy e inclua a URL publicada nas URLs permitidas do Supabase.

## Comercial Kommo

A rota `/kommo` é uma segunda dashboard. Ela lê negócios, funis e usuários da API do Kommo, guarda tudo em tabelas próprias e exige login. A tela de leads diários, os orçamentos e o histórico continuam como estão.

1. No Kommo, crie uma integração com token de longa duração e permissão para leads, funis e usuários. O subdomínio é o trecho antes de `.kommo.com`.
2. No SQL Editor do Supabase, execute `supabase/kommo.sql` depois do schema atual. Esse arquivo não altera as tabelas dos lançamentos.
3. Na Vercel, além das chaves públicas, preencha `KOMMO_SUBDOMAIN`, `KOMMO_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET`. Faça um novo deploy depois de salvar.
4. Entre no site, abra Comercial Kommo e, em Configurações, clique em Trazer histórico. A leitura diária das 8h (horário de São Paulo) só passa a valer depois dessa primeira importação e com a chave service role presente.
