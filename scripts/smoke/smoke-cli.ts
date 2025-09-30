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
const DEFAULT_CLAUDE_MODEL = 'claude-3-5-sonnet-latest';

async function runCodexSmoke(): Promise<SmokeResult> {
  const model = process.env['CODEX_SMOKE_MODEL'] ?? DEFAULT_CODEX_MODEL;
  const runner = new CodexCliRunner();
  const abortController = new AbortController();
  try {
    const schema = z.object({
      result: z
        .string()
        .describe('Short acknowledgement containing the word Codex'),
    });
    const [text, structured] = await Promise.all([
      runner.generateText({
        model,
        prompt: 'Reply with a short greeting mentioning "Codex".',
        messages: [],
        abortSignal: abortController.signal,
      }),
      runner.generateConstrained({
        model,
        prompt: 'Return a JSON object with a "result" field referencing Codex.',
        messages: [],
        schema,
        abortSignal: abortController.signal,
      }),
    ]);
    console.log('[codex-cli] Text response:', text.text.trim());
    console.log('[codex-cli] Structured response:', structured.output);
    return { runner: 'codex-cli', skipped: false };
  } catch (error) {
    if (shouldSkipBecauseUnauthenticated(error)) {
      console.log('[codex-cli] Skipping smoke test: CLI not authenticated.');
      return { runner: 'codex-cli', skipped: true };
    }
    if (isEmptyResponseError(error)) {
      console.log(
        '[codex-cli] Skipping smoke test: CLI returned no structured output. Details:',
        getErrorMessage(error)
      );
      return { runner: 'codex-cli', skipped: true };
    }
    throw error;
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
    const schema = z.object({
      summary: z
        .string()
        .describe('Short acknowledgement containing the word "Gemini"'),
    });
    const [text, structured] = await Promise.all([
      runner.generateText({
        model,
        prompt: 'Reply with a short greeting mentioning "Gemini CLI".',
        messages: [],
        abortSignal: abortController.signal,
        timeout: { description: 'Gemini CLI smoke test', durationInMins: 2 },
      }),
      runner.generateConstrained({
        model,
        prompt:
          'Return JSON with a "summary" property that references Gemini CLI.',
        messages: [],
        schema,
        abortSignal: abortController.signal,
        timeout: {
          description: 'Gemini CLI constrained smoke test',
          durationInMins: 2,
        },
      }),
    ]);
    console.log('[gemini-cli] Text response:', text.text.trim());
    console.log('[gemini-cli] Structured response:', structured.output);
    return { runner: 'gemini-cli', skipped: false };
  } catch (error) {
    if (
      shouldSkipBecauseUnauthenticated(error) ||
      isInvalidArgumentError(error)
    ) {
      console.log('[gemini-cli] Skipping smoke test:', getErrorMessage(error));
      return { runner: 'gemini-cli', skipped: true };
    }
    throw error;
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
    const schema = z.object({
      note: z
        .string()
        .describe('Short acknowledgement containing the word "Claude"'),
    });
    const [text, structured] = await Promise.all([
      runner.generateText({
        model,
        prompt: 'Reply with a short greeting mentioning "Claude Code".',
        messages: [],
        abortSignal: abortController.signal,
        timeout: {
          description: 'Claude Code CLI smoke test',
          durationInMins: 2,
        },
      }),
      runner.generateConstrained({
        model,
        prompt:
          'Return JSON with a "note" property that references Claude Code CLI.',
        messages: [],
        schema,
        abortSignal: abortController.signal,
        timeout: {
          description: 'Claude Code CLI constrained smoke test',
          durationInMins: 2,
        },
      }),
    ]);
    console.log('[claude-code-cli] Text response:', text.text.trim());
    console.log('[claude-code-cli] Structured response:', structured.output);
    return { runner: 'claude-code-cli', skipped: false };
  } catch (error) {
    if (shouldSkipBecauseUnauthenticated(error)) {
      console.log(
        '[claude-code-cli] Skipping smoke test: CLI not authenticated.'
      );
      return { runner: 'claude-code-cli', skipped: true };
    }
    if (isModelNotFoundError(error)) {
      console.log(
        '[claude-code-cli] Skipping smoke test: requested model not available. Details:',
        getErrorMessage(error)
      );
      return { runner: 'claude-code-cli', skipped: true };
    }
    throw error;
  } finally {
    abortController.abort();
    await runner.dispose();
  }
}

async function main() {
  const tasks: Array<Promise<SmokeResult>> = [
    wrapWithLabel('codex-cli', runCodexSmoke),
    wrapWithLabel('gemini-cli', runGeminiSmoke),
    wrapWithLabel('claude-code-cli', runClaudeSmoke),
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

async function wrapWithLabel(
  label: string,
  fn: () => Promise<SmokeResult>
): Promise<SmokeResult> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[${label}] Smoke test failed:`, error);
    throw error;
  }
}

function shouldSkipBecauseUnauthenticated(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('invalid api key') ||
    message.includes('please run /login') ||
    message.includes('please run login') ||
    message.includes('run claude login') ||
    message.includes('not authenticated') ||
    message.includes('401 unauthorized')
  );
}

function isInvalidArgumentError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('unknown arguments') || message.startsWith('usage: gemini')
  );
}

function isEmptyResponseError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('empty response');
}

function isModelNotFoundError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('not_found_error') || message.includes('model:');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

main().catch((error) => {
  console.error('Smoke test runner failed unexpectedly:', error);
  process.exit(1);
});
