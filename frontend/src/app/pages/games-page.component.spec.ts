import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';
import { GamesPageComponent } from './games-page.component';
import { GamesService } from '../services/games.service';
import { environment } from '../../environments/environment';

describe('GamesPageComponent - Query Param & State Mapping', () => {
  let httpMock: HttpTestingController;
  let queryParams$: BehaviorSubject<any>;
  let router: Router;

  beforeEach(async () => {
    queryParams$ = new BehaviorSubject<any>({});

    const mockActivatedRoute = {
      queryParams: queryParams$.asObservable(),
      snapshot: {
        queryParamMap: convertToParamMap({}),
      },
    };

    await TestBed.configureTestingModule({
      imports: [GamesPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        GamesService,
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps default query params to initial HTTP request', () => {
    const fixture = TestBed.createComponent(GamesPageComponent);
    fixture.detectChanges();

    const genresReq = httpMock.expectOne(`${environment.apiUrl}/genres`);
    genresReq.flush([]);

    const gamesReq = httpMock.expectOne(
      `${environment.apiUrl}/games?sort=rating&page=1&page_size=20`
    );
    expect(gamesReq.request.method).toBe('GET');
    gamesReq.flush({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });
  });

  it('restores state when navigating/reloading /games?genre=action&sort=title&page=2', async () => {
    // Simulate reloading with query params in URL
    queryParams$.next({
      genre: 'action',
      sort: 'title',
      page: '2',
    });

    const fixture = TestBed.createComponent(GamesPageComponent);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp.genre()).toBe('action');
    expect(comp.sort()).toBe('title');
    expect(comp.page()).toBe(2);
    expect(comp.q()).toBe('');

    const genresReq = httpMock.expectOne(`${environment.apiUrl}/genres`);
    genresReq.flush([
      { id: 1, name: 'Action', slug: 'action', game_count: 50 },
    ]);

    const gamesReq = httpMock.expectOne(
      `${environment.apiUrl}/games?genre=action&sort=title&page=2&page_size=20`
    );
    expect(gamesReq.request.method).toBe('GET');
    gamesReq.flush({
      items: [
        {
          id: 5,
          title: 'Action Hero',
          slug: 'action-hero',
          cover_url: null,
          release_date: '2024-01-01',
          platforms: ['PC'],
          genres: [{ name: 'Action', slug: 'action' }],
          avg_score: 8.0,
          review_count: 10,
        },
      ],
      total: 30,
      page: 2,
      page_size: 20,
    });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.gamesPage()?.items.length).toBe(1);
    expect(comp.gamesPage()?.total).toBe(30);
  });

  it('updates router params when changing genre, sort, and page', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(GamesPageComponent);
    fixture.detectChanges();

    const genresReq = httpMock.expectOne(`${environment.apiUrl}/genres`);
    genresReq.flush([]);
    const gamesReq = httpMock.expectOne(
      `${environment.apiUrl}/games?sort=rating&page=1&page_size=20`
    );
    gamesReq.flush({ items: [], total: 0, page: 1, page_size: 20 });

    const comp = fixture.componentInstance;

    // Change genre
    comp.onGenreChange('rpg');
    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { genre: 'rpg', page: null },
      queryParamsHandling: 'merge',
    }));

    // Change sort
    comp.onSortChange('release');
    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { sort: 'release', page: null },
      queryParamsHandling: 'merge',
    }));

    // Change page
    comp.onPageChange({ page: 3, pageSize: 20 });
    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { page: 3 },
      queryParamsHandling: 'merge',
    }));
  });

  it('debounces search input by 300ms before navigating', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(GamesPageComponent);
    fixture.detectChanges();

    const genresReq = httpMock.expectOne(`${environment.apiUrl}/genres`);
    genresReq.flush([]);
    const gamesReq = httpMock.expectOne(
      `${environment.apiUrl}/games?sort=rating&page=1&page_size=20`
    );
    gamesReq.flush({ items: [], total: 0, page: 1, page_size: 20 });

    const comp = fixture.componentInstance;
    comp.onSearchInput('metroid');

    // Immediately after typing, navigate should not have fired yet
    expect(navigateSpy).not.toHaveBeenCalled();

    // Wait >300ms for debounce
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { q: 'metroid', page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    }));
  });
});
