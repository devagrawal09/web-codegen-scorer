import { getBuiltInRatings } from 'web-codegen-scorer';

/** @type {import("web-codegen-scorer").EnvironmentConfig} */
export default {
  displayName: 'Solid.js (Example)',
  clientSideFramework: 'solid',
  sourceDirectory: './project',
  ratings: getBuiltInRatings(),
  generationSystemPrompt: './system-instructions.md',
  executablePrompts: ['../../prompts/**/*.md'],
  packageManager: 'npm',
};
