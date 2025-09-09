import { ChildProcess } from 'child_process';

export function killChildProcessGracefully(
  child: ChildProcess,
  timeoutInMs = 1000 * 10 // 10s
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Process already exited.
    if (child.exitCode !== null) {
      resolve();
    }

    // Watch for exiting, so that we can cancel the timeout(s) then.
    child.on('exit', () => {
      clearTimeout(sigkillTimeoutId);
      clearTimeout(rejectTimeoutId);
      resolve();
    });

    // Send SIGTERM
    child.kill('SIGTERM');
    // Start a timeout for the SIGKILL fallback
    const sigkillTimeoutId = setTimeout(
      () => child.kill('SIGKILL'),
      timeoutInMs
    );
    // Start another timeout to reject the promise if the child process never fires `exit` for some reasons.
    const rejectTimeoutId = setTimeout(
      () =>
        reject(
          new Error('Child process did not exit gracefully within the timeout.')
        ),
      timeoutInMs * 2
    );
  });
}
