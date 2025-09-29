export function getClaudeAutomationPrompt(
  systemInstructions: string,
  buildCommand: string,
  packageManager: string
): string {
  const trimmedInstructions = systemInstructions.trim();
  return [
    'You are operating inside a fully automated evaluation harness. Follow these rules carefully:',
    '- Do NOT install new dependencies. Assume everything you need is already present.',
    '- Do NOT run git or interact with version control.',
    '- Avoid refactoring or reorganizing files unless explicitly requested.',
    '- Do NOT delete existing files unless the task explicitly asks for it.',
    `- Use the provided build verification command (\`${buildCommand}\`) to validate your work. Do not start long-running dev servers.`,
    `- When running scripts, always use the \`${packageManager}\` package manager. Do not run install, add, update, or remove commands.`,
    '- Stop once the requested changes are complete and validated.',
    '',
    trimmedInstructions.length ? trimmedInstructions : undefined,
  ]
    .filter((line): line is string => !!line && line.length > 0)
    .join('\n');
}
