/// <reference types="node"/>
import { join } from 'path';
import { rm, cp } from 'fs/promises';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { globSync as glob } from 'tinyglobby';
import { executeCommand } from './runner/utils/exec.js';

const root = import.meta.dirname;
const runnerSource = join(root, 'runner');
const targetDirectory = join(root, 'dist');
const reportAppSource = join(root, 'report-app');
const reportAppDist = join(reportAppSource, 'dist');
const browserAgentRelativePath = 'runner/testing/browser-agent';

const args = yargs(hideBin(process.argv))
  .option('runner-only', {
    type: 'boolean',
    default: false,
  })
  .parseSync();

(async () => {
  console.log('Building release output...');

  // Clear out the target directory.
  await rm(targetDirectory, { recursive: true, force: true });

  // Build the runner. This also creates `dist`.
  await executeCommand('pnpm build-runner', runnerSource, undefined, {
    forwardStderrToParent: true,
  });

  // Copy the package.json into `dist`.
  cp(join(root, 'package.json'), join(targetDirectory, 'package.json'));

  // Copy the readme.
  cp(join(root, 'README.md'), join(targetDirectory, 'README.md'));

  // Copy all the examples as is.
  glob('**/*', {
    cwd: join(root, 'examples'),
    dot: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.vinxi/**',
      '**/.output/**',
    ],
  }).forEach((agentFile) => {
    cp(
      join(root, 'examples', agentFile),
      join(targetDirectory, 'examples', agentFile)
    );
  });

  // The user journey testing requires various files to work.
  // Copy everything except the source TypeScript.
  glob('**/*', {
    cwd: join(root, browserAgentRelativePath),
    dot: true,
    ignore: ['*.ts', 'README.md'],
  }).forEach((agentFile) => {
    cp(
      join(root, browserAgentRelativePath, agentFile),
      join(targetDirectory, browserAgentRelativePath, agentFile)
    );
  });

  if (!args.runnerOnly) {
    // Build the report app and server.
    await executeCommand('pnpm build', reportAppSource, undefined, {
      forwardStderrToParent: true,
    });

    // Copy the report artifacts into the `dist`.
    await cp(reportAppDist, targetDirectory, { recursive: true });
  }

  console.log(`Release output has been built in ${targetDirectory}`);

  // TODO: also have `npm publish` here?
})();
