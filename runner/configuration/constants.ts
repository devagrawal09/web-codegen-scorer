import { join } from 'path';

// Extracted out for convenience, do NOT export.
const rootDir = join(process.cwd(), '.web-codegen-scorer');

/** Name of the root folder where we store LLM-generated code for debugging */
export const LLM_OUTPUT_DIR = join(rootDir, 'llm-output');

/**
 * Number of times we'll try to ask LLM to repair a build failure,
 * providing the build output and the code that causes the problem.
 */
export const DEFAULT_MAX_REPAIR_ATTEMPTS = 1;

/** Name of the folder where we store all generated reports */
export const REPORTS_ROOT_DIR = join(rootDir, 'reports');

/**
 * Current version of the report. Used to account for changes in the report shape.
 * MUST be kept in sync with `RunInfo.version`.
 */
export const REPORT_VERSION = 3;

/** Environments that are shipped together with the eval tool. */
export const BUILT_IN_ENVIRONMENTS = new Map<string, string>([
  [
    'angular-example',
    join(import.meta.dirname, '../../examples/environments/angular/config.js'),
  ],
  [
    'solid-example',
    join(import.meta.dirname, '../../examples/environments/solid/config.js'),
  ],
]);
