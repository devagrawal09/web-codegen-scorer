import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PromptDataMessage } from '../llm-runner.js';

export function buildPromptFromMessages(
  messages: PromptDataMessage[] | undefined,
  prompt: string
): string {
  const segments: string[] = [];

  for (const message of messages ?? []) {
    const contentSegments: string[] = [];
    for (const part of message.content) {
      if ('text' in part) {
        if (part.text.trim().length) {
          contentSegments.push(part.text.trim());
        }
      } else {
        const description = part.media.url
          ? `Image provided: ${part.media.url}`
          : 'Image provided (no URL).';
        contentSegments.push(description);
      }
    }
    if (contentSegments.length) {
      segments.push(contentSegments.join('\n'));
    }
  }

  if (prompt.trim().length) {
    segments.push(prompt.trim());
  }

  return segments.join('\n\n').trim();
}

export function schemaToPrettyJson(schema: z.ZodTypeAny): string {
  const jsonSchema = zodToJsonSchema(schema as any, 'Response');
  const definition =
    (jsonSchema.definitions && jsonSchema.definitions['Response']) || jsonSchema;
  const objectSchema = definition && typeof definition === 'object'
    ? definition
    : jsonSchema;
  return JSON.stringify(objectSchema, null, 2);
}

export function buildSchemaFollowUpPrompt(options: {
  basePrompt: string;
  schemaJson: string;
  attempt: number;
  previousOutput?: string;
  validationError?: string;
}): string {
  const instructions: string[] = [];

  if (options.basePrompt.trim().length) {
    instructions.push(options.basePrompt.trim());
  }

  instructions.push(
    'Respond with a JSON document that strictly conforms to the following JSON schema. Return JSON only, with no commentary or code fences.',
    options.schemaJson
  );

  if (options.attempt > 0) {
    if (options.previousOutput) {
      const sanitizedOutput = truncate(options.previousOutput.trim(), 2000);
      instructions.push(
        'The previous response was invalid. Here is the previous output:',
        sanitizedOutput
      );
    }
    if (options.validationError) {
      instructions.push(
        'Validation errors:',
        truncate(options.validationError.trim(), 2000)
      );
    }
    instructions.push('Please fix the issues and output valid JSON that matches the schema.');
  }

  return instructions.join('\n\n').trim();
}

export function parseJsonFromText(raw: string):
  | { success: true; data: unknown; raw: string }
  | { success: false; error: string } {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { success: false, error: 'Empty response.' };
  }

  const candidates: string[] = [];

  if (trimmed.startsWith('```')) {
    const fenceEnd = trimmed.indexOf('```', 3);
    if (fenceEnd !== -1) {
      const fenced = trimmed.slice(3, fenceEnd);
      const fenceContent = fenced.replace(/^json\n/i, '');
      candidates.push(fenceContent.trim());
    }
  }

  candidates.push(trimmed);

  const jsonSubstring = extractFirstJsonSubstring(trimmed);
  if (jsonSubstring) {
    candidates.push(jsonSubstring);
  }

  let lastError = 'Unable to parse JSON.';

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate);
      return { success: true, data, raw: candidate };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    success: false,
    error: `Failed to parse JSON. Last parser error: ${lastError}`,
  };
}

export function validateJsonAgainstSchema(
  schema: z.ZodTypeAny,
  raw: string
):
  | { success: true; data: unknown; raw: string }
  | { success: false; error: string; raw?: string } {
  const parsed = parseJsonFromText(raw);

  if (!parsed.success) {
    return parsed;
  }

  const result = schema.safeParse(parsed.data);
  if (result.success) {
    return { success: true, data: result.data, raw: parsed.raw };
  }

  return {
    success: false,
    error: formatZodIssues(result.error.issues),
    raw: parsed.raw,
  };
}

function formatZodIssues(issues: z.ZodIssue[]): string {
  if (!issues.length) {
    return 'Unknown validation error.';
  }

  return issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '<root>';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

function extractFirstJsonSubstring(text: string): string | null {
  const length = text.length;
  let start = -1;
  const stack: string[] = [];
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString) {
      if (char === '\\') {
        escaped = true;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{' || char === '[') {
      if (stack.length === 0) {
        start = i;
      }
      stack.push(char);
      continue;
    }

    if (char === '}' || char === ']') {
      if (!stack.length) {
        continue;
      }
      const last = stack.pop();
      if (!last || !matchesBracket(last, char)) {
        return null;
      }
      if (stack.length === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function matchesBracket(open: string, close: string): boolean {
  return (open === '{' && close === '}') || (open === '[' && close === ']');
}
