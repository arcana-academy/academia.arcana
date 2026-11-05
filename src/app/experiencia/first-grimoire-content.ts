"use client";

/**
 * Conteúdo educativo ORIGINAL e PROVISÓRIO desta implementação isolada.
 * A especificação funcional aprovada V1 não está disponível integralmente
 * nesta unidade; conciliar texto, perguntas e feedback antes de homologar.
 * Nenhum dado remoto ou pessoal é acessado.
 */
export const READING_PAGES = [
  {
    title: "A página em branco é um começo",
    text: "Aprender não exige entender tudo imediatamente. Comece com uma pergunta pequena: o que quero compreender ao terminar esta leitura? Ter uma intenção ajuda a perceber o que vale a pena observar.",
    practice: "Escolha um conceito e tente explicá-lo em uma frase. Você poderá voltar à leitura quando desejar.",
  },
  {
    title: "Recordar é uma forma de estudar",
    text: "Depois de ler, afaste os olhos do texto por um momento. Tente lembrar as ideias principais com suas próprias palavras. Se algo faltar, retorne à página e descubra qual parte precisa de outra leitura.",
    practice: "Não se trata de acertar na primeira tentativa. A revisão faz parte da jornada.",
  },
  {
    title: "Um passo, uma pausa, uma reflexão",
    text: "Uma sessão breve de concentração pode ser suficiente para começar. Ao final, registre o que ficou claro e o que ainda desperta curiosidade. Essa síntese transforma uma leitura passageira em um próximo passo concreto.",
    practice: "Ao terminar, responda três perguntas, registre uma sessão de foco e escreva uma síntese curta.",
  },
] as const;

export type FirstGrimoireQuestion = {
  id: string;
  prompt: string;
  choices: readonly [string, string, string];
  correct: 0 | 1 | 2;
  explanation: string;
  retryHint: string;
};

export const QUESTIONS: readonly FirstGrimoireQuestion[] = [
  {
    id: "intencao",
    prompt: "Qual é um bom primeiro passo ao começar um estudo?",
    choices: [
      "Ler sem definir o que procuro.",
      "Formular uma pergunta simples sobre o que quero compreender.",
      "Esperar até saber tudo sobre o assunto.",
    ],
    correct: 1,
    explanation: "Ter uma pergunta dá direção à leitura sem exigir domínio prévio.",
    retryHint: "Procure a alternativa que ajuda a dar direção ao estudo.",
  },
  {
    id: "recordacao",
    prompt: "O que fazer depois de ler uma ideia importante?",
    choices: [
      "Evitar revisitar o texto.",
      "Copiar tudo sem tentar compreender.",
      "Tentar recordar a ideia com minhas palavras e revisar o que faltar.",
    ],
    correct: 2,
    explanation: "Recuperar uma ideia de memória e conferir as lacunas permite uma revisão mais ativa.",
    retryHint: "Pense no exercício de explicar a ideia sem olhar a página.",
  },
  {
    id: "sintese",
    prompt: "O que pode transformar uma sessão breve em um próximo passo?",
    choices: [
      "Registrar o que aprendi e uma dúvida para continuar depois.",
      "Descartar qualquer dúvida que permaneça.",
      "Acumular horas sem observar o que foi compreendido.",
    ],
    correct: 0,
    explanation: "A síntese ajuda a reconhecer avanços e a planejar a próxima leitura.",
    retryHint: "Procure a escolha que valoriza o registro e a reflexão.",
  },
] as const;

export const STEP_NAMES = [
  "Leitura",
  "Três perguntas",
  "Foco",
  "Síntese",
  "Conclusão",
] as const;
