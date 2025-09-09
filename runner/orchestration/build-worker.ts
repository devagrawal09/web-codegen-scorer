import { ChildProcess, fork } from 'child_process';
import path from 'path';
import {
  BuildResult,
  BuildResultStatus,
  BuildWorkerMessage,
  BuildWorkerResponseMessage,
} from '../builder/builder-types.js';
import { RootPromptDefinition } from '../shared-interfaces.js';
import { killChildProcessGracefully } from '../utils/kill-gracefully.js';
import { ProgressLogger } from '../progress/progress-logger.js';

/**
 * Attempts to build the code in a separate child process.
 *
 * @param buildParams The necessary config that describes which app needs to be built,
 *                    See `BuildWorkerMessage` docs for additional info.
 * @returns A Promise that resolves with the `BuildResult` once the build is complete.
 */
export function runBuild(
  buildParams: BuildWorkerMessage,
  rootPromptDef: RootPromptDefinition,
  progress: ProgressLogger
): Promise<BuildResult> {
  return new Promise<BuildResult>((resolve, reject) => {
    progress.log(
      rootPromptDef,
      'build',
      `Building the app`,
      `(pid: ${process.pid})`
    );

    const child: ChildProcess = fork(
      path.resolve(import.meta.dirname, '../builder/worker.js')
    );
    child.send(buildParams);

    child.on('message', async (result: BuildWorkerResponseMessage) => {
      if (result.type === 'build') {
        await killChildProcessGracefully(child);

        if (result.payload.status === BuildResultStatus.SUCCESS) {
          progress.log(rootPromptDef, 'success', 'Build is successful');
        } else {
          progress.log(
            rootPromptDef,
            'error',
            'Build has failed',
            result.payload.message
          );
        }
        resolve(result.payload);
      } else {
        progress.log(
          rootPromptDef,
          result.payload.state,
          result.payload.message,
          result.payload.details
        );
      }
    });
    child.on('error', async (err) => {
      await killChildProcessGracefully(child);
      progress.log(
        rootPromptDef,
        'error',
        `Error during build process`,
        err + ''
      );
      reject(err);
    });
  });
}
