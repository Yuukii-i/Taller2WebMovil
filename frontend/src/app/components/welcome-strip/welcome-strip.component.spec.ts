import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WelcomeStripComponent } from './welcome-strip.component';
import { AuthStore } from '../../services/auth.store';
import { LibraryService } from '../../services/library.service';
import { environment } from '../../../environments/environment';

describe('WelcomeStripComponent', () => {
  let authStore: AuthStore;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [WelcomeStripComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthStore,
        LibraryService,
      ],
    }).compileComponents();

    authStore = TestBed.inject(AuthStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders logged-out pitch and buttons when anonymous', () => {
    authStore.clear();

    const fixture = TestBed.createComponent(WelcomeStripComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.welcome-pitch')?.textContent).toContain(
      'Track what you play. Review what you finish.'
    );
    expect(el.querySelector('.btn-primary')?.textContent).toContain('Sign up');
    expect(el.querySelector('.btn-secondary')?.textContent).toContain('Log in');
  });

  it('renders currently playing shelf when logged in with playing games', async () => {
    authStore.setSession('test-token', {
      id: 1,
      username: 'gamer_john',
      email: 'john@example.com',
      created_at: '2026-01-01',
    });

    const fixture = TestBed.createComponent(WelcomeStripComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/users/gamer_john/library?status=playing`
    );
    req.flush([
      {
        game: {
          id: 10,
          title: 'Elden Ring',
          slug: 'elden-ring',
          cover_url: null,
          release_date: '2022-02-25',
          platforms: ['PC'],
          genres: [{ name: 'RPG', slug: 'rpg' }],
          avg_score: 9.6,
          review_count: 80,
        },
        status: 'playing',
        updated_at: '2026-01-01',
      },
    ]);

    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.welcome-strip')).toBeNull();
    expect(el.textContent).toContain('Currently playing');
    expect(el.textContent).toContain('Elden Ring');
  });

  it('hides currently playing shelf when logged in with empty library', async () => {
    authStore.setSession('test-token', {
      id: 1,
      username: 'gamer_empty',
      email: 'empty@example.com',
      created_at: '2026-01-01',
    });

    const fixture = TestBed.createComponent(WelcomeStripComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/users/gamer_empty/library?status=playing`
    );
    req.flush([]);

    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.welcome-strip')).toBeNull();
    expect(el.querySelector('app-game-shelf')).toBeNull();
  });
});
