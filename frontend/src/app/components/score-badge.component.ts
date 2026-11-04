import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-score-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="score-badge" [class.no-score]="score() === null">
      @if (score() !== null) {
        <span class="star">★</span>
        <span class="value">{{ score()?.toFixed(1) }}</span>
      } @else {
        <span class="value">—</span>
      }
    </span>
  `,
  styles: [`
    .score-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .star {
      color: var(--accent);
      font-size: 11px;
    }
    .value {
      letter-spacing: -0.02em;
    }
    .no-score {
      color: var(--text-muted);
    }
  `],
})
export class ScoreBadgeComponent {
  readonly score = input<number | null>(null);
}
