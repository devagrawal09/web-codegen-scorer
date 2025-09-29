export function getCodexAgentsFile(
  systemInstructions: string,
  buildCommand: string,
  packageManager: string
): string {
  const trimmedInstructions = systemInstructions.trim();
  return [
    '# Automation Instructions',
    'You are running inside an automated evaluation harness. You must follow these rules exactly:',
    '- Do NOT install new dependencies. Assume everything you need is already available.',
    '- Do NOT attempt to reformat, refactor, or otherwise improve unrelated code.',
    '- Do NOT delete or rename existing files unless explicitly instructed.',
    '- Use the provided package manager only for running existing scripts. Do not run install/update/remove commands.',
    `- Use the \`${buildCommand}\` command to verify your work instead of starting a dev server.`,
    '- Do NOT use git or other version control tools.',
    '- Stop once you have completed the requested task.',
    '',
    'Project-specific guidelines:',
    `- Package manager to use for scripts: ${packageManager}.`,
    `- Build verification command: ${buildCommand}.`,
    '',
    trimmedInstructions.length ? trimmedInstructions : undefined,
  ]
    .filter((line): line is string => !!line && line.length > 0)
    .join('\n');
}
