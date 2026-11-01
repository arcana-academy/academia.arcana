# Life Sciences NGS Analysis — avaliação de uso na Academia Arcana

> **Situação em 2026-11-01:** proposta documental, não integração de runtime e não requisito do MVP.
>
> **Escopo da alteração:** somente este documento, em branch isolada. Sem deploy, migração,
> segredos, dependências novas, serviços pagos, acesso a dados de estudantes ou alteração de release.
>
> **Base consultada:** `main` `b4f5eb3cdd345002349e7d9d30f826b4a57e5889`. A PR #847
> permanece candidata DRAFT/NO-GO; este trabalho não integra nem altera essa PR.

## 1. O que é e o que não é

O **Life Sciences NGS Analysis** oferece, no ChatGPT, roteamento e orientações especializadas
para análises de dados de sequenciamento de nova geração. A disponibilidade observada é
por *skills* de análise; **não há SDK, API HTTP, endpoint ou componente web do plugin
comprovado para incorporação automática no Next.js**.

Não confundir:
- **Ferramenta de desenvolvimento/curadoria:** assistente pode orientar análise,
  revisar metadados e artefatos, interpretar QC e estruturar atividades científicas.
- **Funcionalidade do site:** só existirá com implementação explícita e aprovação
  própria; o plugin estar conectado ao ChatGPT não o conecta ao navegador ou ao servidor.
- **Execução científica:** requer arquivos adequados, referências, dependências e executor
  validado. Nenhuma execução ou resultado biológico foi verificado nesta avaliação.

O aplicativo permanece uma plataforma **universal** de aprendizagem.
Bioinformática é uma opção de conteúdo, não um domínio transversal obrigatório.

## 2. Capacidades verificadas nas skills

| Classe | Habilidades disponíveis | Dependências típicas |
|---|---|---|
| Roteamento/preflight | Identificação de BCL, FASTQ, BAM/CRAM, VCF, matrizes de contagem e metadados; plano de ambiente e recursos | Python e scripts do pacote NGS; ferramentas existentes no executor |
| FASTQ QC | Inspeção, FastQC/MultiQC; ramificações opcionais fastp/Cutadapt | FASTQ, FASTQC e MultiQC para execução real |
| DNA | Germinativo, somático, painéis UMI, variantes | Referência genômica, metadados, ferramentas próprias |
| RNA | Bulk RNA-seq, contagens, expressão diferencial; single-cell/single-nucleus e UMAP | Amostras, desenho experimental, contagens e referências |
| Epigenômica | ATAC-seq, ChIP-seq, CUT&RUN e CUT&Tag | Reads, controles e referências |
| Microbiomas | Amplicons 16S/18S/ITS/COI e metagenômica shotgun | Primers/metadados ou bancos de referência, conforme o ensaio |

Conjuntos de ferramentas mencionados nas skills incluem Nextflow/nf-core, Snakemake,
Salmon, STAR, DESeq2, FastQC, MultiQC, Cutadapt e fastp. **Menção não equivale a
instalação, licença aceita nem disponibilidade no projeto.** Ferramentas proprietárias
podem impor licenças; bancos grandes e computação em nuvem podem gerar custos.

Para uma análise real, iniciar pelo roteador `ngs-analysis-router`, depois escolher
**uma** skill específica. Antes de instalar ou executar, seguir `ngs-runtime-env`.
Exemplo *documental*, executável apenas se os scripts do pacote estiverem disponíveis
no executor autorizado:

```bash
python plugins/ngs-analysis/scripts/ngs_preflight.py --pipeline fastq_qc --emit-install-plan
```

**Não adicionar essa linha ao build, ao CI ou à inicialização do site.** O repositório
da Academia Arcana não foi identificado como contendo o pacote executável
`plugins/ngs-analysis/scripts/`.

## 3. Aplicações priorizadas no produto

| Prioridade | Área | Aplicação segura | Estado |
|---|---|---|---|
| P1 (opcional) | Academia / educação | Aula sobre estrutura de FASTQ, qualidade por base e interpretação de resultados QC | Material preparatório definido abaixo; não publicada |
| P1 (opcional) | Grimórios / Workspace | Anotações, glossário e perguntas de revisão criadas por estudante ou educador | Utilizar fluxos existentes; nenhum esquema novo |
| P2 | Prática / revisões | Questões conceituais de recuperação e feedback com respostas verificáveis | Proposta; não confundir autoavaliação com domínio comprovado |
| P2 | Cronograma / missões | Planejamento de estudos de genômica | Somente conteúdo e tarefas já suportados |
| P3 | Estatísticas | Acompanhar **aprendizagem** do tema, nunca métricas laboratoriais como nota acadêmica | Nenhuma alteração proposta |
| P3 | Mestre Arcano / Flonts | Explicação contextual de relatórios QC fornecidos de forma segura | Somente com limites e autorizações existentes |
| Não indicado para o MVP | Administração, Render, Supabase, login, Santuário | Instalação de pipeline NGS em produção | Não implementar |

Preservar os domínios canônicos: `education` é responsável por conteúdo,
`learning` por processos/evidências de progresso, `data` por persistência,
`intelligence` por orquestração autorizada. Não criar banco científico de estudantes,
novo domínio ou provedor de IA a partir deste estudo.

## 4. Atividade didática opcional — “Como avaliar leituras de DNA?”

**Público-alvo:** estudante de nível introdutório em Genética ou Bioinformática.
**Objetivo:** diferenciar dado bruto, controle de qualidade e inferência biológica.
**Fonte:** conceitos públicos gerais do fluxo FASTQ QC; não é resultado experimental.

### Sequência proposta

1. **Objetivo:** explicar o que FASTQ registra: identificador, sequência,
   separador e escores de qualidade codificados.
2. **Estudo:** identificar por que a qualidade pode diminuir ao final das leituras.
3. **Prática de recuperação:** responder sem consultar:
   - “Por que um trecho final de baixa qualidade pode afetar uma análise posterior?”
   - “A presença de leituras duplicadas prova erro no sequenciamento?”
   - “Qual a diferença entre um relatório FastQC e uma descoberta genética?”
4. **Feedback de referência:**
   - Bases pouco confiáveis podem gerar alinhamentos, estimativas ou variantes
     equivocadas; cortar dados sem avaliar o ensaio também pode causar perdas.
   - Não: duplicação tem significado dependente do ensaio e da preparação da biblioteca.
   - FastQC avalia propriedades técnicas das leituras; não estabelece, por si só,
     diagnóstico, variante causal ou conclusão biológica.
5. **Revisão:** justificar quando seria prudente investigar adaptadores/primers,
   problemas de pareamento R1/R2 ou excesso de sequências representadas.
6. **Progresso:** registrar apenas a evidência educacional produzida pelos fluxos
   existentes; evitar métricas artificiais de domínio e diagnósticos.

**Sem necessidade de dados reais:** os exemplos introdutórios podem ser textuais
ou totalmente sintéticos, com identificação explícita de que são demonstrações.
Não simular relatórios QC e apresentá-los como provenientes do plugin.

## 5. Privacidade, custos e integração

- **LGPD:** dados genômicos humanos podem ser dados pessoais sensíveis. Não coletar,
  transmitir a conectores/clouds ou publicar arquivos brutos de participantes
  sem finalidade definida, base legal, controles e autorização apropriados.
- **Dados dos estudantes:** não enviar Workspace, perfis, notas privadas,
  respostas ou tokens ao pipeline científico. Manter autenticação e RLS.
- **R$ 0 adicional:** não instalar pacotes pagos, habilitar APIs faturáveis,
  baixar grandes bancos ou criar serviços no Render. Projetos científicos reais
  só podem ser planejados gratuitamente até seus custos serem validados.
- **Segurança:** preservar CSP, segredos no servidor, limitações do gateway de IA,
  `autoDeploy` desligado e bloqueios #536, #594, #595 e C03/ORG02.
- **Arquitetura:** não criar integração `connected` artificial para o plugin
  ou expor um “analisar genoma” sem backend homologado e dados apropriados.
- **Execução:** pipeline científico eventualmente autorizado em executor isolado
  com registros próprios, separado do Next.js e do Supabase produtivo.

## 6. Condições para retomar uma análise real

Somente se surgir uma necessidade educacional concreta de processar sequenciamento:
1. Confirmar tipo de entrada (BCL, FASTQ, BAM/CRAM, VCF, matriz de contagem).
2. Determinar ensaio, organismo/referência, objetivo, pareamento e metadados;
   para dados humanos, determinar onde os arquivos podem ser processados
   e se qualquer upload é permitido.
3. Confirmar executor autorizado, espaço, ferramentas existentes e limite R$ 0.
4. Executar **preflight antes de instalar** e plano de referência antes de pipeline
   que requeira genoma ou banco de dados.
5. Criar resultados em diretório isolado e revisar métricas reais com cautelas
   biológicas e técnicas. Não sobrescrever arquivos de entrada.
6. Se houver interesse em funcionalidade web, produzir proposta separada,
   testes e revisão de privacidade/segurança. Não incorporar ao release atual.

**Ausências observadas:** nenhum conjunto de leituras fornecido nesta operação;
nenhum SDK/API de runtime do plugin verificado; nenhuma execução de pipeline,
FastQC, MultiQC, build Next.js ou teste E2E foi realizada.

## 7. Critérios de encerramento deste trabalho

- Documento aditivo sem mudança de código, banco, infraestrutura ou identidade visual.
- Aulas e atividades **propostas**, não cadastradas nas contas de estudantes.
- Não adiciona dependência para o MVP, nem declara integração conectada.
- Todo processamento científico real permanece **NÃO EXECUTADO**, por falta de
  dados científicos e runtime verificado.
- A revisão e eventual merge do documento são independentes do lançamento.
- **NO-GO do release protegido preservado.**

### Referências internas

- [Baseline de produto](../product/AA-PRODUCT-1.0.md)
- [Arquitetura canônica](../architecture/AA-ARCHITECTURE-1.0.md)
- [Exemplo de fronteira real de integração (DataCamp)](./datacamp.md)
