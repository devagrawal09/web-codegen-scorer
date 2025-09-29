# Web Codegen Scorer - Documentation & TypeScript SDK

This package contains comprehensive documentation and a TypeScript SDK for the `web-codegen-scorer` CLI tool.

## Files Included

### 1. `web-codegen-scorer-cli-reference.md`

Complete CLI reference documentation covering:

- All 4 commands: `eval`, `run`, `init`, `report`
- Every command-line option with descriptions and examples
- Environment configuration guide
- Built-in ratings and model support
- Common workflows and debugging tips
- 70+ command-line flags documented

### 2. `web-codegen-scorer-typescript-sdk.ts`

Type-safe TypeScript SDK providing:

- Functions to invoke CLI commands programmatically
- Full TypeScript type definitions
- `WebCodegenScorer` class for object-oriented usage
- Helper functions: `isInstalled()`, `getVersion()`
- Promise-based API with proper error handling
- Support for all CLI options

### 3. `web-codegen-scorer-usage-examples.ts`

12 comprehensive examples demonstrating:

1. Basic evaluation
2. Advanced evaluation with custom options
3. Comparing multiple models
4. Local mode (cached results)
5. Debugging specific prompts
6. Using the WebCodegenScorer class
7. CI/CD pipeline integration
8. Initializing environments
9. Parallel evaluations
10. RAG-enhanced evaluation
11. Full feature evaluation
12. Error handling and retries

## Quick Start

### Using the CLI Reference

```bash
# View the comprehensive CLI documentation
cat web-codegen-scorer-cli-reference.md

# Example: Run basic evaluation
web-codegen-scorer eval --env=angular-example

# Example: Compare models
web-codegen-scorer eval --env=./config.mjs --model=gemini-2.5-flash --report-name=gemini
web-codegen-scorer eval --env=./config.mjs --model=claude-3-5-sonnet --report-name=claude
```

### Using the TypeScript SDK

```typescript
import { evalCommand, run, report } from './web-codegen-scorer-typescript-sdk';

// Run evaluation
const result = await evalCommand({
  environment: 'angular-example',
  model: 'gemini-2.5-flash',
  limit: 10,
});

if (result.success) {
  console.log('✓ Evaluation completed');
}

// Run evaluated app
await run({
  environment: 'angular-example',
  prompt: 'todo-app',
  inheritStdio: true,
});

// View reports
await report({ port: 4200 });
```

### Using the WebCodegenScorer Class

```typescript
import { WebCodegenScorer } from './web-codegen-scorer-typescript-sdk';

const scorer = new WebCodegenScorer({
  environment: './my-config.mjs',
  cwd: './my-project',
});

// Run evaluation
await scorer.eval({ model: 'gemini-2.5-flash', limit: 5 });

// Run app
await scorer.run({ prompt: 'contact-form' });

// View reports
await scorer.report({ port: 8080 });
```

## API Overview

### Main Functions

- **`evalCommand(options: EvalOptions)`** - Run code generation and quality assessment
- **`run(options: RunOptions)`** - Run a previously evaluated app locally
- **`init(options?: BaseOptions)`** - Interactive environment setup wizard
- **`report(options?: ReportOptions)`** - Launch web UI for viewing reports

### Helper Functions

- **`isInstalled()`** - Check if CLI is installed
- **`getVersion()`** - Get installed CLI version

### Type Definitions

```typescript
interface EvalOptions {
  environment: string; // Required
  model?: string;
  autoraterModel?: string;
  runner?: RunnerType;
  autoraterRunner?: RunnerType;
  local?: boolean;
  limit?: number;
  concurrency?: number | 'auto';
  outputDirectory?: string;
  promptFilter?: string;
  reportName?: string;
  labels?: string[];
  mcp?: boolean;
  skipScreenshots?: boolean;
  skipAiSummary?: boolean;
  skipAxeTesting?: boolean;
  enableUserJourneyTesting?: boolean;
  enableAutoCsp?: boolean;
  ragEndpoint?: string;
  logging?: LoggingType;
  // ... base options
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}
```

## Commands Reference

### eval - Evaluate Code

```bash
web-codegen-scorer eval --env=<path> [options]
```

**Required:**

- `--env=<path>` - Environment configuration

**Key Options:**

- `--model=<name>` - Model for code generation
- `--autorater-model=<name>` - Model for rating
- `--runner=<type>` - genkit | gemini-cli | codex-cli | claude-code-cli
- `--limit=<n>` - Max apps to generate (default: 5)
- `--concurrency=<n>` - Concurrent evals (default: auto)
- `--local` - Use cached LLM output
- `--prompt-filter=<name>` - Filter specific prompts
- `--output-dir=<path>` - Output directory for debugging
- `--report-name=<name>` - Custom report name
- `--labels=<label1> <label2>` - Metadata labels
- `--skip-screenshots` - Skip app screenshots
- `--skip-ai-summary` - Skip AI summary
- `--skip-axe-testing` - Skip accessibility testing
- `--enable-user-journey-testing` - Enable browser automation
- `--enable-auto-csp` - Enable CSP testing
- `--rag-endpoint=<url>` - Custom RAG endpoint
- `--mcp` - Start MCP server

### run - Run Evaluated App

```bash
web-codegen-scorer run --env=<path> --prompt=<name>
```

**Required:**

- `--env=<path>` - Environment configuration
- `--prompt=<name>` - Prompt ID to run

### init - Initialize Environment

```bash
web-codegen-scorer init
```

Interactive wizard for creating new environment.

### report - View Reports

```bash
web-codegen-scorer report [options]
```

**Options:**

- `--reports-directory=<path>` - Reports path (default: .web-codegen-scorer/reports)
- `--reports-loader=<path>` - Remote reports loader
- `--port=<n>` - Server port (default: 4200)

## Environment Configuration

Create a `config.mjs` file:

```javascript
import { getBuiltInRatings } from 'web-codegen-scorer';

export default {
  displayName: 'My Environment',
  clientSideFramework: 'react',
  sourceDirectory: './src',
  ratings: [...getBuiltInRatings()],
  generationSystemPrompt: './system-instructions.md',
  executablePrompts: ['./prompts/**/*.md'],

  // Optional
  packageManager: 'npm',
  buildCommand: 'npm run build',
  serveCommand: 'npm run start -- --port 0',
  // ... more options
};
```

## Common Workflows

### 1. Compare Models

```typescript
const models = ['gemini-2.5-flash', 'claude-3-5-sonnet', 'gpt-4'];

for (const model of models) {
  await evalCommand({
    environment: './config.mjs',
    model,
    reportName: `comparison-${model}`,
  });
}

await report({ port: 4200 });
```

### 2. Debug Prompt

```typescript
// Evaluate specific prompt
await evalCommand({
  environment: './config.mjs',
  promptFilter: 'todo-app',
  outputDirectory: './debug',
  skipScreenshots: true,
});

// Run locally
await run({
  environment: './config.mjs',
  prompt: 'todo-app',
  inheritStdio: true,
});
```

### 3. CI/CD Integration

```typescript
const result = await evalCommand({
  environment: './config.mjs',
  limit: 20,
  concurrency: 'auto',
  logging: 'text-only',
  reportName: `ci-${Date.now()}`,
  labels: ['ci', 'automated'],
});

if (!result.success) {
  process.exit(1);
}
```

## Supported Models

### Genkit (Default)

- **Gemini**: gemini-2.0-flash-exp, gemini-2.5-flash, gemini-2.5-pro
- **OpenAI**: gpt-4, gpt-4-turbo, gpt-3.5-turbo
- **Anthropic**: claude-3-5-sonnet, claude-3-opus
- **xAI**: grok-beta

### CLI Runners

- **gemini-cli**: Google Gemini CLI
- **codex-cli**: OpenAI Codex CLI (default: gpt-5-codex)
- **claude-code-cli**: Anthropic Claude Code (default: claude-4.5-sonnet)

## Built-in Environments

- `angular-example` - Angular application
- `solid-example` - SolidJS application
- `remote_env` - Remote environment

## Output Structure

```
.web-codegen-scorer/
├── llm-output/              # Cached LLM responses
│   └── <env-id>/
│       └── <prompt-name>/
└── reports/                 # Evaluation reports
    └── <report-name>/
        ├── report.json
        ├── summary.json
        └── screenshots/
```

## Installation

```bash
# Install globally
npm install -g web-codegen-scorer

# Or use locally
npm install web-codegen-scorer

# Verify installation
web-codegen-scorer --help
```

## API Keys Setup

```bash
export GEMINI_API_KEY="..."
export OPENAI_API_KEY="..."
export ANTHROPIC_API_KEY="..."
export XAI_API_KEY="..."
```

## Running Examples

```bash
# Run specific example
ts-node web-codegen-scorer-usage-examples.ts 1

# Available: 1-12
```

## Links

- **GitHub**: https://github.com/angular/web-codegen-scorer
- **NPM**: https://www.npmjs.com/package/web-codegen-scorer
- **Issues**: https://github.com/angular/web-codegen-scorer/issues

## Version

Current version: 0.0.10

## License

MIT - Built by the Angular team at Google
