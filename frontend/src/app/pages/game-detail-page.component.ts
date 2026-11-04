import {
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { GamesService } from '../services/games.service';
import { ReviewsService } from '../services/reviews.service';
import { AuthStore } from '../services/auth.store';
import {
  GameCard,
  GameDetail,
  ReviewOut,
  ReviewWithGame,
} from '../models';
import { ScoreBadgeComponent } from '../components/score-badge.component';
import { StateViewComponent } from '../components/state-view.component';
import { PagerComponent } from '../components/pager.component';
import { ReviewCardComponent } from '../components/review-card/review-card.component';
import { StatusSelectComponent } from '../components/status-select/status-select.component';
import {
  ReviewFormDialogComponent,
  ReviewFormDialogResult,
} from '../components/review-form-dialog/review-form-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../components/confirm-dialog.component';

@Component({
  selector: 'app-game-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatIconModule,
    ScoreBadgeComponent,
    StateViewComponent,
    PagerComponent,
    ReviewCardComponent,
    StatusSelectComponent,
    SlicePipe,
  ],
  template: `
    @if (gameResource.isLoading()) {
      <div class="page-state-wrapper">
        <app-state-view [loading]="true"></app-state-view>
      </div>
    } @else if (gameResource.error()) {
      <div class="page-state-wrapper">
        <app-state-view [error]="'Game not found'"></app-state-view>
        <div class="error-actions">
          <a mat-button class="browse-link" routerLink="/games">Browse All Games</a>
        </div>
      </div>
    } @else if (game(); as g) {
      <article class="game-detail-container">
        <!-- Top Banner with Scrim and Poster -->
        <header class="top-banner">
          @if (g.background_url || g.cover_url) {
            <div class="scrim-bg-container" aria-hidden="true">
              <img
                [src]="g.background_url || g.cover_url"
                alt=""
                class="banner-bg-img"
              />
              <div class="scrim-overlay"></div>
            </div>
          }

          <div class="banner-inner">
            <div class="poster-col">
              <div class="poster-card">
                @if (g.cover_url) {
                  <img [src]="g.cover_url" [alt]="g.title" class="poster-img" />
                } @else {
                  <div class="poster-ph">{{ g.title[0] || '?' }}</div>
                }
              </div>
            </div>

            <div class="info-col">
              <div class="meta-row">
                @if (releaseYear(); as year) {
                  <span class="release-year">{{ year }}</span>
                }
                @if (g.platforms.length > 0) {
                  <div class="platform-chips">
                    @for (p of g.platforms; track p) {
                      <span class="custom-chip platform-chip">{{ p }}</span>
                    }
                  </div>
                }
              </div>

              <h1 class="game-title">{{ g.title }}</h1>

              @if (g.genres.length > 0) {
                <div class="genre-chips">
                  @for (genre of g.genres; track genre.slug) {
                    <a
                      [routerLink]="['/games']"
                      [queryParams]="{ genre: genre.slug }"
                      class="custom-chip genre-chip"
                    >
                      {{ genre.name }}
                    </a>
                  }
                </div>
              }

              <div class="score-row">
                <app-score-badge [score]="g.avg_score"></app-score-badge>
                <span class="review-count-text">
                  {{ g.review_count }} {{ g.review_count === 1 ? 'review' : 'reviews' }}
                </span>
              </div>

              <div class="status-action-row">
                <app-status-select
                  [gameId]="g.id"
                  [current]="g.my_status"
                  (changed)="onStatusChanged()"
                ></app-status-select>
              </div>
            </div>
          </div>
        </header>

        <!-- Status Counts Row -->
        <section class="status-counts-row" aria-label="Library statistics">
          <div class="stat-card">
            <span class="stat-num">{{ g.status_counts.wishlist }}</span>
            <span class="stat-label">Wishlist</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ g.status_counts.playing }}</span>
            <span class="stat-label">Playing</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ g.status_counts.completed }}</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ g.status_counts.abandoned }}</span>
            <span class="stat-label">Abandoned</span>
          </div>
        </section>

        <!-- Description -->
        <section class="description-section">
          <h2 class="sub-title">About</h2>
          @if (g.description) {
            <p class="description-body">
              {{ isDescriptionExpanded() || g.description.length <= 400
                ? g.description
                : (g.description | slice:0:400) + '...' }}
            </p>
            @if (g.description.length > 400) {
              <button
                mat-button
                type="button"
                class="read-more-btn"
                (click)="isDescriptionExpanded.set(!isDescriptionExpanded())"
              >
                {{ isDescriptionExpanded() ? 'Read less' : 'Read more' }}
              </button>
            }
          } @else {
            <p class="description-body muted">No description available.</p>
          }
        </section>

        <!-- Reviews Section with Anchor -->
        <section id="reviews" class="reviews-section">
          <div class="reviews-top-bar">
            <div class="reviews-heading-group">
              <h2 class="sub-title">Reviews</h2>
              <mat-button-toggle-group
                [value]="sort()"
                (change)="onSortChange($event.value)"
                class="sort-toggle"
                aria-label="Sort reviews"
              >
                <mat-button-toggle value="latest">Latest</mat-button-toggle>
                <mat-button-toggle value="top">Top</mat-button-toggle>
              </mat-button-toggle-group>
            </div>

            <div class="review-cta-box">
              @if (isAuthenticated()) {
                @if (g.my_review_id) {
                  <button
                    mat-flat-button
                    type="button"
                    class="cta-pill edit-cta"
                    (click)="openReviewDialog(g.id, g.title, g.my_review_id)"
                  >
                    Edit your review
                  </button>
                } @else {
                  <button
                    mat-flat-button
                    type="button"
                    class="cta-pill write-cta"
                    (click)="openReviewDialog(g.id, g.title, null)"
                  >
                    Write a review
                  </button>
                }
              } @else {
                <a
                  mat-button
                  class="cta-pill login-cta"
                  [routerLink]="['/login']"
                  [queryParams]="{ returnUrl: currentUrl() }"
                >
                  Log in to review this game
                </a>
              }
            </div>
          </div>

          @if (reviewsResource.isLoading()) {
            <app-state-view [loading]="true"></app-state-view>
          } @else if (reviewsResource.error()) {
            <app-state-view
              [error]="'Failed to load reviews'"
              (retry)="reviewsResource.reload()"
            ></app-state-view>
          } @else if (reviewsPage(); as pageData) {
            @if (pageData.items.length === 0) {
              <app-state-view
                [empty]="true"
                emptyMessage="No reviews yet — be the first"
              ></app-state-view>
            } @else {
              <div class="reviews-grid">
                @for (rev of pageData.items; track rev.id) {
                  <div
                    class="review-wrapper"
                    [class.own-review]="rev.id === g.my_review_id"
                  >
                    @if (rev.id === g.my_review_id) {
                      <div class="own-review-header">
                        <span class="your-review-badge">Your review</span>
                        <div class="own-review-actions">
                          <button
                            mat-button
                            type="button"
                            class="own-action-btn edit-btn"
                            (click)="openReviewDialog(g.id, g.title, rev.id)"
                          >
                            Edit
                          </button>
                          <button
                            mat-button
                            type="button"
                            class="own-action-btn delete-btn"
                            (click)="onDeleteReview(rev.id)"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    }
                    <app-review-card [review]="mapToReviewWithGame(rev, g)"></app-review-card>
                  </div>
                }
              </div>

              @if (pageData.total > pageSize()) {
                <app-pager
                  [total]="pageData.total"
                  [page]="page()"
                  [pageSize]="pageSize()"
                  (pageChange)="onPageChange($event)"
                ></app-pager>
              }
            }
          }
        </section>
      </article>
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
      justify-content: center;
    }
    .error-actions {
      margin-top: 16px;
    }
    .browse-link {
      border: 1px solid var(--border) !important;
      border-radius: var(--radius-pill) !important;
      color: var(--text) !important;
    }
    .game-detail-container {
      max-width: 1280px;
      margin: 0 auto;
      padding-bottom: 80px;
    }

    /* Top banner */
    .top-banner {
      position: relative;
      padding: 40px 24px 32px;
      margin-bottom: 32px;
      overflow: hidden;
    }
    @media (min-width: 768px) {
      .top-banner {
        padding: 64px 40px 48px;
      }
    }
    .scrim-bg-container {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
    }
    .banner-bg-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: blur(24px) brightness(0.45);
      transform: scale(1.1);
    }
    .scrim-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(17, 18, 20, 0.45) 0%,
        rgba(17, 18, 20, 0.85) 60%,
        var(--bg) 100%
      );
    }
    .banner-inner {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    @media (min-width: 768px) {
      .banner-inner {
        flex-direction: row;
        align-items: flex-end;
        gap: 40px;
      }
    }
    .poster-col {
      flex-shrink: 0;
    }
    .poster-card {
      width: 180px;
      aspect-ratio: 3 / 4;
      border-radius: var(--radius);
      overflow: hidden;
      background: var(--surface-2);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
    }
    @media (min-width: 768px) {
      .poster-card {
        width: 220px;
      }
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
      font-size: 48px;
      font-weight: 800;
      color: var(--text-muted);
    }
    .info-col {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .meta-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .release-year {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .platform-chips, .genre-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .custom-chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 500;
      background: var(--surface-2);
      color: var(--text-muted);
      border: 1px solid var(--border);
      text-decoration: none;
      transition: all 150ms ease;
    }
    .genre-chip:hover {
      color: var(--text);
      border-color: rgba(255, 255, 255, 0.25);
      background: rgba(255, 255, 255, 0.08);
    }
    .game-title {
      font-size: clamp(2rem, 5vw, 3.5rem);
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin: 0;
      color: var(--text);
    }
    .score-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .review-count-text {
      font-size: 14px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .status-action-row {
      margin-top: 8px;
    }

    /* Status Counts Strip */
    .status-counts-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 0 24px;
      margin-bottom: 40px;
    }
    @media (min-width: 640px) {
      .status-counts-row {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    @media (min-width: 768px) {
      .status-counts-row {
        padding: 0 40px;
      }
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-align: center;
    }
    .stat-num {
      font-size: 24px;
      font-weight: 700;
      color: var(--text);
    }
    .stat-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    /* Description */
    .description-section {
      padding: 0 24px;
      margin-bottom: 48px;
    }
    @media (min-width: 768px) {
      .description-section {
        padding: 0 40px;
      }
    }
    .sub-title {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 16px;
      color: var(--text);
    }
    .description-body {
      white-space: pre-line;
      line-height: 1.6;
      color: var(--text);
      font-size: 15px;
      max-width: 860px;
      margin: 0;

      &.muted {
        color: var(--text-muted);
      }
    }
    .read-more-btn {
      margin-top: 8px;
      padding: 0 !important;
      color: var(--accent) !important;
      font-size: 13px !important;
      font-weight: 600;
    }

    /* Reviews section */
    .reviews-section {
      padding: 0 24px;
    }
    @media (min-width: 768px) {
      .reviews-section {
        padding: 0 40px;
      }
    }
    .reviews-top-bar {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }
    @media (min-width: 640px) {
      .reviews-top-bar {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }
    }
    .reviews-heading-group {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .sort-toggle {
      border: 1px solid var(--border) !important;
      border-radius: var(--radius-pill) !important;
      background: var(--surface-2);
    }
    .cta-pill {
      border-radius: var(--radius-pill) !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      letter-spacing: 0.04em;
      padding: 0 20px !important;
      height: 40px !important;
      line-height: 40px !important;

      &.write-cta, &.edit-cta {
        background-color: var(--text) !important;
        color: var(--bg) !important;
      }
      &.login-cta {
        border: 1px solid var(--border) !important;
        color: var(--text) !important;
        background: var(--surface) !important;
      }
    }
    .reviews-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    @media (min-width: 768px) {
      .reviews-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .review-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;

      &.own-review {
        border: 1px solid var(--accent);
        border-radius: var(--radius);
        padding: 12px;
        background: rgba(242, 193, 78, 0.04);
      }
    }
    .own-review-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 4px;
    }
    .your-review-badge {
      font-size: 11px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .own-review-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .own-action-btn {
      font-size: 12px !important;
      padding: 0 10px !important;
      height: 28px !important;
      line-height: 28px !important;
      border-radius: var(--radius-pill) !important;

      &.edit-btn {
        color: var(--text) !important;
      }
      &.delete-btn {
        color: var(--danger) !important;
      }
    }
  `],
})
export class GameDetailPageComponent {
  readonly id = input<string>();

  private readonly gamesService = inject(GamesService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly authStore = inject(AuthStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly sort = signal<'latest' | 'top'>('latest');
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(20);
  readonly isDescriptionExpanded = signal<boolean>(false);

  readonly isAuthenticated = computed(() => this.authStore.isLoggedIn());
  readonly currentUrl = computed(() => this.router.url);

  readonly gameResource = this.gamesService.detail(() => this.id());
  readonly game = computed(() => this.gameResource.value() ?? null);

  readonly reviewsResource = this.reviewsService.forGame(
    () => this.id(),
    () => this.sort(),
    () => this.page(),
    () => this.pageSize()
  );
  readonly reviewsPage = computed(() => this.reviewsResource.value() ?? null);

  readonly releaseYear = computed(() => {
    const d = this.game()?.release_date;
    if (!d) return null;
    return d.slice(0, 4);
  });

  onSortChange(newSort: 'latest' | 'top'): void {
    this.sort.set(newSort);
    this.page.set(1);
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page.set(event.page);
    this.pageSize.set(event.pageSize);
  }

  onStatusChanged(): void {
    this.gameResource.reload();
  }

  reloadAll(): void {
    this.gameResource.reload();
    this.reviewsResource.reload();
  }

  openReviewDialog(
    gameId: number,
    gameTitle: string,
    reviewId: number | null = null
  ): void {
    const ref = this.dialog.open(ReviewFormDialogComponent, {
      data: { gameId, gameTitle, reviewId },
      width: '540px',
    });

    ref.afterClosed().subscribe((res: ReviewFormDialogResult | undefined) => {
      if (res?.saved || res?.deleted || res?.conflict) {
        this.reloadAll();
      }
    });
  }

  onDeleteReview(reviewId: number): void {
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
        this.reviewsService.delete(reviewId).subscribe({
          next: () => {
            this.snackBar.open('Review deleted', 'Close', { duration: 3000 });
            this.reloadAll();
          },
          error: () => {
            this.snackBar.open('Failed to delete review', 'Close', { duration: 3000 });
          },
        });
      }
    });
  }

  mapToReviewWithGame(rev: ReviewOut, g: GameDetail): ReviewWithGame {
    const gameCard: GameCard = {
      id: g.id,
      title: g.title,
      slug: g.slug,
      cover_url: g.cover_url,
      release_date: g.release_date,
      platforms: g.platforms,
      genres: g.genres,
      avg_score: g.avg_score,
      review_count: g.review_count,
    };
    return {
      ...rev,
      game: gameCard,
    };
  }
}
