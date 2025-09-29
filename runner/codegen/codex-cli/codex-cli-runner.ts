import { ChildProcess, spawn } from 'child_process';
import assert from 'assert';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
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
import { getCodexAgentsFile } from './codex-files.js';
import { LlmResponseFile } from '../../shared-interfaces.js';

const DEFAULT_INACTIVITY_TIMEOUT_MINS = 2;
const DEFAULT_TOTAL_TIMEOUT_MINS = 15;

/** Runner that generates code using the Codex CLI. */
export class CodexCliRunner implements LlmRunner {
  readonly id = 'codex-cli';
  readonly displayName = 'Codex CLI';
  readonly hasBuiltInRepairLoop = true;

  private readonly pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private readonly pendingProcesses = new Set<ChildProcess>();
  private readonly binaryPath = this.resolveBinaryPath();
  private readonly evalIgnoredPatterns = [
    '**/node_modules/**',
    '**/.codex/**',
    '**/.codex-cache/**',
    '**/AGENTS.md',
    '**/.codex-last-message.txt',
  ];

  async generateFiles(
    options: LlmGenerateFilesRequestOptions
  ): Promise<LlmGenerateFilesResponse> {
    const { context, model } = options;

    assert(
      context.buildCommand,
      'Expected a `buildCommand` to be set when using the Codex CLI runner'
    );
    assert(
      context.packageManager,
      'Expected a `packageManager` to be set when using the Codex CLI runner'
    );

    const instructionsPath = join(context.directory, 'AGENTS.md');
    const lastMessagePath = join(context.directory, '.codex-last-message.txt');
    const codexHome = await mkdtemp(join(tmpdir(), 'codex-runner-'));
    const initialAgentsContent = existsSync(instructionsPath)
      ? await readFile(instructionsPath, 'utf8')
      : null;
    const instructionsContent = initialAgentsContent
      ? `${initialAgentsContent.trimEnd()}\n\n${getCodexAgentsFile(
          context.systemInstructions,
          context.buildCommand,
          context.packageManager
        )}\n`
      : getCodexAgentsFile(
          context.systemInstructions,
          context.buildCommand,
          context.packageManager
        );

    await writeFile(instructionsPath, instructionsContent, 'utf8');

    const initialSnapshot = await DirectorySnapshot.forDirectory(
      context.directory,
      this.evalIgnoredPatterns
    );

    let runOutput: { reasoning: string | null; stdout: string } | null = null;

    try {
      runOutput = await this.runCodexProcess(
        model,
        context,
        lastMessagePath,
        codexHome
      );
    } finally {
      if (initialAgentsContent === null) {
        await rm(instructionsPath, { force: true });
      } else {
        await writeFile(instructionsPath, initialAgentsContent, 'utf8');
      }

      await rm(lastMessagePath, { force: true });
      await rm(codexHome, { recursive: true, force: true });
    }

    const finalSnapshot = await DirectorySnapshot.forDirectory(
      context.directory,
      this.evalIgnoredPatterns
    );
    const diff = finalSnapshot.getChangedOrAddedFiles(initialSnapshot);
    const files: LlmResponseFile[] = [];

    for (const [absolutePath, code] of diff) {
      const relativePath = relative(context.directory, absolutePath);

      if (relativePath === 'AGENTS.md' || relativePath === '.codex-last-message.txt') {
        continue;
      }

      files.push({ filePath: relativePath, code });
    }

    const reasoning =
      runOutput?.reasoning && runOutput.reasoning.trim().length
        ? runOutput.reasoning.trim()
        : runOutput?.stdout ?? '';

    return { files, reasoning, toolLogs: [] };
  }

  generateText(): Promise<LlmGenerateTextResponse> {
    throw new UserFacingError(
      'Generating text with Codex CLI is not supported.'
    );
  }

  generateConstrained(): Promise<
    LlmConstrainedOutputGenerateResponse<any>
  > {
    throw new UserFacingError(
      'Constrained output with Codex CLI is not supported.'
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
      ? join(closestRoot, 'node_modules/.bin/codex')
      : null;

    if (!binaryPath || !existsSync(binaryPath)) {
      throw new UserFacingError('Codex CLI is not installed in this project');
    }

    return binaryPath;
  }

  private runCodexProcess(
    model: string,
    context: LlmGenerateFilesRequestOptions['context'],
    lastMessagePath: string,
    codexHome: string
  ): Promise<{ stdout: string; reasoning: string | null }> {
    return new Promise((resolve) => {
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let isDone = false;
      const msPerMin = 60_000;
      let inactivityTimeout: ReturnType<typeof setTimeout> | null = null;
      let globalTimeout: ReturnType<typeof setTimeout> | null = null;
      let childProcess: ChildProcess | null = null;

      const finalize = async (finalMessage: string) => {
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

        let reasoning: string | null = null;

        try {
          const lastMessage = await readFile(lastMessagePath, 'utf8');
          reasoning = lastMessage.trim() || null;
        } catch {
          reasoning = null;
        }

        resolve({ stdout: stdoutBuffer, reasoning });
      };

      const refreshInactivityTimer = () => {
        if (inactivityTimeout) {
          clearTimeout(inactivityTimeout);
          this.pendingTimeouts.delete(inactivityTimeout);
        }

        inactivityTimeout = setTimeout(() => {
          finalize(
            `Codex CLI produced no output for ${DEFAULT_INACTIVITY_TIMEOUT_MINS} minute(s). Stopping the process...`
          );
        }, DEFAULT_INACTIVITY_TIMEOUT_MINS * msPerMin);
        this.pendingTimeouts.add(inactivityTimeout);
      };

      refreshInactivityTimer();

      globalTimeout = setTimeout(() => {
        finalize(
          `Codex CLI did not finish within ${DEFAULT_TOTAL_TIMEOUT_MINS} minute(s). Stopping the process...`
        );
      }, DEFAULT_TOTAL_TIMEOUT_MINS * msPerMin);
      this.pendingTimeouts.add(globalTimeout);

      const args = [
        'exec',
        context.executablePrompt,
        '--model',
        model,
        '--sandbox',
        'workspace-write',
        '--full-auto',
        '--skip-git-repo-check',
        '--output-last-message',
        lastMessagePath,
      ];

      const spawnedProcess = spawn(this.binaryPath, args, {
        cwd: context.directory,
        env: {
          ...process.env,
          CODEX_HOME: codexHome,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
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
            ? 'Codex CLI process has exited.'
            : `Codex CLI process exited with code ${code}.`
        );
      });

      spawnedProcess.on('error', (err) => {
        finalize(`Failed to run Codex CLI: ${err.message}`);
      });
    });
  }
}
