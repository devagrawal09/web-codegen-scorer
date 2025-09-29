import { ChildProcess, spawn } from 'child_process';

interface RunCliCommandOptions {
  binaryPath: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  abortSignal?: AbortSignal;
  inactivityTimeoutMs?: number;
  totalTimeoutMs?: number;
  pendingProcesses?: Set<ChildProcess>;
  pendingTimeouts?: Set<ReturnType<typeof setTimeout>>;
}

interface RunCliCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCliCommand(
  options: RunCliCommandOptions
): Promise<RunCliCommandResult> {
  if (options.abortSignal?.aborted) {
    throw new Error('Command execution aborted');
  }

  return await new Promise<RunCliCommandResult>((resolve, reject) => {
    const child = spawn(options.binaryPath, options.args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    options.pendingProcesses?.add(child);

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let finished = false;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    let totalTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
      if (timer !== null) {
        clearTimeout(timer);
        options.pendingTimeouts?.delete(timer);
      }
    };

    const finish = (err: Error | null, exitCode = 0) => {
      if (finished) {
        return;
      }
      finished = true;

      clearTimer(inactivityTimer);
      clearTimer(totalTimer);
      options.pendingProcesses?.delete(child);
      if (abortListener) {
        options.abortSignal?.removeEventListener('abort', abortListener);
      }

      if (err) {
        child.kill('SIGKILL');
        reject(err);
      } else {
        resolve({ stdout: stdoutBuffer, stderr: stderrBuffer, exitCode });
      }
    };

    const refreshInactivityTimer = () => {
      if (!options.inactivityTimeoutMs) {
        return;
      }
      clearTimer(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        finish(
          new Error(
            `Command timed out due to ${Math.round(
              options.inactivityTimeoutMs! / 1000
            )}s of inactivity.`
          )
        );
      }, options.inactivityTimeoutMs);
      options.pendingTimeouts?.add(inactivityTimer);
    };

    const abortListener = () => {
      finish(new Error('Command execution aborted'));
    };

    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', abortListener);
    }

    if (options.totalTimeoutMs) {
      totalTimer = setTimeout(() => {
        finish(
          new Error(
            `Command exceeded total timeout of ${Math.round(
              options.totalTimeoutMs! / 1000
            )}s.`
          )
        );
      }, options.totalTimeoutMs);
      options.pendingTimeouts?.add(totalTimer);
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      refreshInactivityTimer();
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
      refreshInactivityTimer();
    });

    child.on('error', (err) => {
      finish(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        finish(null, 0);
      } else {
        const message =
          stderrBuffer || stdoutBuffer || `Command exited with code ${code}`;
        finish(new Error(message));
      }
    });

    refreshInactivityTimer();
  });
}
