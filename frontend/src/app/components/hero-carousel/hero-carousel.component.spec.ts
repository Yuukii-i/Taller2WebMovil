import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { HeroCarouselComponent } from './hero-carousel.component';
import { HeroSlide, buildSlides } from './hero-carousel.types';
import { GameCard, Home } from '../../models';
import { AuthStore } from '../../services/auth.store';
import { LibraryService } from '../../services/library.service';

describe('Hero Carousel & buildSlides', () => {
  const makeGame = (id: number, title: string, avg_score = 9.0): GameCard => ({
    id,
    title,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    cover_url: `https://example.com/covers/${id}.jpg`,
    release_date: '2025-01-01',
    platforms: ['PC'],
    genres: [{ name: 'Action', slug: 'action' }],
    avg_score,
    review_count: 10,
  });

  describe('buildSlides pure function', () => {
    it('deduplicates games across lists by picking the next unused game', () => {
      const g1 = makeGame(1, 'Game 1', 9.5);
      const g2 = makeGame(2, 'Game 2', 8.5);

      const mockHome: Home = {
        top_rated: [{ game: g1, avg_score: 9.5, review_count: 20 }],
        most_wishlisted: [
          { game: g1, count: 500 }, // g1 already used by top_rated!
          { game: g2, count: 400 }, // g2 should be picked
        ],
        most_playing: [],
        most_completed: [],
        most_abandoned: [],
        recent_reviews: [],
      };

      const slides = buildSlides(mockHome);

      expect(slides.length).toBe(2);
      expect(slides[0].game.id).toBe(1);
      expect(slides[0].kicker).toBe('Best reviewed');
      expect(slides[1].game.id).toBe(2);
      expect(slides[1].kicker).toBe('Most wishlisted');
      expect(slides[1].stat).toBe('400 wishlists');
    });

    it('skips empty lists gracefully', () => {
      const g1 = makeGame(1, 'Game 1');

      const mockHome: Home = {
        top_rated: [],
        most_wishlisted: [{ game: g1, count: 120 }],
        most_playing: [],
        most_completed: [],
        most_abandoned: [],
        recent_reviews: [],
      };

      const slides = buildSlides(mockHome);
      expect(slides.length).toBe(1);
      expect(slides[0].game.id).toBe(1);
      expect(slides[0].kicker).toBe('Most wishlisted');
    });

    it('uses fallback game when home showcase lists are all empty', () => {
      const mockHome: Home = {
        top_rated: [],
        most_wishlisted: [],
        most_playing: [],
        most_completed: [],
        most_abandoned: [],
        recent_reviews: [],
      };

      const fallbackGames = [makeGame(99, 'Fallback Hero', 8.8)];
      const slides = buildSlides(mockHome, fallbackGames);

      expect(slides.length).toBe(1);
      expect(slides[0].game.id).toBe(99);
      expect(slides[0].kicker).toBe('Top pick');
      expect(slides[0].stat).toBe('8.8 / 10');
    });

    it('returns empty array when home and fallback are both empty', () => {
      const mockHome: Home = {
        top_rated: [],
        most_wishlisted: [],
        most_playing: [],
        most_completed: [],
        most_abandoned: [],
        recent_reviews: [],
      };

      expect(buildSlides(mockHome, [])).toEqual([]);
      expect(buildSlides(null, null)).toEqual([]);
    });
  });

  describe('HeroCarouselComponent Timer & Interactions', () => {
    const mockSlides: HeroSlide[] = [
      { game: makeGame(1, 'Zelda'), kicker: 'Best reviewed', stat: '9.8 / 10 · 50 reviews' },
      { game: makeGame(2, 'Metroid'), kicker: 'Most wishlisted', stat: '300 wishlists' },
      { game: makeGame(3, 'Mario'), kicker: 'Played right now', stat: '100 playing' },
    ];

    let mockAuthStore: { isLoggedIn: ReturnType<typeof vi.fn> };
    let mockLibraryService: { set: ReturnType<typeof vi.fn> };
    let mockSnackBar: { open: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      mockAuthStore = { isLoggedIn: vi.fn().mockReturnValue(true) };
      mockLibraryService = {
        set: vi.fn().mockReturnValue(of({ game_id: 1, status: 'wishlist', updated_at: 'now' })),
      };
      mockSnackBar = { open: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [HeroCarouselComponent],
        providers: [
          provideRouter([]),
          { provide: AuthStore, useValue: mockAuthStore },
          { provide: LibraryService, useValue: mockLibraryService },
          { provide: MatSnackBar, useValue: mockSnackBar },
        ],
      }).compileComponents();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('advances after 7 s and pauses on hover', () => {
      vi.useFakeTimers();

      const fixture = TestBed.createComponent(HeroCarouselComponent);
      fixture.componentRef.setInput('slides', mockSlides);
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      expect(comp.currentIndex()).toBe(0);

      // Advance 7s
      vi.advanceTimersByTime(7000);
      expect(comp.currentIndex()).toBe(1);

      // Pause on hover
      comp.onMouseEnter();
      expect(comp.isPaused()).toBe(true);

      // Advance another 7s while paused
      vi.advanceTimersByTime(7000);
      expect(comp.currentIndex()).toBe(1); // Did not advance

      // Unpause on mouse leave
      comp.onMouseLeave();
      expect(comp.isPaused()).toBe(false);

      // Advance 7s
      vi.advanceTimersByTime(7000);
      expect(comp.currentIndex()).toBe(2);
    });

    it('does not autoplay when prefers-reduced-motion is active', () => {
      vi.useFakeTimers();

      // Mock matchMedia for prefers-reduced-motion
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      try {
        const fixture = TestBed.createComponent(HeroCarouselComponent);
        fixture.componentRef.setInput('slides', mockSlides);
        fixture.detectChanges();

        const comp = fixture.componentInstance;
        expect(comp.currentIndex()).toBe(0);

        // Advance 14s
        vi.advanceTimersByTime(14000);
        expect(comp.currentIndex()).toBe(0); // Never advances
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });

    it('calls libraryService.set and shows snackbar when logged in user clicks Add to wishlist', () => {
      mockAuthStore.isLoggedIn.mockReturnValue(true);

      const fixture = TestBed.createComponent(HeroCarouselComponent);
      fixture.componentRef.setInput('slides', mockSlides);
      fixture.detectChanges();

      const wishlistBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-secondary');
      expect(wishlistBtn).toBeTruthy();
      expect(wishlistBtn.textContent).toContain('Add to wishlist');

      wishlistBtn.click();
      fixture.detectChanges();

      expect(mockLibraryService.set).toHaveBeenCalledWith(1, 'wishlist');
      expect(mockSnackBar.open).toHaveBeenCalledWith('Added to Wishlist', 'Close', expect.any(Object));
    });

    it('navigates to /login?returnUrl=/ when logged out user clicks Add to wishlist', () => {
      mockAuthStore.isLoggedIn.mockReturnValue(false);
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      const fixture = TestBed.createComponent(HeroCarouselComponent);
      fixture.componentRef.setInput('slides', mockSlides);
      fixture.detectChanges();

      const wishlistBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-secondary');
      wishlistBtn.click();
      fixture.detectChanges();

      expect(mockLibraryService.set).not.toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
    });
  });
});
