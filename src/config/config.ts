import process from "node:process";

export interface OllamaConfig {
  baseUrl: string;
  chatModel: string;
  embedModel?: string;
}

export interface N8nConfig {
  baseUrl: string;
}

export interface DemoConfig {
  siteUrl: string;
}

export interface AppConfig {
  ollama: OllamaConfig;
  n8n: N8nConfig;
  demo: DemoConfig;
}

export type EnvSource = Record<string, string | undefined>;

export class ConfigError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid configuration:\n- ${issues.join("\n- ")}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function readRequired(env: EnvSource, key: string, issues: string[]): string {
  const value = env[key]?.trim();
  if (!value) {
    issues.push(`${key} is required but was missing or empty.`);
    return "";
  }
  return value;
}

function readUrl(env: EnvSource, key: string, issues: string[]): string {
  const value = readRequired(env, key, issues);
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    if (!HTTP_PROTOCOLS.has(url.protocol)) {
      issues.push(`${key} must use http or https; got "${value}".`);
    }
  } catch {
    issues.push(
      `${key} must be a valid absolute URL (e.g. http://localhost:11434); got "${value}".`,
    );
  }

  return value;
}

export function loadConfig(env: EnvSource = process.env): AppConfig {
  const issues: string[] = [];

  const baseUrl = readUrl(env, "OLLAMA_BASE_URL", issues);
  const chatModel = readRequired(env, "OLLAMA_CHAT_MODEL", issues);
  const embedModel = env["OLLAMA_EMBED_MODEL"]?.trim() || undefined;
  const n8nBaseUrl = readUrl(env, "N8N_BASE_URL", issues);
  const siteUrl = readUrl(env, "DEMO_SITE_URL", issues);

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  return {
    ollama: { baseUrl, chatModel, embedModel },
    n8n: { baseUrl: n8nBaseUrl },
    demo: { siteUrl },
  };
}
