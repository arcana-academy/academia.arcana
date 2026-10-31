import { hasRuntimeSecret } from "@/infrastructure/runtime-secrets";

export type OpenSourceAiId =
  | "huggingface" | "langchain" | "llamaindex" | "deepset-haystack" | "ollama"
  | "vllm" | "bentoml" | "weaviate" | "zilliz-milvus" | "modular";

export type OpenSourceAiCapability =
  | "models" | "agents" | "rag" | "inference" | "serving" | "vector-db" | "ai-platform";

export type OpenSourceAiIntegration = {
  id: OpenSourceAiId;
  name: string;
  product: string;
  description: string;
  capabilities: readonly OpenSourceAiCapability[];
  license: string;
  repositoryUrl: string;
  websiteUrl: string;
  runtime: "local" | "self-hosted" | "cloud" | "hybrid";
  endpointEnv?: string;
  apiKeyEnv?: string;
  /** Adapter contract guaranteed by this application's generic chat gateway, not proof of runtime readiness. */
  gatewayContract?: "openai-chat-completions-v1";
};

export const openSourceAiIntegrations: readonly OpenSourceAiIntegration[] = [
  { id: "huggingface", name: "Hugging Face", product: "Hub + Transformers", description: "Modelos, datasets e tooling aberto para ML e IA generativa.", capabilities: ["models","agents","ai-platform"], license: "Ecossistema com licenças por projeto", repositoryUrl: "https://github.com/huggingface/transformers", websiteUrl: "https://huggingface.co", runtime: "cloud", endpointEnv: "HUGGINGFACE_BASE_URL", apiKeyEnv: "HUGGINGFACE_API_KEY" },
  { id: "langchain", name: "LangChain", product: "LangChain + LangGraph", description: "Framework aberto para aplicações LLM e agentes.", capabilities: ["agents","rag"], license: "MIT", repositoryUrl: "https://github.com/langchain-ai/langchain", websiteUrl: "https://www.langchain.com", runtime: "self-hosted" },
  { id: "llamaindex", name: "LlamaIndex", product: "LlamaIndex OSS", description: "Framework aberto para agentes, dados e RAG.", capabilities: ["agents","rag"], license: "MIT", repositoryUrl: "https://github.com/run-llama/llama_index", websiteUrl: "https://www.llamaindex.ai", runtime: "self-hosted" },
  { id: "deepset-haystack", name: "deepset / Haystack", product: "Haystack", description: "Orquestração open source para RAG, agentes e pipelines LLM.", capabilities: ["agents","rag"], license: "Apache-2.0", repositoryUrl: "https://github.com/deepset-ai/haystack", websiteUrl: "https://haystack.deepset.ai", runtime: "self-hosted" },
  { id: "ollama", name: "Ollama", product: "Ollama", description: "Runtime local para executar modelos abertos com privacidade.", capabilities: ["models","inference"], license: "MIT", repositoryUrl: "https://github.com/ollama/ollama", websiteUrl: "https://ollama.com", runtime: "local", endpointEnv: "OLLAMA_BASE_URL", gatewayContract: "openai-chat-completions-v1" },
  { id: "vllm", name: "vLLM", product: "vLLM", description: "Engine open source de inference e serving de LLMs.", capabilities: ["inference","serving"], license: "Apache-2.0", repositoryUrl: "https://github.com/vllm-project/vllm", websiteUrl: "https://vllm.ai", runtime: "self-hosted", endpointEnv: "VLLM_BASE_URL", gatewayContract: "openai-chat-completions-v1" },
  { id: "bentoml", name: "BentoML", product: "BentoML", description: "Serving open source para modelos e aplicações de IA.", capabilities: ["inference","serving"], license: "Apache-2.0", repositoryUrl: "https://github.com/bentoml/BentoML", websiteUrl: "https://www.bentoml.com", runtime: "self-hosted", endpointEnv: "BENTOML_BASE_URL" },
  { id: "weaviate", name: "Weaviate", product: "Weaviate", description: "Banco vetorial open source para busca semântica, RAG e agentes.", capabilities: ["vector-db","rag"], license: "Open source por componentes", repositoryUrl: "https://github.com/weaviate/weaviate", websiteUrl: "https://weaviate.io", runtime: "hybrid", endpointEnv: "WEAVIATE_URL", apiKeyEnv: "WEAVIATE_API_KEY" },
  { id: "zilliz-milvus", name: "Zilliz / Milvus", product: "Milvus", description: "Banco vetorial distribuído open source para workloads de IA.", capabilities: ["vector-db","rag"], license: "Apache-2.0", repositoryUrl: "https://github.com/milvus-io/milvus", websiteUrl: "https://milvus.io", runtime: "hybrid", endpointEnv: "MILVUS_URI", apiKeyEnv: "MILVUS_TOKEN" },
  { id: "modular", name: "Modular", product: "MAX + Mojo", description: "Plataforma de desenvolvimento e execução de IA com componentes open source.", capabilities: ["inference","serving","ai-platform"], license: "Licenciamento por componente", repositoryUrl: "https://github.com/modular/modular", websiteUrl: "https://www.modular.com", runtime: "hybrid" },
];

export function getOpenSourceAiIntegration(id: OpenSourceAiId) {
  return openSourceAiIntegrations.find((integration) => integration.id === id);
}

/** Catalog membership never by itself authorizes a chat-completions invocation. */
export function isOpenSourceAiGatewayEligible(id: OpenSourceAiId): boolean {
  return getOpenSourceAiIntegration(id)?.gatewayContract === "openai-chat-completions-v1";
}

export function getOpenSourceAiStatus(integration: OpenSourceAiIntegration, env: Partial<NodeJS.ProcessEnv> = process.env) {
  const endpointConfigured = integration.endpointEnv ? Boolean(env[integration.endpointEnv]) : false;
  const keyConfigured = integration.apiKeyEnv
    ? env === process.env
      ? hasRuntimeSecret(integration.apiKeyEnv)
      : Boolean(env[integration.apiKeyEnv])
    : true;
  return { configured: endpointConfigured && keyConfigured, endpointConfigured, keyConfigured };
}
