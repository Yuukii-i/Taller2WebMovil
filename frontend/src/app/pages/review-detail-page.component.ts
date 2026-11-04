import {
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ReviewsService } from '../services/reviews.service';
import { CommentsService } from '../services/comments.service';
import { AuthStore } from '../services/auth.store';
import { CommentOut, ReviewWithGame } from '../models';
import { ScoreBadgeComponent } from '../components/score-badge.component';
import { StateViewComponent } from '../components/state-view.component';
import { PagerComponent } from '../components/pager.component';
import { CommentFormComponent } from '../components/comment-form/comment-form.component';
import {
  ReviewFormDialogComponent,
  ReviewFormDialogResult,
} from '../components/review-form-dialog/review-form-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../components/confirm-dialog.component';

@Component({
  selector: 'app-review-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    ScoreBadgeComponent,
    StateViewComponent,
    PagerComponent,
    CommentFormComponent,
    DatePipe,
  ],
  template: `
    @if (reviewResource.isLoading()) {
      <div class="page-state-wrapper">
        <app-state-view [loading]="true"></app-state-view>
      </div>
    } @else if (reviewResource.error()) {
      <div class="page-state-wrapper">
        <app-state-view [error]="'Review not found'"></app-state-view>
        <div class="error-actions">
          <a mat-button class="browse-link" routerLink="/">Go Home</a>
        </div>
      </div>
    } @else if (review(); as r) {
      <div class="review-page-container">
        <!-- Review Card Header -->
        <article class="main-review-card">
          <!-- Game strip link -->
          <div class="game-header-strip">
            <a [routerLink]="['/games', r.game.id]" class="game-header-link">
              <div class="game-poster-box">
                @if (r.game.cover_url) {
                  <img [src]="r.game.cover_url" [alt]="r.game.title" class="poster-img" />
                } @else {
                  <div class="poster-ph">{{ r.game.title[0] || '?' }}</div>
                }
              </div>
              <div class="game-meta-text">
                <span class="game-kicker">Review for</span>
                <h1 class="game-title">{{ r.game.title }}</h1>
              </div>
            </a>
          </div>

          <!-- Author and Score info -->
          <div class="review-author-bar">
            <div class="author-info">
              <a [routerLink]="['/u', r.author.username]" class="author-link">
                &#64;{{ r.author.username }}
              </a>
              <span class="date-text">{{ r.created_at | date:'mediumDate' }}</span>
              @if (isEdited()) {
                <span class="edited-tag">(edited)</span>
              }
            </div>

            <div class="score-actions-group">
              <app-score-badge [score]="r.score"></app-score-badge>

              @if (isReviewOwner()) {
                <div class="owner-actions">
                  <button
                    mat-button
                    type="button"
                    class="owner-btn edit-review-btn"
                    (click)="openEditReview()"
                  >
                    Edit
                  </button>
                  <button
                    mat-button
                    type="button"
                    class="owner-btn delete-review-btn"
                    (click)="onDeleteReview()"
                  >
                    Delete
                  </button>
                </div>
              }
            </div>
          </div>

          <!-- Review Body -->
          <div class="review-body-section">
            @if (r.body) {
              <p class="review-body-text">{{ r.body }}</p>
            } @else {
              <p class="review-body-text muted">No written review.</p>
            }
          </div>
        </article>

        <!-- Comments Section -->
        <section class="comments-section" aria-label="Review comments">
          <header class="comments-header">
            <h2 class="comments-title">
              Comments
              @if (commentsPage(); as cp) {
                <span class="comments-count">({{ cp.total }})</span>
              }
            </h2>
          </header>

          <!-- Comment Form -->
          <app-comment-form
            [reviewId]="r.id"
            (commentSubmitted)="reloadCommentsAndReview()"
          ></app-comment-form>

          <!-- Comments List -->
          @if (commentsResource.isLoading()) {
            <app-state-view [loading]="true"></app-state-view>
          } @else if (commentsResource.error()) {
            <app-state-view
              [error]="'Failed to load comments'"
              (retry)="commentsResource.reload()"
            ></app-state-view>
          } @else if (commentsPage(); as cp) {
            @if (cp.items.length === 0) {
              <app-state-view [empty]="true" emptyMessage="No comments yet"></app-state-view>
            } @else {
              <div class="comments-list">
                @for (c of cp.items; track c.id) {
                  <div class="comment-item">
                    <div class="comment-header">
                      <div class="comment-author-box">
                        <a [routerLink]="['/u', c.author.username]" class="comment-author-link">
                          &#64;{{ c.author.username }}
                        </a>
                        <span class="comment-date">{{ c.created_at | date:'mediumDate' }}</span>
                      </div>

                      @if (canDeleteComment(c)) {
                        <button
                          mat-icon-button
                          type="button"
                          class="delete-comment-btn"
                          aria-label="Delete comment"
                          (click)="onDeleteComment(c)"
                        >
                          <mat-icon class="del-icon">delete_outline</mat-icon>
                        </button>
                      }
                    </div>

                    <p class="comment-body">{{ c.body }}</p>
                  </div>
                }
              </div>

              @if (cp.total > pageSize()) {
                <app-pager
                  [total]="cp.total"
                  [page]="page()"
                  [pageSize]="pageSize()"
                  (pageChange)="onPageChange($event)"
                ></app-pager>
              }
            }
          }
        </section>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      color: var(--text);
    }
    .page-state-wrapper {
      padding: 80px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .error-actions {
      margin-top: 16px;
    }
    .browse-link {
      border: 1px solid var(--border) !important;
      border-radius: var(--radius-pill) !important;
      color: var(--text) !important;
    }
    .review-page-container {
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 20px 80px;
    }

    /* Main review card */
    .main-review-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-bottom: 40px;
    }
    @media (min-width: 640px) {
      .main-review-card {
        padding: 32px;
      }
    }
    .game-header-strip {
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 16px;
    }
    .game-header-link {
      display: flex;
      align-items: center;
      gap: 16px;
      text-decoration: none;
      color: inherit;
      transition: opacity 150ms ease;

      &:hover {
        opacity: 0.9;
      }
    }
    .game-poster-box {
      width: 54px;
      aspect-ratio: 3 / 4;
      border-radius: 6px;
      overflow: hidden;
      background: var(--surface-2);
      flex-shrink: 0;
    }
    .poster-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .poster-ph {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: var(--text-muted);
    }
    .game-meta-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .game-kicker {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .game-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      color: var(--text);
    }

    /* Review Author Bar */
    .review-author-bar {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    @media (min-width: 640px) {
      .review-author-bar {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }
    }
    .author-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .author-link {
      font-weight: 700;
      font-size: 15px;
      color: var(--text);
      text-decoration: none;

      &:hover {
        color: var(--accent);
      }
    }
    .date-text {
      font-size: 13px;
      color: var(--text-muted);
    }
    .edited-tag {
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
    }
    .score-actions-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .owner-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .owner-btn {
      font-size: 12px !important;
      padding: 0 12px !important;
      height: 30px !important;
      line-height: 30px !important;
      border-radius: var(--radius-pill) !important;

      &.edit-review-btn {
        color: var(--text) !important;
        border: 1px solid var(--border) !important;
      }
      &.delete-review-btn {
        color: var(--danger) !important;
      }
    }
    .review-body-section {
      padding-top: 4px;
    }
    .review-body-text {
      white-space: pre-line;
      font-size: 15px;
      line-height: 1.6;
      color: var(--text);
      margin: 0;

      &.muted {
        color: var(--text-muted);
        font-style: italic;
      }
    }

    /* Comments Section */
    .comments-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .comments-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
    }
    .comments-title {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
      color: var(--text);
    }
    .comments-count {
      color: var(--text-muted);
      font-size: 15px;
      margin-left: 6px;
    }
    .comments-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .comment-item {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .comment-author-box {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .comment-author-link {
      font-weight: 600;
      font-size: 14px;
      color: var(--text);
      text-decoration: none;

      &:hover {
        color: var(--accent);
      }
    }
    .comment-date {
      font-size: 12px;
      color: var(--text-muted);
    }
    .delete-comment-btn {
      color: var(--text-muted) !important;
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;

      &:hover {
        color: var(--danger) !important;
      }
    }
    .del-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .comment-body {
      white-space: pre-line;
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: var(--text);
    }
  `],
})
export class ReviewDetailPageComponent {
  readonly id = input<string>();

  private readonly reviewsService = inject(ReviewsService);
  private readonly commentsService = inject(CommentsService);
  private readonly authStore = inject(AuthStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(20);

  readonly reviewResource = this.reviewsService.detail(() => this.id());
  readonly review = computed(() => this.reviewResource.value() ?? null);

  readonly commentsResource = this.commentsService.list(
    () => this.id(),
    () => this.page(),
    () => this.pageSize()
  );
  readonly commentsPage = computed(() => this.commentsResource.value() ?? null);

  readonly isEdited = computed(() => {
    const r = this.review();
    if (!r || !r.created_at || !r.updated_at) return false;
    return new Date(r.updated_at).getTime() > new Date(r.created_at).getTime();
  });

  readonly isReviewOwner = computed(() => {
    const myId = this.authStore.user()?.id;
    const r = this.review();
    return Boolean(myId && r && r.author.id === myId);
  });

  canDeleteComment(comment: CommentOut): boolean {
    const myId = this.authStore.user()?.id;
    if (!myId) return false;
    if (comment.author.id === myId) return true; // comment author
    const r = this.review();
    if (r && r.author.id === myId) return true; // review author
    return false;
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
  }

  reloadCommentsAndReview(): void {
    this.commentsResource.reload();
    this.reviewResource.reload();
  }

  openEditReview(): void {
    const r = this.review();
    if (!r) return;

    const ref = this.dialog.open(ReviewFormDialogComponent, {
      data: { gameId: r.game.id, gameTitle: r.game.title, reviewId: r.id },
      width: '540px',
    });

    ref.afterClosed().subscribe((res: ReviewFormDialogResult | undefined) => {
      if (res?.saved) {
        this.reviewResource.reload();
      }
      if (res?.deleted) {
        this.router.navigate(['/games', r.game.id]);
      }
    });
  }

  onDeleteReview(): void {
    const r = this.review();
    if (!r) return;

    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete review?',
        message: 'Are you sure you want to delete your review? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        destructive: true,
      } as ConfirmDialogData,
    });

    confirmRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.reviewsService.delete(r.id).subscribe({
          next: () => {
            this.snackBar.open('Review deleted', 'Close', { duration: 3000 });
            this.router.navigate(['/games', r.game.id]);
          },
          error: () => {
            this.snackBar.open('Failed to delete review', 'Close', { duration: 3000 });
          },
        });
      }
    });
  }

  onDeleteComment(comment: CommentOut): void {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete comment?',
        message: 'Are you sure you want to delete this comment?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        destructive: true,
      } as ConfirmDialogData,
    });

    confirmRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.commentsService.delete(comment.id).subscribe({
          next: () => {
            this.snackBar.open('Comment deleted', 'Close', { duration: 3000 });
            this.reloadCommentsAndReview();
          },
          error: () => {
            this.snackBar.open('Failed to delete comment', 'Close', { duration: 3000 });
          },
        });
      }
    });
  }
}
