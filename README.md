# Leads do dia a dia

Dashboard para lançar, filtrar e acompanhar os leads que hoje estão na planilha `relatorio-leads.xlsx`. Os totais seguem a mesma conta da aba Dashboard: interessados, compras, sem retorno, perdidos, leads em análise e taxa de interesse.

O histórico da planilha já vem carregado (23/06/2026 a 01/10/2026). Dali em diante cada dia novo entra pela própria dashboard.

## O que dá para fazer

- Ver o painel com taxa de interesse, volume, motivos de perda, mês a mês e dia da semana.
- Filtrar por período, mês, dia da semana, conferência, divergência, grupo, motivo e telefone.
- Lançar um dia, editar as quantidades na grade e criar motivos novos.
- Marcar o dia como conferido (✅) ou com lead em análise (❌).
- Guardar telefone, data e descrição de quem ainda está em análise, com atalho para o WhatsApp.
- Importar de novo a planilha original, um Excel exportado daqui ou um backup JSON.
- Exportar Excel, JSON ou CSV do recorte filtrado.

## Onde os dados ficam

Os lançamentos ficam no navegador (localStorage). Publicar no Vercel não cria um banco compartilhado: cada computador guarda a própria cópia, começando pela planilha. Use **Exportar → Backup JSON** para levar os dados a outro lugar, e **Importar** para trazê-los de volta.

## Rodar localmente

```bash
npm install
npm test
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Publicar na Vercel

1. Envie este repositório para o GitHub.
2. Em [vercel.com/new](https://vercel.com/new), importe o projeto.
3. A Vercel detecta Next.js. Não precisa de variável de ambiente.
4. Confirme o deploy.

O build de produção também roda com `npm run build`.
