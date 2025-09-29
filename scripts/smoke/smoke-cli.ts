import { CodexCliRunner } from '../../runner/codegen/codex-cli/codex-cli-runner.js';
import { GeminiCliRunner } from '../../runner/codegen/gemini-cli/gemini-cli-runner.js';
import { ClaudeCodeCliRunner } from '../../runner/codegen/claude-code-cli/claude-code-cli-runner.js';
import { z } from 'zod';

interface SmokeResult {
  runner: string;
  skipped: boolean;
}

const DEFAULT_CODEX_MODEL = 'gpt-4o-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_CLAUDE_MODEL = 'claude-3.5-sonnet';

async function runCodexSmoke(): Promise<SmokeResult> {
  const model = process.env['CODEX_SMOKE_MODEL'] ?? DEFAULT_CODEX_MODEL;
  const runner = new CodexCliRunner();
  const abortController = new AbortController();
  try {
    const text = await runner.generateText({
      model,
      prompt: 'Reply with a short greeting mentioning "Codex".',
      messages: [],
      abortSignal: abortController.signal,
    });
    console.log('[codex-cli] Text response:', text.text.trim());

    const schema = z.object({
      result: z.string().describe('Short acknowledgement containing the word Codex'),
    });
    const structured = await runner.generateConstrained({
      model,
      prompt: 'Return a JSON object with a "result" field referencing Codex.',
      messages: [],
      schema,
      abortSignal: abortController.signal,
    });
    console.log('[codex-cli] Structured response:', structured.output);
    return { runner: 'codex-cli', skipped: false };
  } finally {
    abortController.abort();
    await runner.dispose();
  }
}

async function runGeminiSmoke(): Promise<SmokeResult> {
  const model = process.env['GEMINI_SMOKE_MODEL'] ?? DEFAULT_GEMINI_MODEL;
  const runner = new GeminiCliRunner();
  const abortController = new AbortController();
  try {
    const text = await runner.generateText({
      model,
      prompt: 'Reply with a short greeting mentioning "Gemini CLI".',
      messages: [],
      abortSignal: abortController.signal,
      timeout: { description: 'Gemini CLI smoke test', durationInMins: 2 },
    });
    console.log('[gemini-cli] Text response:', text.text.trim());

    const schema = z.object({
      summary: z.string().describe('Short acknowledgement containing the word "Gemini"'),
    });
    const structured = await runner.generateConstrained({
      model,
      prompt: 'Return JSON with a "summary" property that references Gemini CLI.',
      messages: [],
      schema,
      abortSignal: abortController.signal,
      timeout: { description: 'Gemini CLI constrained smoke test', durationInMins: 2 },
    });
    console.log('[gemini-cli] Structured response:', structured.output);
    return { runner: 'gemini-cli', skipped: false };
  } finally {
    abortController.abort();
    await runner.dispose();
  }
}

async function runClaudeSmoke(): Promise<SmokeResult> {
  const model = process.env['CLAUDE_SMOKE_MODEL'] ?? DEFAULT_CLAUDE_MODEL;
  const runner = new ClaudeCodeCliRunner();
  const abortController = new AbortController();
  try {
    const text = await runner.generateText({
      model,
      prompt: 'Reply with a short greeting mentioning "Claude Code".',
      messages: [],
      abortSignal: abortController.signal,
      timeout: { description: 'Claude Code CLI smoke test', durationInMins: 2 },
    });
    console.log('[claude-code-cli] Text response:', text.text.trim());

    const schema = z.object({
      note: z.string().describe('Short acknowledgement containing the word "Claude"'),
    });
    const structured = await runner.generateConstrained({
      model,
      prompt: 'Return JSON with a "note" property that references Claude Code CLI.',
      messages: [],
      schema,
      abortSignal: abortController.signal,
      timeout: { description: 'Claude Code CLI constrained smoke test', durationInMins: 2 },
    });
    console.log('[claude-code-cli] Structured response:', structured.output);
    return { runner: 'claude-code-cli', skipped: false };
  } finally {
    abortController.abort();
    await runner.dispose();
  }
}

async function main() {
  const tasks: Array<Promise<SmokeResult>> = [
    runCodexSmoke(),
    runGeminiSmoke(),
    runClaudeSmoke(),
  ];

  const settled = await Promise.allSettled(tasks);
  const results: SmokeResult[] = [];

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      console.error('Smoke test failed:', outcome.reason);
      process.exitCode = 1;
    }
  }

  const executed = results.filter((result) => !result.skipped).length;
  if (executed === 0) {
    console.log(
      'All CLI smoke tests were skipped. Adjust smoke models or ensure the CLIs are logged in to exercise them.'
    );
  }
}

main().catch((error) => {
  console.error('Smoke test runner failed unexpectedly:', error);
  process.exit(1);
});
