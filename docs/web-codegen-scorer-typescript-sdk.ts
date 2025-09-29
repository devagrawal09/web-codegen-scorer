/**
 * TypeScript SDK for Web Codegen Scorer CLI
 *
 * This module provides type-safe TypeScript functions to invoke the web-codegen-scorer
 * CLI tool programmatically instead of using shell commands.
 *
 * @packageDocumentation
 */

import { spawn, SpawnOptions } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const execPromise = promisify(execCallback);

/**
 * Base options common to all commands
 */
interface BaseOptions {
  /**
   * Working directory for command execution
   */
  cwd?: string;

  /**
   * Environment variables to pass to the CLI
   */
  env?: Record<string, string>;

  /**
   * Whether to inherit stdio (show output in console)
   * @default false
   */
  inheritStdio?: boolean;
}

/**
 * Result of a CLI command execution
 */
interface CommandResult {
  /**
   * Standard output from the command
   */
  stdout: string;

  /**
   * Standard error from the command
   */
  stderr: string;

  /**
   * Exit code (0 = success)
   */
  exitCode: number;

  /**
   * Whether the command succeeded (exitCode === 0)
   */
  success: boolean;
}

/**
 * Runner types for code generation
 */
type RunnerType = 'genkit' | 'gemini-cli' | 'codex-cli' | 'claude-code-cli';

/**
 * Logging types for evaluation progress
 */
type LoggingType = 'text-only' | 'dynamic';

/**
 * Options for the 'eval' command
 */
interface EvalOptions extends BaseOptions {
  /**
   * Path to environment configuration file or built-in environment name
   * @required
   */
  environment: string;

  /**
   * Model to use for code generation
   * @default 'gemini-2.0-flash-exp' (or runner-specific default)
   */
  model?: string;

  /**
   * Model to use for automatic code rating
   * @default 'gemini-2.0-flash-exp'
   */
  autoraterModel?: string;

  /**
   * Runner to execute the evaluation
   * @default 'genkit'
   */
  runner?: RunnerType;

  /**
   * Runner for autorater and AI summary (defaults to main runner)
   */
  autoraterRunner?: RunnerType;

  /**
   * Use locally-cached LLM output instead of calling LLM
   * @default false
   */
  local?: boolean;

  /**
   * Maximum number of apps to generate and assess
   * @default 5
   */
  limit?: number;

  /**
   * Maximum concurrent evaluations ('auto' or number)
   * @default 'auto'
   */
  concurrency?: number | 'auto';

  /**
   * Directory for generated code (for debugging)
   */
  outputDirectory?: string;

  /**
   * Filter which prompts to run by name
   */
  promptFilter?: string;

  /**
   * Name for generated report directory
   * @default timestamp
   */
  reportName?: string;

  /**
   * Metadata labels attached to the run
   */
  labels?: string[];

  /**
   * Start Model Context Protocol server for evaluation
   * @default false
   */
  mcp?: boolean;

  /**
   * Skip taking screenshots of generated apps
   * @default false
   */
  skipScreenshots?: boolean;

  /**
   * Skip generating AI summary for report
   * @default false
   */
  skipAiSummary?: boolean;

  /**
   * Skip Axe accessibility testing
   * @default false
   */
  skipAxeTesting?: boolean;

  /**
   * Enable user journey testing via browser automation
   * @default false
   */
  enableUserJourneyTesting?: boolean;

  /**
   * Include automatic hash-based CSP and Trusted Types
   * @default false
   */
  enableAutoCsp?: boolean;

  /**
   * Custom RAG endpoint URL (must contain 'PROMPT' substring)
   */
  ragEndpoint?: string;

  /**
   * Logging type during evaluation
   * @default 'dynamic' (or 'text-only' when CI=1)
   */
  logging?: LoggingType;
}

/**
 * Options for the 'run' command
 */
interface RunOptions extends BaseOptions {
  /**
   * Path to environment configuration file
   * @required
   */
  environment: string;

  /**
   * ID of the prompt to run
   * @required
   */
  prompt: string;
}

/**
 * Options for the 'report' command
 */
interface ReportOptions extends BaseOptions {
  /**
   * Path to read local reports from
   * @default '.web-codegen-scorer/reports'
   */
  reportsDirectory?: string;

  /**
   * Path to JavaScript file for loading remote reports
   */
  reportsLoader?: string;

  /**
   * Port for serving report UI
   * @default 4200
   */
  port?: number;
}

/**
 * Internal helper to execute CLI commands
 */
async function executeCommand(
  command: string,
  args: string[],
  options: BaseOptions = {}
): Promise<CommandResult> {
  const spawnOptions: SpawnOptions = {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: options.inheritStdio ? 'inherit' : 'pipe',
  };

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, spawnOptions);
    let stdout = '';
    let stderr = '';

    if (!options.inheritStdio) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        success: code === 0,
      });
    });
  });
}

/**
 * Build arguments array from options object
 */
function buildArgs(baseArgs: string[], options: Record<string, any>): string[] {
  const args = [...baseArgs];

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue;

    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();

    if (typeof value === 'boolean') {
      if (value) {
        args.push(`--${kebabKey}`);
      }
    } else if (Array.isArray(value)) {
      args.push(`--${kebabKey}`);
      args.push(...value);
    } else {
      args.push(`--${kebabKey}=${value}`);
    }
  }

  return args;
}

/**
 * Run code generation and quality assessment
 *
 * @example
 * ```typescript
 * const result = await evalCommand({
 *   environment: 'angular-example',
 *   model: 'gemini-2.5-flash',
 *   limit: 10,
 *   skipScreenshots: true,
 * });
 *
 * if (result.success) {
 *   console.log('Evaluation completed successfully');
 * }
 * ```
 */
export async function evalCommand(
  options: EvalOptions
): Promise<CommandResult> {
  const { environment, cwd, env, inheritStdio, ...cliOptions } = options;

  const args = buildArgs(['eval'], {
    environment,
    ...cliOptions,
  });

  return executeCommand('web-codegen-scorer', args, { cwd, env, inheritStdio });
}

/**
 * Run a previously evaluated application locally
 *
 * @example
 * ```typescript
 * const result = await run({
 *   environment: 'angular-example',
 *   prompt: 'todo-app',
 *   inheritStdio: true, // Show server output
 * });
 * ```
 */
export async function run(options: RunOptions): Promise<CommandResult> {
  const { environment, prompt, cwd, env, inheritStdio } = options;

  const args = buildArgs(['run'], { environment, prompt });

  return executeCommand('web-codegen-scorer', args, { cwd, env, inheritStdio });
}

/**
 * Launch interactive guide for creating a new evaluation environment
 *
 * Note: This is an interactive command, so inheritStdio is automatically set to true
 *
 * @example
 * ```typescript
 * await init({ cwd: './my-project' });
 * ```
 */
export async function init(options: BaseOptions = {}): Promise<CommandResult> {
  const { cwd, env } = options;

  return executeCommand('web-codegen-scorer', ['init'], {
    cwd,
    env,
    inheritStdio: true, // Always inherit for interactive prompts
  });
}

/**
 * Launch web UI to view and compare evaluation reports
 *
 * Note: This starts a long-running server, so the Promise won't resolve
 * until the server is stopped
 *
 * @example
 * ```typescript
 * await report({
 *   port: 8080,
 *   reportsDirectory: './my-reports',
 *   inheritStdio: true,
 * });
 * ```
 */
export async function report(
  options: ReportOptions = {}
): Promise<CommandResult> {
  const { cwd, env, inheritStdio, ...cliOptions } = options;

  const args = buildArgs(['report'], cliOptions);

  return executeCommand('web-codegen-scorer', args, { cwd, env, inheritStdio });
}

/**
 * Check if web-codegen-scorer CLI is installed
 *
 * @returns true if installed, false otherwise
 */
export async function isInstalled(): Promise<boolean> {
  try {
    await execPromise('which web-codegen-scorer');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the version of installed web-codegen-scorer CLI
 *
 * @returns version string or null if not installed
 */
export async function getVersion(): Promise<string | null> {
  try {
    const result = await executeCommand(
      'web-codegen-scorer',
      ['--version'],
      {}
    );
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Convenience class for chaining multiple operations
 *
 * @example
 * ```typescript
 * const scorer = new WebCodegenScorer({
 *   environment: './my-config.mjs',
 *   cwd: './my-project',
 * });
 *
 * // Run evaluation
 * await scorer.eval({
 *   model: 'gemini-2.5-flash',
 *   limit: 10,
 * });
 *
 * // Run specific prompt
 * await scorer.run({ prompt: 'todo-app' });
 *
 * // View reports
 * await scorer.report({ port: 8080 });
 * ```
 */
export class WebCodegenScorer {
  private defaultOptions: BaseOptions;
  private environment?: string;

  constructor(options: BaseOptions & { environment?: string } = {}) {
    const { environment, ...baseOptions } = options;
    this.defaultOptions = baseOptions;
    this.environment = environment;
  }

  /**
   * Run evaluation with default options
   */
  async eval(options: Partial<EvalOptions> = {}): Promise<CommandResult> {
    if (!this.environment && !options.environment) {
      throw new Error('Environment must be specified');
    }

    return evalCommand({
      ...this.defaultOptions,
      environment: this.environment!,
      ...options,
    } as EvalOptions);
  }

  /**
   * Run evaluated app with default options
   */
  async run(options: Omit<RunOptions, 'environment'>): Promise<CommandResult> {
    if (!this.environment) {
      throw new Error('Environment must be specified in constructor');
    }

    return run({
      ...this.defaultOptions,
      environment: this.environment,
      ...options,
    });
  }

  /**
   * Launch report viewer with default options
   */
  async report(options: ReportOptions = {}): Promise<CommandResult> {
    return report({
      ...this.defaultOptions,
      ...options,
    });
  }

  /**
   * Launch init wizard with default options
   */
  async init(): Promise<CommandResult> {
    return init(this.defaultOptions);
  }
}

/**
 * Export all types for external use
 */
export type {
  BaseOptions,
  CommandResult,
  RunnerType,
  LoggingType,
  EvalOptions,
  RunOptions,
  ReportOptions,
};

/**
 * Default export for convenience
 */
export default {
  evalCommand,
  run,
  init,
  report,
  isInstalled,
  getVersion,
  WebCodegenScorer,
};
