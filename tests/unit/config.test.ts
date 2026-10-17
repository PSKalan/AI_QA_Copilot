import assert from "node:assert/strict";
import { test } from "node:test";

import { ConfigError, loadConfig, type EnvSource } from "../../src/config/index.ts";

function validEnv(): EnvSource {
  return {
    OLLAMA_BASE_URL: "http://localhost:11434",
    OLLAMA_CHAT_MODEL: "llama3.2:3b",
    OLLAMA_EMBED_MODEL: "",
    N8N_BASE_URL: "http://localhost:5678",
    DEMO_SITE_URL: "https://example.com",
  };
}

const REQUIRED_KEYS = [
  "OLLAMA_BASE_URL",
  "OLLAMA_CHAT_MODEL",
  "N8N_BASE_URL",
  "DEMO_SITE_URL",
] as const;

test("valid configuration is mapped correctly", () => {
  const config = loadConfig(validEnv());

  assert.equal(config.ollama.baseUrl, "http://localhost:11434");
  assert.equal(config.ollama.chatModel, "llama3.2:3b");
  assert.equal(config.n8n.baseUrl, "http://localhost:5678");
  assert.equal(config.demo.siteUrl, "https://example.com");
});

test("accepts both http and https URLs", () => {
  const config = loadConfig({
    ...validEnv(),
    OLLAMA_BASE_URL: "https://ollama.internal",
    N8N_BASE_URL: "http://n8n.internal:5678",
  });

  assert.equal(config.ollama.baseUrl, "https://ollama.internal");
  assert.equal(config.n8n.baseUrl, "http://n8n.internal:5678");
});

test("trims surrounding whitespace on values", () => {
  const config = loadConfig({
    ...validEnv(),
    OLLAMA_CHAT_MODEL: "  llama3.2:3b  ",
    DEMO_SITE_URL: "  https://example.com  ",
  });

  assert.equal(config.ollama.chatModel, "llama3.2:3b");
  assert.equal(config.demo.siteUrl, "https://example.com");
});

test("embedding model is undefined when absent", () => {
  const env = validEnv();
  env["OLLAMA_EMBED_MODEL"] = undefined;

  const config = loadConfig(env);

  assert.equal(config.ollama.embedModel, undefined);
});

test("empty embedding model is treated as undefined", () => {
  const config = loadConfig({ ...validEnv(), OLLAMA_EMBED_MODEL: "   " });

  assert.equal(config.ollama.embedModel, undefined);
});

test("a provided embedding model is preserved", () => {
  const config = loadConfig({ ...validEnv(), OLLAMA_EMBED_MODEL: "nomic-embed-text" });

  assert.equal(config.ollama.embedModel, "nomic-embed-text");
});

test("a missing embedding model does not fail otherwise-valid config", () => {
  const env = validEnv();
  env["OLLAMA_EMBED_MODEL"] = undefined;

  assert.doesNotThrow(() => loadConfig(env));
});

for (const key of REQUIRED_KEYS) {
  test(`throws when ${key} is missing`, () => {
    const env = validEnv();
    env[key] = undefined;

    assert.throws(() => loadConfig(env), (error: unknown) => {
      return error instanceof ConfigError && error.message.includes(key);
    });
  });
}

test("an empty required value is reported as missing", () => {
  const env = validEnv();
  env["OLLAMA_BASE_URL"] = "";

  assert.throws(() => loadConfig(env), ConfigError);
});

test("a whitespace-only required value is treated as missing", () => {
  const env = validEnv();
  env["OLLAMA_CHAT_MODEL"] = "   ";

  assert.throws(() => loadConfig(env), ConfigError);
});

test("all missing required values are aggregated into one error", () => {
  const env = validEnv();
  env["OLLAMA_BASE_URL"] = undefined;
  env["N8N_BASE_URL"] = undefined;

  assert.throws(() => loadConfig(env), (error: unknown) => {
    assert.ok(error instanceof ConfigError);
    assert.equal(error.issues.length, 2);
    assert.match(error.message, /OLLAMA_BASE_URL/);
    assert.match(error.message, /N8N_BASE_URL/);
    return true;
  });
});

test("throws on a non-URL OLLAMA_BASE_URL", () => {
  const env = validEnv();
  env["OLLAMA_BASE_URL"] = "not-a-url";

  assert.throws(() => loadConfig(env), ConfigError);
});

test("throws on a non-http(s) N8N_BASE_URL", () => {
  const env = validEnv();
  env["N8N_BASE_URL"] = "ftp://example.com";

  assert.throws(() => loadConfig(env), ConfigError);
});

test("throws on DEMO_SITE_URL without a scheme", () => {
  const env = validEnv();
  env["DEMO_SITE_URL"] = "example.com";

  assert.throws(() => loadConfig(env), ConfigError);
});

test("invalid URL error names the offending variable", () => {
  const env = validEnv();
  env["DEMO_SITE_URL"] = "not-a-url";

  assert.throws(() => loadConfig(env), (error: unknown) => {
    return error instanceof ConfigError && error.message.includes("DEMO_SITE_URL");
  });
});
