import { Component, computed, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ReviewWithGame } from '../../models';
import { ScoreBadgeComponent } from '../score-badge.component';

@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, ScoreBadgeComponent, DatePipe],
  template: `
    @if (review(); as r) {
      <div class="review-card">
        <div class="card-header">
          <div class="author-block">
            <span class="author-name">&#64;{{ r.author.username }}</span>
            <span class="review-date">{{ r.created_at | date:'mediumDate' }}</span>
          </div>
          <app-score-badge [score]="r.score"></app-score-badge>
        </div>

        <div class="game-strip">
          <a [routerLink]="['/games', r.game.id]" class="game-link">
            <div class="game-thumb">
              @if (r.game.cover_url) {
                <img [src]="r.game.cover_url" [alt]="r.game.title" loading="lazy" />
              } @else {
                <div class="thumb-placeholder">{{ r.game.title[0] || '?' }}</div>
              }
            </div>
            <span class="game-title">{{ r.game.title }}</span>
          </a>
        </div>

        <a [routerLink]="['/reviews', r.id]" class="review-body-link">
          @if (excerpt()) {
            <p class="review-body">{{ excerpt() }}</p>
          }
        </a>

        <div class="card-footer">
          <a [routerLink]="['/reviews', r.id]" class="comments-link">
            <mat-icon class="comment-icon">chat_bubble_outline</mat-icon>
            <span>{{ r.comment_count }} {{ r.comment_count === 1 ? 'comment' : 'comments' }}</span>
          </a>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    .review-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: background 150ms ease, border-color 150ms ease;
    }
    .review-card:hover {
      background: var(--surface-2);
      border-color: rgba(255, 255, 255, 0.16);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .author-block {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .author-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text);
    }
    .review-date {
      font-size: 12px;
      color: var(--text-muted);
    }
    .game-strip {
      display: flex;
      align-items: center;
    }
    .game-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: inherit;
    }
    .game-thumb {
      width: 28px;
      height: 38px;
      border-radius: 4px;
      overflow: hidden;
      background: var(--surface-2);
      flex-shrink: 0;
    }
    .game-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .game-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      transition: color 150ms ease;
    }
    .game-link:hover .game-title {
      color: var(--accent);
    }
    .review-body-link {
      text-decoration: none;
      color: inherit;
    }
    .review-body {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: var(--text-muted);
      word-break: break-word;
    }
    .card-footer {
      display: flex;
      align-items: center;
      padding-top: 4px;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
    }
    .comments-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-muted);
      text-decoration: none;
      transition: color 150ms ease;
    }
    .comments-link:hover {
      color: var(--text);
    }
    .comment-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `],
})
export class ReviewCardComponent {
  readonly review = input<ReviewWithGame | null>(null);

  readonly excerpt = computed(() => {
    const text = this.review()?.body;
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed.length <= 200) {
      return trimmed;
    }
    return trimmed.slice(0, 197) + '...';
  });
}
