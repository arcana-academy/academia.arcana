# Academia Arcana — Zotero: leitura pública opcional (NO-GO)

**Escopo:** adaptador de metadados, desativado no runtime. **Não é integração do plugin do ChatGPT nem autorização para publicação.**

## Constatações em 2026-11-01

- O plugin Zotero consta como instalado e habilitado no ChatGPT, mas esta sessão não disponibilizou ferramentas específicas para ler/gravar a biblioteca vinculada.
- O catálogo do repositório já menciona Zotero em chatgpt-plugin-catalog.ts; isso não é uma conexão com bibliotecas.
- O contrato de integrações vigente exige fronteira independente do fornecedor e execução pelo servidor.
- A documentação oficial descreve a Web API v3 em https://api.zotero.org , HTTPS obrigatório e cabeçalho Zotero-API-Version: 3.

## Implementação isolada

O arquivo src/infrastructure/integrations/zotero.ts disponibiliza listZoteroPublicReferences para bibliotecas públicas Zotero de usuários e grupos, limitando-se a GET /{users|groups}/{id}/items/top. Exige ID numérico, host fixo, versão 3, até 50 itens, timeout de 8 s, cache desativado, credenciais omitidas, sem redirecionamentos. Filtra anexos, notas e anotações; projeta apenas metadados bibliográficos. Sem pacotes novos, segredos, persistência, alteração de UI, migrações ou rotas.

É um adaptador **não conectado**: não existe fluxo de seleção/autorização de biblioteca, não há invocação pelo produto e nenhum conteúdo de estudante é enviado ao Zotero. Não deve ser apresentado como funcionalidade estudantil ativa, nem ser necessário para concluir o MVP.

## Próximos passos condicionais (fora do escopo desta alteração)

1. Validar código, tipos e testes direcionados em checkout isolado Node 24/npm 11.19.1 antes de aceitar qualquer merge; testes unitários não substituem evidência E2E.
2. Demonstrar demanda educacional e consentimento explícito para conexão de bibliotecas pessoais. O uso de bibliotecas privadas requer autorização separada e credenciais guardadas exclusivamente no servidor; o Zotero utiliza fluxo OAuth próprio, que não deve ser presumido como OAuth 2.1.
3. Planejar interface acessível em Grimórios/Editor somente após aprovação de escopo, com isolamento por estudante, políticas LGPD, limites por usuário e testes de revogação.
4. Analisar termos e direitos de uso de materiais; metadados não significam licença para redistribuição de PDFs.

## Proteções

R$ 0 adicional, sem chaves, sem alterações em main, sem deploy, sem migração produtiva, sem modificação de Auth/RLS/CSP, sem novo requisito bloqueante para MVP. Auto Deploy OFF e NO-GO preservados. Não registrar PASS de testes sem execução observada.

Referências técnicas: https://www.zotero.org/support/dev/web_api/v3/basics ; https://www.zotero.org/support/dev/web_api/v3/write_requests ; https://www.zotero.org/support/individual_storage
