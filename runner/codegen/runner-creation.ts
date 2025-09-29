import { UserFacingError } from '../utils/errors.js';
import type { GeminiCliRunner } from './gemini-cli/gemini-cli-runner.js';
import type { GenkitRunner } from './genkit/genkit-runner.js';
import type { CodexCliRunner } from './codex-cli/codex-cli-runner.js';
import type { ClaudeCodeCliRunner } from './claude-code-cli/claude-code-cli-runner.js';

interface AvailableRunners {
  genkit: GenkitRunner;
  'gemini-cli': GeminiCliRunner;
  'codex-cli': CodexCliRunner;
  'claude-code-cli': ClaudeCodeCliRunner;
}

/** Names of supported runners. */
export type RunnerName = keyof AvailableRunners;

/** Creates an `LlmRunner` based on a name. */
export async function getRunnerByName<T extends RunnerName>(
  name: T
): Promise<AvailableRunners[T]> {
  // Note that we lazily import and resolve the runners here, because their imports
  // might have side effects. E.g. Genkit installs a listener on the process exiting
  // in order to kill pending instances and log "Closing all Genkit instances".
  // We don't want to trigger those side effects unless we actually need them.
  switch (name) {
    case 'genkit':
      return import('./genkit/genkit-runner.js').then(
        (m) => new m.GenkitRunner() as AvailableRunners[T]
      );
    case 'gemini-cli':
      return import('./gemini-cli/gemini-cli-runner.js').then(
        (m) => new m.GeminiCliRunner() as AvailableRunners[T]
      );
    case 'codex-cli':
      return import('./codex-cli/codex-cli-runner.js').then(
        (m) => new m.CodexCliRunner() as AvailableRunners[T]
      );
    case 'claude-code-cli':
      return import('./claude-code-cli/claude-code-cli-runner.js').then(
        (m) => new m.ClaudeCodeCliRunner() as AvailableRunners[T]
      );
    default:
      throw new UserFacingError(`Unsupported runner ${name}`);
  }
}
