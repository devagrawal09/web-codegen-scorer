import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { glob } from 'tinyglobby';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const reportsLoaderPromise = getReportLoader();
const options = getOptions();
const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const angularApp = new AngularNodeAppEngine();
let localDataPromise: Promise<LocalData> | null = null;

// Endpoint for fetching all available report groups.
app.get('/api/reports', async (_, res) => {
  const [remoteGroups, localData] = await Promise.all([
    reportsLoaderPromise.then((loader) => loader.getGroupsList()),
    resolveLocalData(options.reportsRoot),
  ]);
  const results = remoteGroups.slice();

  for (const [, group] of localData) {
    results.unshift(group.overview);
  }

  res.json(results);
});

// Endpoint for fetching a specific report group.
app.get('/api/reports/:id', async (req, res) => {
  const id = req.params.id;
  const localData = await resolveLocalData(options.reportsRoot);
  let result: { group: string }[] | null = null;

  if (localData.has(id)) {
    result = [localData.get(id)!.run];
  } else {
    const loader = await reportsLoaderPromise;
    result = await loader.getGroupedReports(id);
  }

  res.json(result);
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      return response ? writeResponseToNodeResponse(response, res) : next();
    })
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  app.listen(options.port);
}

export const reqHandler = createNodeRequestHandler(app);

interface ReportLoader {
  getGroupedReports: (groupId: string) => Promise<{ group: string }[]>;
  getGroupsList: () => Promise<{ id: string }[]>;
}

type LocalData = Map<
  string,
  {
    overview: { id: string };
    run: { group: string };
  }
>;

/** Gets the server options from the command line. */
function getOptions() {
  const defaultPort = 4200;
  const envPort = process.env['CODEGEN_REPORTS_PORT'];
  const reportsRoot =
    process.env['CODEGEN_REPORTS_DIR'] || './.web-codegen-scorer/reports';

  return {
    port: envPort ? parseInt(envPort) || defaultPort : defaultPort,
    reportsRoot: isAbsolute(reportsRoot)
      ? reportsRoot
      : join(process.cwd(), reportsRoot),
  };
}

async function getReportLoader() {
  const reportLoaderPath = process.env['CODEGEN_REPORTS_LOADER'];

  // If no loader is configured, return an empty response.
  if (!reportLoaderPath) {
    return {
      getGroupedReports: () => Promise.resolve([]),
      getGroupsList: () => Promise.resolve([]),
    } satisfies ReportLoader;
  }

  const loaderImportPath = isAbsolute(reportLoaderPath)
    ? reportLoaderPath
    : join(process.cwd(), reportLoaderPath);
  const importResult: { default: ReportLoader } = await import(
    /* @vite-ignore */ loaderImportPath
  );

  if (
    !importResult.default ||
    typeof importResult.default.getGroupedReports !== 'function' ||
    typeof importResult.default.getGroupsList !== 'function'
  ) {
    throw new Error(
      'Invalid remote import loader. The file must have a default export ' +
        'with `getGroupedReports` and `getGroupsList` functions.'
    );
  }

  return importResult.default;
}

async function resolveLocalData(directory: string) {
  // Reuse the same promise so that concurrent requests get the same response.
  if (!localDataPromise) {
    let resolveFn: (data: LocalData) => void;
    localDataPromise = new Promise((resolve) => (resolveFn = resolve));

    const data: LocalData = new Map();
    const groupFiles = await glob('**/groups.json', {
      cwd: directory,
      absolute: true,
    });

    await Promise.all(
      // Note: sort the groups so that the indexes stay consistent no matter how the files
      // appear on disk. It appears to be non-deterministic when using the async glob.
      groupFiles.sort().map(async (configPath, index) => {
        const [groupContent, runContent] = await Promise.all([
          readFile(configPath, 'utf8'),
          readFile(join(dirname(configPath), 'summary.json'), 'utf8'),
        ]);

        // Note: Local reports only have one group.
        const overview = (JSON.parse(groupContent) as { id: string }[])[0];
        const run = JSON.parse(runContent) as { group: string };

        // Local runs should not be grouped by their group ID, but rather if they
        // were part of the same invocation. Add a unique suffix to the ID to
        // prevent further grouping.
        run.group = overview.id = `${overview.id}-l${index}`;
        data.set(overview.id, { overview, run });
      })
    );

    resolveFn!(data);
  }

  return localDataPromise;
}
