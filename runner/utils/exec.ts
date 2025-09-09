import { exec } from 'node:child_process';

/**
 * Runs a command in a specific directory.
 * @param command Command that should be run.
 * @param directory Directory in which to run the command.
 * @param environmentVariables Environment variables that should be passed to the command.
 */
export function executeCommand(
  command: string,
  directory: string,
  environmentVariables: Record<string, string> = {},
  opts: {
    forwardStderrToParent?: boolean;
    forwardStdoutToParent?: boolean;
    abortSignal?: AbortSignal;
  } = {}
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = exec(command, {
      cwd: directory,
      env: {
        ...process.env,
        ...environmentVariables,
      },
      signal: opts.abortSignal,
    });

    let stdout = '';
    let stderr = '';

    proc.on('error', (err) => {
      reject(err);
    });

    proc.stdout!.on('data', (c) => {
      stdout += c;
      if (opts.forwardStdoutToParent) {
        process.stdout.write(c);
      }
    });
    proc.stderr!.on('data', (c) => {
      stderr += c;
      if (opts.forwardStderrToParent) {
        process.stderr.write(c);
      }
    });

    proc.on('close', (code, signal) => {
      if (code !== 0 || signal !== null) {
        reject(new Error(stderr || stdout));
      } else {
        resolve(stdout);
      }
    });
  });
}
