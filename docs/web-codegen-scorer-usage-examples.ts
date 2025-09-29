/**
 * Usage Examples for Web Codegen Scorer TypeScript SDK
 *
 * This file demonstrates various ways to use the TypeScript SDK
 * to invoke web-codegen-scorer CLI functionality.
 */

import {
  evalCommand,
  run as runCommand,
  init as initCommand,
  report as reportCommand,
  isInstalled,
  getVersion,
  WebCodegenScorer,
  type EvalOptions,
  type CommandResult,
} from './web-codegen-scorer-typescript-sdk';

// ============================================================================
// Example 1: Basic Evaluation
// ============================================================================

async function example1_basicEval() {
  console.log('Example 1: Basic Evaluation');

  const result = await evalCommand({
    environment: 'angular-example',
  });

  if (result.success) {
    console.log('✓ Evaluation completed successfully');
    console.log(result.stdout);
  } else {
    console.error('✗ Evaluation failed');
    console.error(result.stderr);
  }
}

// ============================================================================
// Example 2: Advanced Evaluation with Custom Options
// ============================================================================

async function example2_advancedEval() {
  console.log('Example 2: Advanced Evaluation');

  const result = await evalCommand({
    environment: './my-environment/config.mjs',
    model: 'gemini-2.5-flash',
    autoraterModel: 'gemini-2.5-pro',
    limit: 10,
    concurrency: 3,
    reportName: 'experiment-baseline',
    labels: ['baseline', 'v1.0'],
    skipScreenshots: false,
    enableUserJourneyTesting: true,
    outputDirectory: './debug-output',
    inheritStdio: true, // Show progress in real-time
  });

  console.log(`Exit code: ${result.exitCode}`);
}

// ============================================================================
// Example 3: Compare Multiple Models
// ============================================================================

async function example3_compareModels() {
  console.log('Example 3: Comparing Models');

  const models = [
    { name: 'gemini-2.5-flash', label: 'gemini-flash' },
    { name: 'claude-3-5-sonnet', label: 'claude-sonnet' },
    { name: 'gpt-4', label: 'gpt4' },
  ];

  const baseConfig: EvalOptions = {
    environment: './my-config.mjs',
    limit: 5,
    concurrency: 2,
  };

  for (const model of models) {
    console.log(`\nEvaluating with ${model.name}...`);

    const result = await evalCommand({
      ...baseConfig,
      model: model.name,
      reportName: `model-comparison-${model.label}`,
      labels: ['comparison', model.label],
    });

    if (result.success) {
      console.log(`✓ ${model.name} completed`);
    } else {
      console.error(`✗ ${model.name} failed`);
    }
  }

  // View comparative reports
  await reportCommand({ port: 4200, inheritStdio: true });
}

// ============================================================================
// Example 4: Local Mode (Reuse Cached Results)
// ============================================================================

async function example4_localMode() {
  console.log('Example 4: Local Mode');

  // First run: Generate and cache results
  await evalCommand({
    environment: 'angular-example',
    limit: 3,
    reportName: 'initial-run',
  });

  // Subsequent runs: Reuse cached LLM outputs
  // Useful for testing different rating configurations without LLM costs
  await evalCommand({
    environment: 'angular-example',
    local: true, // Uses cached outputs
    reportName: 'refined-ratings',
  });
}

// ============================================================================
// Example 5: Debug Specific Prompt
// ============================================================================

async function example5_debugPrompt() {
  console.log('Example 5: Debug Specific Prompt');

  // Run evaluation for specific prompt only
  const evalResult = await evalCommand({
    environment: './config.mjs',
    promptFilter: 'todo-app',
    outputDirectory: './debug-todo-app',
    skipScreenshots: true,
    limit: 1,
  });

  if (evalResult.success) {
    // Run the generated app locally
    await runCommand({
      environment: './config.mjs',
      prompt: 'todo-app',
      inheritStdio: true,
    });
  }
}

// ============================================================================
// Example 6: Using the WebCodegenScorer Class
// ============================================================================

async function example6_usingClass() {
  console.log('Example 6: Using WebCodegenScorer Class');

  const scorer = new WebCodegenScorer({
    environment: './my-config.mjs',
    cwd: './my-project',
    env: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    },
  });

  // Run evaluation
  const evalResult = await scorer.eval({
    model: 'gemini-2.5-flash',
    limit: 5,
    reportName: 'class-example',
  });

  if (evalResult.success) {
    // Run a specific evaluated app
    await scorer.run({
      prompt: 'contact-form',
      inheritStdio: true,
    });

    // View reports
    await scorer.report({ port: 8080 });
  }
}

// ============================================================================
// Example 7: Automated CI/CD Pipeline
// ============================================================================

async function example7_cicdPipeline() {
  console.log('Example 7: CI/CD Pipeline');

  // Check if CLI is installed
  if (!(await isInstalled())) {
    console.error('web-codegen-scorer is not installed');
    process.exit(1);
  }

  const version = await getVersion();
  console.log(`Using web-codegen-scorer version: ${version}`);

  // Run evaluation with CI-friendly settings
  const result = await evalCommand({
    environment: './config.mjs',
    model: 'gemini-2.5-flash',
    limit: 20,
    concurrency: 'auto',
    reportName: `ci-run-${Date.now()}`,
    labels: ['ci', 'automated', process.env.GIT_BRANCH || 'main'],
    logging: 'text-only', // Better for CI logs
    skipScreenshots: false,
    enableUserJourneyTesting: true,
    env: {
      CI: '1',
    },
  });

  if (!result.success) {
    console.error('Evaluation failed in CI');
    process.exit(1);
  }

  console.log('✓ CI evaluation passed');
}

// ============================================================================
// Example 8: Initialize New Environment Programmatically
// ============================================================================

async function example8_initEnvironment() {
  console.log('Example 8: Initialize Environment');

  // Note: init() is interactive, so it will prompt user for input
  await initCommand({
    cwd: './new-project',
  });
}

// ============================================================================
// Example 9: Parallel Evaluation of Multiple Configurations
// ============================================================================

async function example9_parallelEvals() {
  console.log('Example 9: Parallel Evaluations');

  const configurations = [
    {
      environment: './env-react/config.mjs',
      model: 'gemini-2.5-flash',
      reportName: 'react-gemini',
    },
    {
      environment: './env-angular/config.mjs',
      model: 'gemini-2.5-flash',
      reportName: 'angular-gemini',
    },
    {
      environment: './env-vue/config.mjs',
      model: 'claude-3-5-sonnet',
      reportName: 'vue-claude',
    },
  ];

  // Run all evaluations in parallel
  const results = await Promise.allSettled(
    configurations.map((config) => evalCommand(config))
  );

  // Check results
  results.forEach((result, index) => {
    const config = configurations[index];
    if (result.status === 'fulfilled' && result.value.success) {
      console.log(`✓ ${config.reportName} succeeded`);
    } else {
      console.error(`✗ ${config.reportName} failed`);
    }
  });
}

// ============================================================================
// Example 10: Custom RAG-Enhanced Evaluation
// ============================================================================

async function example10_ragEvaluation() {
  console.log('Example 10: RAG-Enhanced Evaluation');

  const result = await evalCommand({
    environment: './config.mjs',
    model: 'gemini-2.5-flash',
    ragEndpoint: 'http://localhost:8080/rag?query=PROMPT',
    limit: 5,
    reportName: 'rag-enhanced',
    labels: ['rag', 'experimental'],
  });

  console.log(result.success ? '✓ Success' : '✗ Failed');
}

// ============================================================================
// Example 11: Full Feature Evaluation
// ============================================================================

async function example11_fullFeatures() {
  console.log('Example 11: Full Feature Evaluation');

  const result = await evalCommand({
    environment: './config.mjs',
    model: 'gemini-2.5-flash',
    autoraterModel: 'gemini-2.5-pro',
    runner: 'genkit',
    autoraterRunner: 'genkit',
    limit: 10,
    concurrency: 5,
    outputDirectory: './output',
    reportName: 'full-features',
    labels: ['comprehensive', 'all-features'],
    mcp: true,
    skipScreenshots: false,
    skipAiSummary: false,
    skipAxeTesting: false,
    enableUserJourneyTesting: true,
    enableAutoCsp: true,
    logging: 'dynamic',
    inheritStdio: true,
  });

  if (result.success) {
    console.log('✓ Full feature evaluation completed');
  }
}

// ============================================================================
// Example 12: Error Handling and Retries
// ============================================================================

async function example12_errorHandling() {
  console.log('Example 12: Error Handling');

  const maxRetries = 3;
  let attempt = 0;
  let result: CommandResult | null = null;

  while (attempt < maxRetries) {
    attempt++;
    console.log(`Attempt ${attempt}/${maxRetries}...`);

    try {
      result = await evalCommand({
        environment: './config.mjs',
        model: 'gemini-2.5-flash',
        limit: 5,
        reportName: `attempt-${attempt}`,
      });

      if (result.success) {
        console.log('✓ Success!');
        break;
      } else {
        console.warn(`Attempt ${attempt} failed, retrying...`);
      }
    } catch (error) {
      console.error(`Error on attempt ${attempt}:`, error);
    }

    // Wait before retry
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  if (!result?.success) {
    console.error('✗ All attempts failed');
    process.exit(1);
  }
}

// ============================================================================
// Main execution (run examples)
// ============================================================================

async function main() {
  const examples = {
    '1': example1_basicEval,
    '2': example2_advancedEval,
    '3': example3_compareModels,
    '4': example4_localMode,
    '5': example5_debugPrompt,
    '6': example6_usingClass,
    '7': example7_cicdPipeline,
    '8': example8_initEnvironment,
    '9': example9_parallelEvals,
    '10': example10_ragEvaluation,
    '11': example11_fullFeatures,
    '12': example12_errorHandling,
  };

  const exampleNumber = process.argv[2];

  if (!exampleNumber || !examples[exampleNumber as keyof typeof examples]) {
    console.log('Usage: ts-node usage-examples.ts <example-number>');
    console.log('\nAvailable examples:');
    console.log('  1  - Basic Evaluation');
    console.log('  2  - Advanced Evaluation');
    console.log('  3  - Compare Multiple Models');
    console.log('  4  - Local Mode (Cached)');
    console.log('  5  - Debug Specific Prompt');
    console.log('  6  - Using WebCodegenScorer Class');
    console.log('  7  - CI/CD Pipeline');
    console.log('  8  - Initialize Environment');
    console.log('  9  - Parallel Evaluations');
    console.log('  10 - RAG-Enhanced Evaluation');
    console.log('  11 - Full Feature Evaluation');
    console.log('  12 - Error Handling');
    process.exit(1);
  }

  await examples[exampleNumber as keyof typeof examples]();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_basicEval,
  example2_advancedEval,
  example3_compareModels,
  example4_localMode,
  example5_debugPrompt,
  example6_usingClass,
  example7_cicdPipeline,
  example8_initEnvironment,
  example9_parallelEvals,
  example10_ragEvaluation,
  example11_fullFeatures,
  example12_errorHandling,
};
