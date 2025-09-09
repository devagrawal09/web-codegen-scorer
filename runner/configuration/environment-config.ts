import z from 'zod';
import { createMessageBuilder, fromError } from 'zod-validation-error/v3';
import { ratingSchema } from '../ratings/rating-types.js';
import { mcpServerOptionsSchema } from '../codegen/llm-runner.js';
import { MultiStepPrompt } from './multi-step-prompt.js';
import { UserFacingError } from '../utils/errors.js';

const environmentConfigSchema = z.strictObject({
  /** Display name for the environment. */
  displayName: z.string(),
  /**
   * Optional unique ID for the environment.
   * If one isn't provided, it will be computed from the `displayName`.
   */
  id: z.string().optional(),
  /** ID of the client-side framework used within the environment. */
  clientSideFramework: z.string(),
  /** Ratings to run when evaluating the environment. */
  ratings: z.array(ratingSchema),
  /** Path to the prompt used by the LLM for generating files. */
  generationSystemPrompt: z.string(),
  /**
   * Path to the prompt used by the LLM for repairing builds or failures.
   *
   * If unset or `null`, the eval tool will use its default repair instructions.
   */
  repairSystemPrompt: z.union([z.string(), z.null()]).optional(),
  /**
   * Path to the prompt used by the LLM for editing.
   *
   * Prompts running after the initial generation are considered as editing (e.g. multi step prompts).
   * If `null`, the eval tool will use the generation prompt for edits.
   */
  editingSystemPrompt: z.union([z.string(), z.null()]).optional(),
  /** Prompts that should be sent to the LLM and written into the output. */
  executablePrompts: z.array(
    z.union([
      z.string(),
      z.strictObject({
        path: z.string(),
        name: z.string().optional(),
        ratings: z.array(ratingSchema).optional(),
      }),
      z.custom<MultiStepPrompt>((data) => data instanceof MultiStepPrompt),
    ])
  ),
  /** MCP servers that can be started for this environment. */
  mcpServers: z.array(mcpServerOptionsSchema).optional(),
  /** Relative path to the environment's source code in which to generate new code. */
  sourceDirectory: z.string().optional(),
  /**
   * Path to the template directory to use when creating
   * the project which the LLM will run against.
   */
  projectTemplate: z.string().optional(),
  /** Package manager to use for the eval. */
  packageManager: z.enum(getPossiblePackageManagers()).optional(),
  /**
   * Command to run when building the generated code.
   * Defaults to `<package manager> run build`.
   */
  buildCommand: z.string().optional(),
  /**
   * Command to run when starting a development server inside the app.
   * Defaults to `<package manager> run start --port 0`.
   */
  serveCommand: z.string().optional(),
  /**
   * Whether to skip installing dependencies when running evals in the environment.
   * Useful if you're managing dependencies yourself.
   */
  skipInstall: z.boolean().optional(),
  /**
   * ID of the fullstack framework used within the environment.
   * If omittied, it will default to the `clientSideFramework`.
   */
  fullStackFramework: z.string().optional(),
  /** Path to the prompt to use when rating code. */
  codeRatingPrompt: z.string().optional(),
  /** When enabled, the system prompts for this environment won't be included in the report. */
  classifyPrompts: z.boolean().optional(),
});

/**
 * Shape of the object that configures an individual evaluation environment. Not intended to direct
 * reads, interact with the information through the `Environment` class.
 */
export type EnvironmentConfig = z.infer<typeof environmentConfigSchema>;

/** Package managers that are currently supported. */
export function getPossiblePackageManagers() {
  return ['npm', 'pnpm', 'yarn'] as const;
}

/** Asserts that the specified data is a valid environment config. */
export function assertIsEnvironmentConfig(
  value: unknown
): asserts value is EnvironmentConfig {
  const validationResult = environmentConfigSchema.safeParse(value);

  if (!validationResult.success) {
    // TODO: we can use `z.prettifyError` once we update to zod v4,
    // but last time the update caused some issues with Genkit.
    const message = fromError(validationResult.error, {
      messageBuilder: createMessageBuilder({
        prefix: 'Environment parsing failed:',
        prefixSeparator: '\n',
        issueSeparator: '\n',
      }),
    }).toString();

    throw new UserFacingError(message);
  }
}
