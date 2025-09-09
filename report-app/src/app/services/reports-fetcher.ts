import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  resource,
  signal,
} from '@angular/core';
import { RunGroup, RunInfo } from '../../../../runner/shared-interfaces';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ReportsFetcher {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly pendingFetches = signal(0);
  private readonly runCache = new Map<string, RunInfo>();
  private readonly groupsResource = resource({
    loader: async () => {
      if (!isPlatformBrowser(this.platformId)) {
        return [];
      }
      return fetch('/api/reports')
        .then((r) => r.json() as Promise<RunGroup[]>)
        .then((groups) =>
          groups.sort((a, b) => {
            return (
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          })
        );
    },
  });

  readonly reportGroups = computed(() => {
    return this.groupsResource.hasValue() ? this.groupsResource.value() : [];
  });

  readonly isLoadingSingleReport = computed(() => this.pendingFetches() > 0);
  readonly isLoadingReportsList = computed(() =>
    this.groupsResource.isLoading()
  );

  async getCombinedReport(groupId: string): Promise<RunInfo> {
    if (!this.runCache.has(groupId)) {
      this.pendingFetches.update((current) => current + 1);

      const allRuns = await fetch(`/api/reports/${groupId}`).then(
        (r) => r.json() as Promise<RunInfo[]>
      );
      const firstRun = allRuns[0];
      const combined = {
        id: firstRun.id,
        group: firstRun.group,
        details: firstRun.details,
        results: allRuns.flatMap((run) => run.results),
      } satisfies RunInfo;

      this.runCache.set(groupId, combined);
      this.pendingFetches.update((current) => current - 1);
    }

    return this.runCache.get(groupId)!;
  }
}
