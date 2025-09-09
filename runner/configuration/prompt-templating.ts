import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import path from 'path';
import { UserFacingError } from '../utils/errors.js';

function initializeHandlebars() {
  Handlebars.registerHelper('neq', (a, b) => a !== b);
  Handlebars.registerPartial(
    'embed',
    (ctx: { rootDir: string | null; file?: string }) => {
      if (!ctx.file) {
        throw new UserFacingError('file= is required');
      }
      if (!ctx.rootDir) {
        throw new UserFacingError(
          'Cannot use `embed` if a rootDir is not specified'
        );
      }

      const fullPath = path.join(ctx.rootDir, ctx.file);
      const content = readFileSync(fullPath, 'utf8');

      // Recursively support `embed`.
      return Handlebars.compile(content, { strict: true })({
        ...ctx,
        rootDir: path.dirname(fullPath),
      });
    }
  );
}

initializeHandlebars();

/** Renders the given content via Handlebars. */
export function renderHandlebarsTemplate<T extends { rootDir: string | null }>(
  content: string,
  ctx: T
): string {
  const template = Handlebars.compile(content, { strict: true });
  return template(ctx);
}

/**
 * Extracts the context file patterns from a prompt's text. Returns the prompt's text without
 * any special context file syntax and the context file patterns.
 * @param initialPromptText Initial text of the prompt.
 */
export function extractPromptContextFilePatterns(initialPromptText: string) {
  const contextFiles: string[] = [];
  const promptText = Handlebars.compile(initialPromptText, {
    strict: true,
  })(null, {
    partials: {
      contextFiles: (ctx) => {
        if (typeof ctx !== 'string') {
          throw new UserFacingError(
            '`contextFiles` must receive a comma-separated list of file patterns, ' +
              "for example: `{{> contextFiles '**/*.ts, **/*.css, **/*.html' }}`"
          );
        }

        if (contextFiles.length > 0) {
          throw new UserFacingError(
            'There can be only one usage of `contextFiles` per prompt. ' +
              'Combine your usages into a single comma-separated string.'
          );
        }

        contextFiles.push(
          ...ctx
            .trim()
            .split(',')
            .map((p) => p.trim())
        );

        if (contextFiles.length === 0) {
          throw new UserFacingError('`contextFiles` cannot be empty.');
        }

        // Return an empty string to remove the context file syntax from the result.
        return '';
      },
    },
  });

  return {
    promptText,
    contextFiles,
  };
}
