import { dirname } from 'path';
import { existsSync } from 'fs';
import { Environment } from './environment.js';
import { assertIsEnvironmentConfig } from './environment-config.js';
import { toProcessAbsolutePath } from '../file-system-utils.js';
import { UserFacingError } from '../utils/errors.js';

const environmentsCache = new Map<string, Environment>();

/** Gets an environment with a specific config path. */
export async function getEnvironmentByPath(
  configPath: string
): Promise<Environment> {
  configPath = toProcessAbsolutePath(configPath);

  if (environmentsCache.has(configPath)) {
    return environmentsCache.get(configPath)!;
  }

  if (!existsSync(configPath)) {
    throw new UserFacingError(
      `Cannot find environment config file at ${configPath}`
    );
  }

  const result: { default: unknown } = await import(configPath);
  const rootPath = dirname(configPath);
  assertIsEnvironmentConfig(result.default);
  const environment = new Environment(rootPath, result.default);
  environmentsCache.set(configPath, environment);
  return environmentsCache.get(configPath)!;
}
