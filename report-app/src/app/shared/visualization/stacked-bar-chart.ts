import { Component, computed, input, signal } from '@angular/core';

export type StackedBarChartData = Array<{
  label: string;
  color: string;
  value: number;
}>;

@Component({
  selector: 'stacked-bar-chart',
  imports: [],
  template: `
    <div class="chart-container">
      <!-- The main stacked bar -->
      <div class="stacked-bar" [class.compact]="compact()">
        @for (item of data(); track $index) {
          @if (item.value > 0) {
            <div
              class="segment"
              [style.width.%]="asPercent(item.value)"
              [style.background-color]="item.color"
              (click)="toggleDisplayMode(item)"
            >
              {{ getItemDisplayValue(item) }}
            </div>
          }
        }
      </div>

      <!-- The legend for the bar chart -->
      @if (showLegend()) {
        <div class="legend">
          @for (item of data(); track $index) {
            <div class="legend-item">
              <span
                class="legend-color"
                [style.background-color]="item.color"
              ></span>
              {{ item.label }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .chart-container {
      width: 100%;
      background-color: var(--card-bg-color);
      border-radius: 12px;
    }

    .stacked-bar {
      display: flex;
      height: 45px;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 1rem;
    }

    .stacked-bar.compact {
      margin-bottom: 0;
      height: 24px;

      .segment {
        font-size: 12px;
      }

      & + .legend {
        margin-top: 0.5rem;
      }
    }

    .segment {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: 500;
      transition: filter 0.2s ease-in-out;
      min-width: 50px;
    }

    .segment:hover {
      filter: brightness(1.1);
    }

    .legend {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
    }

    .legend-item {
      display: flex;
      align-items: center;
      font-size: 14px;
      color: var(--text-secondary);
    }

    .legend-color {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      margin-right: 8px;
    }
  `,
})
export class StackedBarChart {
  data = input.required<StackedBarChartData>();
  compact = input(false);
  showLegend = input(true);

  total = computed(() =>
    this.data().reduce((acc, item) => acc + item.value, 0)
  );
  private displayPercentage = signal(false);

  asPercent(value: number) {
    if (this.total() === 0) return 0;
    const percentage = (value / this.total()) * 100;
    return parseFloat(percentage.toFixed(percentage % 1 === 0 ? 0 : 1));
  }

  toggleDisplayMode(item: StackedBarChartData[0]): void {
    this.displayPercentage.update((current) => !current);
  }

  getItemDisplayValue(item: StackedBarChartData[0]): string {
    if (item.value === 0) return '';
    return this.displayPercentage()
      ? `${this.asPercent(item.value)}%`
      : `${item.value}`;
  }
}
