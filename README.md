# Nexus Finance

Aplicação de gestão financeira pessoal em React, TypeScript e Vite. Sem configuração do Supabase, contas e lançamentos ficam no `localStorage` do navegador atual. Com Supabase configurado, o app oferece cadastro/login por e-mail e senha e sincroniza o documento financeiro da conta autenticada.

## Executar

```bash
npm install
npm run dev
```

Para validar e gerar a versão de produção:

```bash
npm run lint
npm run build
```

## Publicar gratuitamente no GitHub Pages

O workflow [`deploy-pages.yml`](./.github/workflows/deploy-pages.yml) publica o app automaticamente em `https://esleycontapessoal-afk.github.io/NEXUSFINANCE2/` a cada push para `main`.

1. No GitHub, abra **Settings → Pages** do repositório e selecione **GitHub Actions** como origem de publicação.
2. Em **Settings → Secrets and variables → Actions → Variables**, crie:
   - `VITE_SUPABASE_URL`: URL do projeto Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: chave publishable pública do Supabase.
3. Em **Settings → Actions → General → Workflow permissions**, permita que workflows façam deploy para GitHub Pages, caso o repositório solicite.
4. Após o primeiro push para `main`, acompanhe a execução em **Actions**. O endereço Pages aparecerá no workflow quando concluir.
5. No Supabase, em **Authentication → URL Configuration**, inclua o endereço do GitHub Pages na lista de URLs permitidas e ajuste o **Site URL** para esse endereço.

Somente a URL e a chave publishable são incluídas no build público. Não adicione `.env.local`, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` ou qualquer segredo do servidor ao GitHub.

## Ativar armazenamento em nuvem com Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. No **SQL Editor**, execute o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql). A tabela usa Row Level Security (RLS) para permitir acesso apenas ao usuário autenticado proprietário da linha.
3. Copie `.env.example` para `.env.local` e informe a URL do projeto e a chave **publishable** (ou a chave pública `anon`) do Supabase:

   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
   ```

4. Reinicie o servidor de desenvolvimento (`npm run dev`). Em produção, configure as mesmas variáveis no provedor de hospedagem e gere novamente o build.
5. Crie uma conta no Nexus Finance. Se houver dados antigos neste navegador, o app perguntará se deseja migrá-los para a conta ou iniciar com uma conta vazia.

Nunca use a chave `service_role` ou outra chave secreta em variáveis `VITE_*`; essas variáveis são incorporadas ao JavaScript público do site. Configure a confirmação de e-mail e as regras de senha em **Authentication → Providers** no painel Supabase. O cache local, quando usado para recuperação offline, é separado por usuário; a nuvem permanece como fonte de dados compartilhados.

### Painel administrativo e presença

Para habilitar o painel **Administração**:

1. Execute novamente [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor do projeto.
2. No Supabase, configure os secrets `ADMIN_USERNAME` e `ADMIN_PASSWORD` para a Edge Function `admin-monitoring`. Use o usuário administrativo desejado e uma senha nova, forte e privada, com pelo menos 12 caracteres. Não reutilize a senha anteriormente compartilhada na conversa.
3. Com o Supabase CLI instalado e vinculado ao projeto correto, publique a função:

```bash
supabase functions deploy admin-monitoring
```

Nunca configure credenciais administrativas em variáveis `VITE_*`. A função usa a chave `service_role` somente no ambiente seguro do Supabase; ela nunca é enviada ao navegador. A sessão administrativa dura duas horas e tentativas incorretas são limitadas.

Com o monitoramento ativo, o painel mostra e-mails de contas que já acessaram o site desde a ativação, o último login registrado e a atividade dos últimos dois minutos. A lista não recupera acessos anteriores nem apresenta um histórico completo de logins. A presença é atualizada enquanto o site está visível e recebe interação. O formulário de acesso informa aos usuários quais dados de atividade são registrados; senhas dos usuários nunca são coletadas nem mostradas.

## Recursos desta versão

- Dashboard com saldo das contas, receitas e despesas do mês, economia e distribuição de gastos.
- Cadastro, edição, busca, filtro e exclusão de lançamentos.
- Cadastro de contas com saldo inicial e saldo atualizado pelos lançamentos associados.
- Calendário mensal interativo para consultar lançamentos por dia, navegar entre meses e adicionar, editar ou excluir receitas, despesas e compromissos.
- Compromissos próprios para contas a pagar/receber, faturas, parcelas, investimentos e lembretes, com valor estimado opcional e marcação de conclusão.
- Cadastro local de dívidas e empréstimos de valor único ou parcelados, além de dívidas em atraso com vencimento original, pagamentos parciais, histórico e filtros por status, tipo e saldo.
- Indicadores de parcelas em aberto, quitadas, atrasadas e vencendo em até 7 dias; lembretes locais configuráveis aparecem no dashboard conforme o vencimento.
- Campos informativos para valor efetivamente recebido, taxa anual e CET em empréstimos; esses dados não recalculam o contrato.
- Aba **MEUS OBJETIVOS** com cofrinhos personalizados, metas, depósitos e retiradas vinculados como transferências internas, histórico, gráficos, simulação de rendimento, conquistas, filtros e depósitos recorrentes locais.
- Cadastro de dívidas vencidas com data original, categoria, conta preferida e acompanhamento visual em destaque até a quitação; elas aparecem junto com os contratos na lista principal e entram no saldo devedor. Contas avulsas e recorrentes continuam disponíveis na seção própria.
- Calendário integrado aos vencimentos de dívidas e contas; compromissos futuros não afetam o saldo até que um pagamento seja registrado.
- Relatórios por período e exportação de lançamentos em CSV.
- Exportação e restauração de backup JSON, com validação e confirmação antes de substituir os dados.
- Painel administrativo protegido no Supabase para acompanhar acessos e presença recente, com aviso de privacidade.
- Tema claro/escuro e layout responsivo.
- Valores exibidos em reais; os cálculos usam centavos inteiros.

Não são criados lançamentos ou contas de demonstração. Os saldos começam zerados e refletem somente os dados que a pessoa registrar.

## Limitações e privacidade

No modo local, os dados podem ser apagados ao limpar o armazenamento do navegador; exporte backups regularmente. No modo Supabase, os dados financeiros ficam em um documento JSONB por usuário autenticado, protegido por RLS; as alterações são sincronizadas automaticamente e o app informa falhas de sincronização. O cache no navegador serve somente para recuperação offline, não sincroniza alterações offline entre dispositivos nem resolve edições simultâneas de forma colaborativa. Mantenha backups JSON mesmo no modo nuvem.

Os lembretes são exibidos somente dentro do dashboard enquanto a aplicação está aberta; os depósitos recorrentes dos objetivos também são registros internos processados apenas com o app aberto e saldo suficiente, não transferências bancárias reais. Não há notificações push ou em segundo plano ou integração com cartões/bancos. A amortização antecipada com recálculo automático de juros, prazo ou valor das parcelas ainda não é oferecida; pagamentos registrados seguem o cronograma cadastrado e os termos do credor devem ser confirmados antes de alterar contratos.
