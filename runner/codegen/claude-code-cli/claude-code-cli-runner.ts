import { ChildProcess, spawn } from 'child_process';
import assert from 'assert';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { join, relative } from 'path';
import { tmpdir } from 'os';
import {
  LlmConstrainedOutputGenerateResponse,
  LlmGenerateFilesRequestOptions,
  LlmGenerateFilesResponse,
  LlmGenerateTextResponse,
  LlmRunner,
} from '../llm-runner.js';
import { UserFacingError } from '../../utils/errors.js';
import { DirectorySnapshot } from '../gemini-cli/directory-snapshot.js';
import { getClaudeAutomationPrompt } from './claude-code-files.js';
import { LlmResponseFile } from '../../shared-interfaces.js';

const DEFAULT_INACTIVITY_TIMEOUT_MINS = 2;
const DEFAULT_TOTAL_TIMEOUT_MINS = 15;

/** Runner that generates code using the Claude Code CLI. */
export class ClaudeCodeCliRunner implements LlmRunner {
  readonly id = 'claude-code-cli';
  readonly displayName = 'Claude Code CLI';
  readonly hasBuiltInRepairLoop = true;

  private readonly pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private readonly pendingProcesses = new Set<ChildProcess>();
  private readonly binaryPath = this.resolveBinaryPath();
  private readonly evalIgnoredPatterns = [
    '**/node_modules/**',
    '**/.claude/**',
    '**/.anthropic/**',
    '**/.cache/**',
    '**/.claude-code/**',
  ];

  async generateFiles(
    options: LlmGenerateFilesRequestOptions
  ): Promise<LlmGenerateFilesResponse> {
    const { context, model } = options;

    assert(
      context.buildCommand,
      'Expected a `buildCommand` to be set when using the Claude Code CLI runner'
    );
    assert(
      context.packageManager,
      'Expected a `packageManager` to be set when using the Claude Code CLI runner'
    );

    const automationPrompt = getClaudeAutomationPrompt(
      context.systemInstructions,
      context.buildCommand,
      context.packageManager
    );

    const initialSnapshot = await DirectorySnapshot.forDirectory(
      context.directory,
      this.evalIgnoredPatterns
    );

    const claudeHome = await mkdtemp(join(tmpdir(), 'claude-code-runner-'));
    let runOutput: { stdout: string } | null = null;

    try {
      runOutput = await this.runClaudeProcess(
        model,
        context,
        automationPrompt,
        claudeHome
      );
    } finally {
      await rm(claudeHome, { recursive: true, force: true });
    }

    const finalSnapshot = await DirectorySnapshot.forDirectory(
      context.directory,
      this.evalIgnoredPatterns
    );
    const diff = finalSnapshot.getChangedOrAddedFiles(initialSnapshot);
    const files: LlmResponseFile[] = [];

    for (const [absolutePath, code] of diff) {
      files.push({
        filePath: relative(context.directory, absolutePath),
        code,
      });
    }

    const reasoning = runOutput?.stdout.trim() ?? '';

    return { files, reasoning, toolLogs: [] };
  }

  generateText(): Promise<LlmGenerateTextResponse> {
    throw new UserFacingError(
      'Generating text with Claude Code CLI is not supported.'
    );
  }

  generateConstrained(): Promise<
    LlmConstrainedOutputGenerateResponse<any>
  > {
    throw new UserFacingError(
      'Constrained output with Claude Code CLI is not supported.'
    );
  }

  getSupportedModels(): string[] {
    return [];
  }

  async dispose(): Promise<void> {
    for (const timeout of this.pendingTimeouts) {
      clearTimeout(timeout);
    }

    for (const childProcess of this.pendingProcesses) {
      childProcess.kill('SIGKILL');
    }

    this.pendingTimeouts.clear();
    this.pendingProcesses.clear();
  }

  private resolveBinaryPath(): string {
    let dir = import.meta.dirname;
    let closestRoot: string | null = null;

    while (dir.length > 1) {
      if (existsSync(join(dir, 'node_modules'))) {
        closestRoot = dir;
        break;
      }

      const parent = join(dir, '..');

      if (parent === dir) {
        break;
      }

      dir = parent;
    }

    const binaryPath = closestRoot
      ? join(closestRoot, 'node_modules/.bin/claude')
      : null;

    if (!binaryPath || !existsSync(binaryPath)) {
      throw new UserFacingError('Claude Code CLI is not installed in this project');
    }

    return binaryPath;
  }

  private runClaudeProcess(
    model: string,
    context: LlmGenerateFilesRequestOptions['context'],
    automationPrompt: string,
    claudeHome: string
  ): Promise<{ stdout: string }> {
    return new Promise((resolve) => {
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let isDone = false;
      const msPerMin = 60_000;
      let inactivityTimeout: ReturnType<typeof setTimeout> | null = null;
      let globalTimeout: ReturnType<typeof setTimeout> | null = null;
      let childProcess: ChildProcess | null = null;

      const finalize = (finalMessage: string) => {
        if (isDone) {
          return;
        }

        isDone = true;

        if (inactivityTimeout) {
          clearTimeout(inactivityTimeout);
          this.pendingTimeouts.delete(inactivityTimeout);
        }

        if (globalTimeout) {
          clearTimeout(globalTimeout);
          this.pendingTimeouts.delete(globalTimeout);
        }

        if (childProcess) {
          childProcess.kill('SIGKILL');
          this.pendingProcesses.delete(childProcess);
        }

        if (stderrBuffer.length > 0) {
          stdoutBuffer += `\n----- stderr -----\n${stderrBuffer}`;
        }

        stdoutBuffer += `\n${finalMessage}`;

        resolve({ stdout: stdoutBuffer });
      };

      const refreshInactivityTimer = () => {
        if (inactivityTimeout) {
          clearTimeout(inactivityTimeout);
          this.pendingTimeouts.delete(inactivityTimeout);
        }

        inactivityTimeout = setTimeout(() => {
          finalize(
            `Claude Code CLI produced no output for ${DEFAULT_INACTIVITY_TIMEOUT_MINS} minute(s). Stopping the process...`
          );
        }, DEFAULT_INACTIVITY_TIMEOUT_MINS * msPerMin);
        this.pendingTimeouts.add(inactivityTimeout);
      };

      refreshInactivityTimer();

      globalTimeout = setTimeout(() => {
        finalize(
          `Claude Code CLI did not finish within ${DEFAULT_TOTAL_TIMEOUT_MINS} minute(s). Stopping the process...`
        );
      }, DEFAULT_TOTAL_TIMEOUT_MINS * msPerMin);
      this.pendingTimeouts.add(globalTimeout);

      const args = [
        '--print',
        '--output-format',
        'text',
        '--permission-mode',
        'bypassPermissions',
        '--dangerously-skip-permissions',
        '--model',
        model,
        '--append-system-prompt',
        automationPrompt,
        context.executablePrompt,
      ];

      const spawnedProcess = spawn(this.binaryPath, args, {
        cwd: context.directory,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
          CLAUDE_CODE_DISABLE_AUTOUPDATE: '1',
          CLAUDE_CODE_DATA_DIR: claudeHome,
        },
      });

      childProcess = spawnedProcess;
      this.pendingProcesses.add(spawnedProcess);

      spawnedProcess.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
        refreshInactivityTimer();
      });

      spawnedProcess.stderr.on('data', (data) => {
        stderrBuffer += data.toString();
      });

      spawnedProcess.on('close', (code) => {
        finalize(
          code == null
            ? 'Claude Code CLI process has exited.'
            : `Claude Code CLI process exited with code ${code}.`
        );
      });

      spawnedProcess.on('error', (err) => {
        finalize(`Failed to run Claude Code CLI: ${err.message}`);
      });
    });
  }
}
