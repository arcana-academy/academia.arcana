# Academia Arcana — preparação do primeiro acesso pessoal hospedado

**Estado: PREPARAÇÃO DOCUMENTAL / NO-GO.** Este procedimento **não** autoriza
backup produtivo, exportação de dados, migração, alterações em Auth, merge,
publicação GHCR, troca de origem no Render ou deploy.

**Base técnica:** PR #847 DRAFT, candidata
`07868265f6e1b8f5eaf526ddddb38f40d455bb74`; desenvolvimento isolado
`work/aa-personal-experience-20261031`, a partir do commit
`9c484bb91af144b6979fa26fcd49cfd76bbe01ad`.

**Evidência reutilizável:** Database Tests
[41252530174](https://github.com/arcana-academy/academiaarcana/actions/runs/41252530174)
com sucesso, incluindo as cinco migrações abaixo, em Supabase local descartável
na candidata original. Os demais nove workflows da PR #847 também terminaram
em SUCCESS naquele SHA. **Não** confundir CI da candidata com Quality Gate
integral do HEAD pessoal nem com compatibilidade efetiva do banco hospedado.

## 1. Evidência de migrações — leitura, sem alteração

Consulta de metadados do Supabase hospedado: 26 versões aplicadas. Na árvore
da candidata pessoal: 29 arquivos SQL, dos quais 18 versões coincidem.

- **Apenas no registro hospedado (8 versões):**
  `20260929124554`, `20260929142350`, `20260929201711`,
  `20260929201757`, `20260929202937`, `20261007230656`,
  `20261007230659`, `20261007230750`.
- **Somente no repositório, históricas (6 versões):**
  `20260929153000`, `20260929202000`, `20260929210000`,
  `20261006162332`, `20261007170500`, `20261007230000`.
- **Novas e testadas em ambiente local (5 versões, nesta ordem):**
  1. `20261021201427_restrict_grimoire_cover_move_folder.sql`
  2. `20261024180000_durable_open_source_ai_rate_limit.sql`
  3. `20261024181000_api_rate_limit.sql`
  4. `20261028130000_reconcile_practice_evidence_contract_checks.sql`
  5. `20261028132000_require_nonnull_objective_evidence.sql`

**REGRA DE PARADA:** jamais executar `supabase migration up`, `db push` ou
`migration repair` no hospedado com esse histórico divergente. Verificar
manualmente a equivalência de cada versão histórica no catálogo real,
restrições, grants, funções e políticas. Não inferir equivalência pelo nome
nem carimbar uma versão só para limpar o alerta. Qualquer reparo de histórico
é uma alteração produtiva distinta que requer aprovação específica.

**Verificador local, sem credenciais:** obter em leitura uma lista autorizada
contendo *somente* os números de versão e salvá-la em um arquivo JSON privado
fora do repositório (formato `{"migrations":[{"version":"<14 dígitos>"}]}`).
Executar:

```sh
node scripts/security/check-personal-migration-ledger.mjs /caminho-privado/versoes.json
```

Saída `compatibleLedger: false` e código 2 são **bloqueio previsto**, não
falha do próprio verificador. Código 0 indica paridade **de números de
versão**, não prova de que o conteúdo SQL ou o ambiente sejam equivalentes.
Código 1 indica entrada inválida; nunca prosseguir. Não incluir IDs de usuários,
senhas, tokens nem dados de tabela no arquivo de versões.

Na leitura realizada para esta preparação, o verificador retornou 8 versões
apenas hospedadas, 11 apenas no código, com saída 2. O arquivo temporário de
versões foi excluído após a consulta.

## 2. Backup gratuito — três objetos recuperáveis, não apenas um dump

A documentação Supabase confirma: projetos **Free** não recebem backups
automáticos diários; a alternativa documentada é `supabase db dump` com
cópias independentes. A CLI usa Docker e exclui `auth`, `storage` e outros
esquemas gerenciados da exportação padrão. O banco não guarda o conteúdo
binário dos objetos Storage; mesmo um dump de metadados não recupera arquivos.

Antes de qualquer alteração produtiva, o operador deve demonstrar:

1. **Banco:** exportações separadas de *roles*, *schema* e *data*, usando
   Supabase CLI/pg_dump em executor autorizado e isolado; documentar as
   exclusões padrão da CLI, versões de Postgres, extensões, constraints,
   grants, RLS e histórico de migrações. Não afirmar que um dump parcial
   recupera Auth ou Storage.
2. **Auth e Storage:** estratégia autorizada, minimamente privilegiada e
   testada para recuperar identidades relevantes e os arquivos de buckets
   privados (metadados, caminhos, bytes e hashes), incluindo capas de
   Grimórios. Não copiar dados pessoais sem destino e autoridade aprovados.
   A reconstituição de senhas, sessões e chaves gerenciadas pode exigir
   procedimentos específicos; não declarar recuperação de credenciais sem
   comprovação. Na restauração, impedir e-mails e integrações externas.
3. **Artefatos executáveis:** imagem OCI primária e fallback mantidos em
   custódia independente do GHCR, com manifesto e blobs por SHA-256 e
   recuperação comprovada. Reutilizar
   [GHCR retention and recovery](ghcr-retention-recovery-536.md), sem
   reduzir os gates #536/#594/#595 a um checksum sintético.

**Pré-condições de um backup real:** autorização separada, responsável pela
operação, local de custódia independente aprovado e com armazenamento
suficiente no orçamento **R$ 0**, criptografia, ACL, retenção definida,
proibição de logs com credenciais, recibos de hashes e segundo destino/
restauração autorizado. A retenção de 30 dias é uma escolha preliminar;
não foi demonstrada nem contratada. Sem destino seguro, **BLOCKED**.

**Prova de recuperação:** descarregar as cópias do destino aprovado,
validar hashes, restaurar em banco/Storage isolados com acesso restrito,
verificar contagem e integridade, permissões e execução dos fluxos com
identidades sintéticas. Preservar o hospedado. Sem restauração real, classificar
o backup como **não homologado**, mesmo que o dump termine sem erros.

Fontes oficiais:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/storage/management/download-objects

## 3. Plano das cinco migrações (NÃO EXECUTAR)

Apenas após histórico reconciliado e backup/restauração verificados:

1. Aprovar janela de manutenção, ponto de corte e bloqueio temporário de
   escrita, se necessário; guardar contagens e verificações de integridade.
2. Confirmar que a política `storage.objects` de UPDATE de
   `grimoire-covers` ainda permite MOVE para prefixos diferentes; a primeira
   migração restringe apenas `WITH CHECK` ao prefixo do `auth.uid()`.
3. Confirmar ausência de `public.open_source_ai_rate_limits` e da RPC
   `public.consume_open_source_ai_rate_limit()`. Esta tabela deve manter
   RLS ligado, sem acesso direto e com EXECUTE mínimo à RPC.
4. Confirmar ausência da RPC `public.consume_api_rate_limit(text)` e as
   políticas/contadores de `private`. Proteger os contadores e não expor
   `private` pela Data API. Verificar limites de `mestre-arcano` e
   `feedback` usando identidades sintéticas.
5. Validar contratos atuais de `educational_practice_items` e
   `educational_practice_attempts`, depois as novas exigências que impedem
   evidências objetivas nulas. Na leitura anterior, não havia registros que
   violassem as duas novas exigências; reavaliar no momento autorizado.
6. Revisar grants explícitos de cada tabela/função nova, inclusive a mudança
   de defaults da Data API a partir de 30/10/2026. **RLS não substitui GRANT.**
7. Aplicar **somente** o delta aprovado, de forma sequencial, com inspeção
   de retorno. Reexecutar apenas testes afetados, privilegiando os cinco
   pgTAP já existentes em `supabase/tests/database`.
8. Se qualquer etapa falhar, **parar**. Não improvisar `down` ou
   `DROP` em banco com dados. Decidir recuperação com a autoridade
   designada, a partir de cópia restaurável demonstrada.

A autorização para *preparar* não é autorização para aplicar SQL hospedado.

## 4. Modo pessoal e primeira sessão

- Confirmar, por meio autorizado e sem publicar identificadores, que a conta
  atual consegue autenticar e que o `auth.uid()` corresponde ao identificador
  imutável a ser autorizado. Não usar e-mail ou `user_metadata` como critério.
- Em servidor, configurar **somente após autorização específica**
  `ACADEMIA_ARCANA_PERSONAL_MODE=true` e
  `ACADEMIA_ARCANA_PERSONAL_OWNER_ID=<UUID autenticado>`.
  São variáveis de runtime **sem** prefixo `NEXT_PUBLIC_`, nunca segredos
  embutidos na imagem Docker.
- Confirmar recuperação de senha e callback autorizado **antes** de desabilitar
  inscrições no provedor Supabase Auth. Esconder a UI de cadastro não bloqueia
  a API de cadastro. A alteração do provedor exige autorização independente.
- Testar com identidades sintéticas: dona permitida, outra conta recusada,
  anônimo recusado, logout, sessão inválida, APIs e ações do servidor,
  proteção de dados RLS, `/robots.txt` e `X-Robots-Tag` em modo pessoal.
- Comparar o visual ao Brand Book aprovado e executar em navegador real os
  fluxos de Grimórios, Workspace, Missões, Cronograma, Prática, Foco,
  Estatísticas, Perfil, personalização e retomada após recarga. Não
  transformar presença de rota ou CI sintético em homologação real.
- Manter `/api/health` não sensível para liveness; não publicar métricas
  privadas ou resultado de consultas Auth no endpoint.

## 5. Render — migração da origem é uma alteração produtiva

O serviço existente `srv-dauor697lnhs739cicag` usa Git/Node, Render Free
e Auto Deploy OFF. A troca da origem para imagem pode **disparar deploy**.
Não executar essa troca nesta preparação. Preservar o site antigo até prova
de recuperação de OCI e decisão humana de cutover.

Antes do cutover: exigir revisão de imagem `linux/amd64` com digest
imutável, segredos só em runtime, cópia independente e restauração comprovada,
Quality Gate do **SHA pessoal exato** (os 10 SUCCESS de #847 não se
transferem automaticamente), sessão real autorizada, smoke e rollback
demonstráveis. Seguir [render.md](render.md) e
[release-signoff-536.md](release-signoff-536.md). Manter #536, #594, #595
e C03/ORG02 como gates protegidos; não inventar revisor ou custódia.

## 6. Autorização por operação, não em bloco

| Operação futura | Necessidade antes da autorização | Situação atual |
| --- | --- | --- |
| Backup produtivo | Destino independente seguro, operador, custódia, orçamento e plano de recuperação | BLOCKED |
| Reconciliação do ledger | Demonstrar equivalências históricas, sem `repair` automático | BLOCKED |
| Cinco migrações hospedadas | Histórico reconciliado, backup/restauração e janela aprovados | BLOCKED |
| Configuração do Supabase Auth | Conta pessoal verificada e recuperação testada | BLOCKED |
| Merge / GHCR / Render | Gates protegidos, Quality Gate exato, DR e cutover autorizados separadamente | NO-GO |

**Decisão:** PREPARAÇÃO técnica e documental. Nenhum backup/exportação,
migração, mudança administrativa ou deploy foi executado por este roteiro.
Link do site pessoal somente depois de implantação autorizada, login e
funcionalidades verificados em produção.
