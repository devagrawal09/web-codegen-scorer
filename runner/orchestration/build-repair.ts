import PQueue from 'p-queue';
import {
  AttemptDetails,
  LlmContextFile,
  LlmResponse,
  LlmResponseFile,
  RootPromptDefinition,
} from '../shared-interfaces.js';
import {
  BuildResult,
  BuildWorkerMessage,
  RepairType,
} from '../builder/builder-types.js';
import { LlmRunner } from '../codegen/llm-runner.js';
import { Environment } from '../configuration/environment.js';
import { repairCodeWithAI } from './codegen.js';
import { writeResponseFiles } from './file-system.js';
import { runBuild } from './build-worker.js';
import { ProgressLogger } from '../progress/progress-logger.js';

/**
 * Calls the LLM to repair code, handles the response, and attempts to build the project again.
 *
 * @param llm The LlmRunner instance.
 * @param model The model name to use for the repair.
 * @param env The environment configuration.
 * @param rootPromptDef Definition of the root prompt.
 * @param directory The working directory.
 * @param finalOutputFiles The list of output files to be modified.
 * @param errorMessage The error message from the failed build.
 * @param errorContext Additional context for the error.
 * @param contextFiles A list of context files for the LLM.
 * @param abortSignal An AbortSignal to cancel the operation.
 * @param buildParams Parameters for the build worker.
 * @param workerConcurrencyQueue The queue for managing worker concurrency.
 * @param attemptDetails A log of build attempts.
 * @param attempts The current attempt number.
 * @param repairType The type of repair being performed.
 * @returns A promise that resolves to the new BuildResult.
 */
export async function repairAndBuild(
  llm: LlmRunner,
  model: string,
  env: Environment,
  rootPromptDef: RootPromptDefinition,
  directory: string,
  finalOutputFiles: LlmResponseFile[],
  errorMessage: string,
  errorContext: string,
  contextFiles: LlmContextFile[],
  abortSignal: AbortSignal,
  buildParams: BuildWorkerMessage,
  workerConcurrencyQueue: PQueue,
  attemptDetails: AttemptDetails[],
  attempts: number,
  progress: ProgressLogger,
  repairType: RepairType
): Promise<BuildResult> {
  const repairResponse = await repairCodeWithAI(
    llm,
    env,
    model,
    directory,
    finalOutputFiles,
    errorMessage,
    errorContext,
    rootPromptDef,
    contextFiles,
    abortSignal,
    progress
  );

  const buildResult = await handleRepairResponse(
    repairResponse,
    finalOutputFiles,
    env,
    rootPromptDef,
    directory,
    buildParams,
    workerConcurrencyQueue,
    attemptDetails,
    attempts,
    repairType,
    progress
  );

  return buildResult;
}

/**
 * Processes an LLM repair response by merging the suggested file changes,
 * writing them to disk, rebuilding the application, and logging the outcome.
 *
 * @param repairResponse The LLM response for the repair attempt.
 * @param finalOutputFiles The final output files to merge the repair into.
 * @param env The environment.
 * @param rootPromptName The name of the root prompt.
 * @param directory The directory to write the files to.
 * @param buildParams The build parameters.
 * @param workerConcurrencyQueue The worker concurrency queue.
 * @param attemptDetails The details of the attempts.
 * @param attempts The number of attempts that have been made.
 * @param repairType The type of repair being attempted.
 * @returns The build result.
 */
async function handleRepairResponse(
  repairResponse: LlmResponse,
  finalOutputFiles: LlmResponseFile[],
  env: Environment,
  rootPromptDef: RootPromptDefinition,
  directory: string,
  buildParams: BuildWorkerMessage,
  workerConcurrencyQueue: PQueue,
  attemptDetails: AttemptDetails[],
  attempts: number,
  repairType: RepairType,
  progress: ProgressLogger
): Promise<BuildResult> {
  if (!repairResponse.success) {
    progress.log(
      rootPromptDef,
      'error',
      `AI failed to generate a response for repair attempt #${attempts + 1}`
    );

    // Stop trying to repair if AI can't suggest a fix (API request fails)
    throw new Error(
      `Repair request failed: ${repairResponse.errors.join('\n')}`
    );
  }
  mergeRepairFiles(repairResponse.outputFiles, finalOutputFiles);
  writeResponseFiles(directory, finalOutputFiles, env, rootPromptDef.name);

  const buildResult = await workerConcurrencyQueue.add(
    () => runBuild(buildParams, rootPromptDef, progress),
    { throwOnTimeout: true }
  );

  attemptDetails.push({
    // Log the `outputFiles` from the repair response specifically, because
    // we want a snapshot after the current API call, not the full file set.
    outputFiles: repairResponse.outputFiles,
    usage: repairResponse.usage,
    reasoning: repairResponse.reasoning,
    buildResult,
    attempt: attempts,
  });

  return buildResult;
}

/**
 * Merges a set of new or updated files from a repair attempt into the
 * current set of files.
 * @param repairOutputFiles The array of new or updated files to merge.
 * @param finalFiles The array of files to be updated.
 */
function mergeRepairFiles(
  repairOutputFiles: LlmResponseFile[],
  finalFiles: LlmResponseFile[]
) {
  // Merge the repair response into the original files. Otherwise we may end up dropping
  // files that were valid in the initial response and the LLM decided not to touch, because
  // they're still valid.
  for (const file of repairOutputFiles) {
    const existingFile = finalFiles.find((f) => f.filePath === file.filePath);

    if (existingFile) {
      existingFile.code = file.code;
    } else {
      finalFiles.push(file);
    }
  }
}
