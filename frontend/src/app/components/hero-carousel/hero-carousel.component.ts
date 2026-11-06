import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HeroSlide } from './hero-carousel.types';
import { AuthStore } from '../../services/auth.store';
import { LibraryService } from '../../services/library.service';

@Component({
  selector: 'app-hero-carousel',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  template: `
    @if (slides().length > 0) {
      <section
        class="hero-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured games"
        (mouseenter)="onMouseEnter()"
        (mouseleave)="onMouseLeave()"
        (focusin)="onFocusIn()"
        (focusout)="onFocusOut()"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
      >
        <!-- Polite announcement when paused -->
        <div
          class="sr-only"
          [attr.aria-live]="isPaused() ? 'polite' : 'off'"
          aria-atomic="true"
        >
          Slide {{ currentIndex() + 1 }} of {{ slides().length }}:
          {{ currentSlide()?.game?.title }}
        </div>

        <!-- Slides stack -->
        <div class="slides-wrapper">
          @for (slide of slides(); track slide.game.id; let idx = $index) {
            <article
              class="hero-slide"
              [class.active]="idx === currentIndex()"
              role="group"
              aria-roledescription="slide"
              [attr.aria-label]="(idx + 1) + ' of ' + slides().length"
              [attr.aria-hidden]="idx !== currentIndex()"
              [inert]="idx !== currentIndex()"
            >
              <!-- Background Art -->
              <div class="slide-art-container">
                @if ((slide.game.background_url || slide.game.cover_url) && !imageErrors()[slide.game.id]) {
                  <img
                    [src]="slide.game.background_url || slide.game.cover_url"
                    [alt]="slide.game.title"
                    class="slide-img"
                    [attr.fetchpriority]="idx === 0 ? 'high' : null"
                    (error)="onImageError(slide.game.id)"
                  />
                } @else {
                  <div class="fallback-art"></div>
                }
                <!-- Cinematic Scrim for readability -->
                <div class="scrim-overlay"></div>
              </div>

              <!-- Slide Content -->
              <div class="slide-content-wrapper">
                <div class="slide-content">
                  <span class="slide-kicker">{{ slide.kicker }}</span>
                  <h1 class="slide-title" [title]="slide.game.title">
                    {{ slide.game.title }}
                  </h1>
                  <div class="slide-stat">
                    <span class="stat-star">★</span>
                    <span class="stat-text">{{ slide.stat }}</span>
                  </div>
                  <div class="slide-actions">
                    <a
                      mat-button
                      class="btn-primary"
                      [routerLink]="['/games', slide.game.id]"
                      [fragment]="'reviews'"
                    >
                      Read reviews
                    </a>
                    <button
                      mat-button
                      type="button"
                      class="btn-secondary"
                      (click)="onWishlist(slide.game.id)"
                    >
                      Add to wishlist
                    </button>
                  </div>
                </div>
              </div>
            </article>
          }
        </div>

        <!-- Preload next slide image -->
        @if ((nextSlideItem()?.game?.background_url || nextSlideItem()?.game?.cover_url); as nextUrl) {
          <img
            [src]="nextUrl"
            class="preload-img"
            aria-hidden="true"
            alt=""
          />
        }

        <!-- Arrows (desktop >= 768px only) -->
        @if (slides().length > 1) {
          <button
            mat-icon-button
            class="nav-arrow prev-arrow"
            (click)="prevSlide()"
            aria-label="Previous slide"
          >
            <mat-icon>chevron_left</mat-icon>
          </button>
          <button
            mat-icon-button
            class="nav-arrow next-arrow"
            (click)="nextSlide()"
            aria-label="Next slide"
          >
            <mat-icon>chevron_right</mat-icon>
          </button>
        }

        <!-- "Up next" card (desktop >= 768px only) -->
        @if (slides().length > 1 && nextSlideItem(); as next) {
          <button
            type="button"
            class="up-next-card"
            (click)="nextSlide()"
            [attr.aria-label]="'Skip to next: ' + next.game.title"
          >
            <div class="up-next-thumb">
              @if (next.game.cover_url && !imageErrors()[next.game.id]) {
                <img [src]="next.game.cover_url" [alt]="next.game.title" />
              } @else {
                <div class="thumb-ph">{{ next.game.title[0] || '?' }}</div>
              }
            </div>
            <div class="up-next-info">
              <span class="up-next-tag">Up next · {{ next.kicker }}</span>
              <span class="up-next-title">{{ next.game.title }}</span>
            </div>
          </button>
        }

        <!-- Dots -->
        @if (slides().length > 1) {
          <div class="hero-dots" role="tablist" aria-label="Slide indicators">
            @for (slide of slides(); track slide.game.id; let idx = $index) {
              <button
                type="button"
                class="dot"
                [class.active]="idx === currentIndex()"
                (click)="goToSlide(idx)"
                [attr.aria-label]="'Go to slide ' + (idx + 1) + ' of ' + slides().length"
              ></button>
            }
          </div>
        }
      </section>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .hero-carousel {
      position: relative;
      width: 100%;
      height: 70vh;
      min-height: 480px;
      overflow: hidden;
      background-color: var(--bg);
    }

    @media (min-width: 768px) {
      .hero-carousel {
        height: 88vh;
        min-height: 560px;
      }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .preload-img {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    .slides-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .hero-slide {
      position: absolute;
      inset: 0;
      opacity: 0;
      visibility: hidden;
      transition: opacity 600ms ease, visibility 600ms ease;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;

      &.active {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
    }

    .slide-art-container {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
    }

    .slide-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .fallback-art {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
    }

    .scrim-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.45) 0%,
        rgba(17, 18, 20, 0.2) 30%,
        rgba(17, 18, 20, 0.75) 75%,
        var(--bg) 95%,
        var(--bg) 100%
      );
    }

    .slide-content-wrapper {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    @media (min-width: 768px) {
      .slide-content-wrapper {
        padding: 0 40px;
      }
    }

    .slide-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 900px;
      gap: 12px;
    }

    .slide-kicker {
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: clamp(1rem, 2vw, 1.25rem);
      color: var(--accent);
      letter-spacing: 0.04em;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
    }

    .slide-title {
      font-family: 'Inter', sans-serif;
      font-weight: 800;
      text-transform: uppercase;
      font-size: clamp(2.5rem, 8vw, 7rem);
      line-height: 1.02;
      letter-spacing: -0.02em;
      color: #fff;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: break-word;
      word-break: break-word;
      text-shadow: 0 3px 20px rgba(0, 0, 0, 0.9), 0 1px 4px rgba(0, 0, 0, 0.8);
    }

    .slide-stat {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
      margin-top: 4px;

      .stat-star {
        color: var(--accent);
        font-size: 1.15rem;
      }
    }

    .slide-actions {
      margin-top: 16px;

      .btn-primary {
        background-color: var(--text) !important;
        color: var(--bg) !important;
        border-radius: var(--radius-pill) !important;
        text-transform: uppercase;
        font-weight: 700;
        font-size: 13px !important;
        letter-spacing: 0.08em;
        padding: 0 28px !important;
        height: 44px !important;
        line-height: 44px !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        transition: transform 150ms ease, box-shadow 150ms ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7);
        }

        &:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
      }

      .btn-secondary {
        background-color: transparent !important;
        color: var(--text) !important;
        border: 1px solid rgba(242, 243, 245, 0.4) !important;
        border-radius: var(--radius-pill) !important;
        text-transform: uppercase;
        font-weight: 700;
        font-size: 13px !important;
        letter-spacing: 0.08em;
        padding: 0 24px !important;
        height: 44px !important;
        line-height: 44px !important;
        backdrop-filter: blur(8px);
        transition: transform 150ms ease, background-color 150ms ease, border-color 150ms ease;

        &:hover {
          transform: translateY(-2px);
          background-color: rgba(255, 255, 255, 0.08) !important;
          border-color: var(--text) !important;
        }

        &:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
      }
    }

    /* Arrows */
    .nav-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 10;
      color: var(--text);
      background: rgba(26, 28, 31, 0.6);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border);
      transition: background 150ms ease, transform 150ms ease;

      &:hover {
        background: rgba(35, 38, 42, 0.9);
        transform: translateY(-50%) scale(1.05);
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    }

    .prev-arrow {
      left: 24px;
    }

    .next-arrow {
      right: 24px;
    }

    @media (max-width: 767.98px) {
      .nav-arrow {
        display: none;
      }
    }

    /* Up Next card */
    .up-next-card {
      position: absolute;
      bottom: 28px;
      left: 40px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(26, 28, 31, 0.75);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 14px 8px 8px;
      cursor: pointer;
      color: inherit;
      text-align: left;
      transition: background 150ms ease, transform 150ms ease;

      &:hover {
        background: rgba(35, 38, 42, 0.95);
        transform: translateY(-2px);
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    }

    .up-next-thumb {
      width: 36px;
      height: 48px;
      border-radius: 4px;
      overflow: hidden;
      background: var(--surface-2);
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .thumb-ph {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
      }
    }

    .up-next-info {
      display: flex;
      flex-direction: column;
      max-width: 180px;
    }

    .up-next-tag {
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .up-next-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    @media (max-width: 767.98px) {
      .up-next-card {
        display: none;
      }
    }

    /* Dots */
    .hero-dots {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.35);
      cursor: pointer;
      padding: 0;
      transition: background 200ms ease, transform 200ms ease;

      &:hover {
        background: rgba(255, 255, 255, 0.7);
      }

      &.active {
        background: var(--text);
        transform: scale(1.25);
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    }
  `],
})
export class HeroCarouselComponent implements OnInit {
  readonly slides = input<HeroSlide[]>([]);

  readonly currentIndex = signal(0);
  readonly isPaused = signal(false);
  readonly imageErrors = signal<Record<number, boolean>>({});

  private intervalId: any = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private isUserInteracting = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly authStore = inject(AuthStore);
  private readonly libraryService = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  onWishlist(gameId: number): void {
    if (!this.authStore.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/' } });
      return;
    }
    this.libraryService.set(gameId, 'wishlist').subscribe({
      next: () => {
        this.snackBar.open('Added to Wishlist', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to update wishlist', 'Close', { duration: 3000 });
      },
    });
  }

  readonly currentSlide = computed(() => {
    const list = this.slides();
    return list.length > 0 ? list[this.currentIndex()] : null;
  });

  readonly nextSlideIndex = computed(() => {
    const total = this.slides().length;
    return total > 0 ? (this.currentIndex() + 1) % total : 0;
  });

  readonly nextSlideItem = computed(() => {
    const list = this.slides();
    return list.length > 0 ? list[this.nextSlideIndex()] : null;
  });

  ngOnInit(): void {
    this.startAutoplay();
    this.destroyRef.onDestroy(() => this.stopAutoplay());
  }

  startAutoplay(): void {
    this.stopAutoplay();

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (media.matches) {
        return;
      }
    }

    this.intervalId = setInterval(() => {
      if (
        !this.isPaused() &&
        !this.isUserInteracting &&
        typeof document !== 'undefined' &&
        !document.hidden &&
        this.slides().length > 1
      ) {
        this.nextSlide();
      }
    }, 7000);
  }

  stopAutoplay(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  nextSlide(): void {
    const total = this.slides().length;
    if (total <= 1) return;
    this.currentIndex.update((i) => (i + 1) % total);
  }

  prevSlide(): void {
    const total = this.slides().length;
    if (total <= 1) return;
    this.currentIndex.update((i) => (i - 1 + total) % total);
  }

  goToSlide(idx: number): void {
    const total = this.slides().length;
    if (idx >= 0 && idx < total) {
      this.currentIndex.set(idx);
    }
  }

  onImageError(gameId: number): void {
    this.imageErrors.update((m) => ({ ...m, [gameId]: true }));
  }

  onMouseEnter(): void {
    this.isPaused.set(true);
  }

  onMouseLeave(): void {
    this.isPaused.set(false);
  }

  onFocusIn(): void {
    this.isPaused.set(true);
  }

  onFocusOut(): void {
    this.isPaused.set(false);
  }

  onTouchStart(e: TouchEvent): void {
    this.isUserInteracting = true;
    this.isPaused.set(true);
    if (e.touches && e.touches.length > 0) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }
  }

  onTouchEnd(e: TouchEvent): void {
    this.isUserInteracting = false;
    this.isPaused.set(false);
    if (e.changedTouches && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - this.touchStartX;
      const deltaY = e.changedTouches[0].clientY - this.touchStartY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) >= 50) {
        if (deltaX < 0) {
          this.nextSlide();
        } else {
          this.prevSlide();
        }
      }
    }
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      this.isPaused.set(true);
    } else {
      this.isPaused.set(false);
    }
  }
}
