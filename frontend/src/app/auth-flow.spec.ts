import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BreakpointObserver } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './services/auth.service';
import { AuthStore } from './services/auth.store';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { environment } from '../environments/environment';

describe('Auth Flow & Routing UI Flow', () => {
  let authService: AuthService;
  let authStore: AuthStore;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        AuthStore,
        AuthService,
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('register -> login -> shows user menu -> reload keeps session -> logout returns to anon', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const rootEl = fixture.nativeElement as HTMLElement;

    // 1. Anonymous state
    expect(authStore.isLoggedIn()).toBe(false);
    expect(rootEl.querySelector('.auth-buttons')).not.toBeNull();
    expect(rootEl.querySelector('.user-menu-btn')).toBeNull();

    // 2. Register flow
    const uniqueUser = 'tester_flow';
    authService
      .register({
        username: uniqueUser,
        email: `${uniqueUser}@example.com`,
        password: 'Password123!',
      })
      .subscribe((res) => {
        expect(res.username).toBe(uniqueUser);
      });

    const regReq = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
    regReq.flush({
      id: 99,
      username: uniqueUser,
      email: `${uniqueUser}@example.com`,
      created_at: new Date().toISOString(),
    });

    // 3. Login flow
    authService
      .login({
        identifier: uniqueUser,
        password: 'Password123!',
      })
      .subscribe((res) => {
        expect(res.access_token).toBe('mock-jwt-token');
      });

    const loginReq = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    loginReq.flush({
      access_token: 'mock-jwt-token',
      token_type: 'bearer',
      user: {
        id: 99,
        username: uniqueUser,
        email: `${uniqueUser}@example.com`,
        created_at: new Date().toISOString(),
      },
    });

    fixture.detectChanges();
    await fixture.whenStable();

    // Toolbar now shows user menu
    const userMenuBtn = rootEl.querySelector('.user-menu-btn');
    expect(userMenuBtn).not.toBeNull();
    expect(userMenuBtn?.textContent).toContain(`@${uniqueUser}`);
    expect(rootEl.querySelector('.auth-buttons')).toBeNull();

    // 4. Reload page keeps session: read from localStorage
    const reloadedStore = new AuthStore();
    expect(reloadedStore.isLoggedIn()).toBe(true);
    expect(reloadedStore.user()?.username).toBe(uniqueUser);

    // 5. Logout returns to anon state
    authService.logout().subscribe();
    const logoutReq = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(logoutReq.request.headers.get('Authorization')).toBe('Bearer mock-jwt-token');
    logoutReq.flush({});

    expect(authStore.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('auth_token')).toBeNull();

    fixture.detectChanges();
    await fixture.whenStable();

    expect(rootEl.querySelector('.auth-buttons')).not.toBeNull();
    expect(rootEl.querySelector('.user-menu-btn')).toBeNull();
  });

  it('visiting /library anonymously redirects to /login?returnUrl=%2Flibrary', async () => {
    authStore.clear();
    await router.navigateByUrl('/library');
    expect(router.url).toBe('/login?returnUrl=%2Flibrary');
  });

  it('at width <= 767.98px (e.g. 360px), hamburger replaces desktop nav', async () => {
    const breakpoint$ = new BehaviorSubject<{ matches: boolean }>({ matches: true });
    const mockBreakpointObserver = {
      observe: () => breakpoint$.asObservable(),
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
      ],
    }).compileComponents();

    const mobileFixture = TestBed.createComponent(App);
    mobileFixture.detectChanges();
    const el = mobileFixture.nativeElement as HTMLElement;

    // Mobile mode
    expect(el.querySelector('.hamburger-btn')).not.toBeNull();
    expect(el.querySelector('.nav-links')).toBeNull();

    // Switch to desktop mode
    breakpoint$.next({ matches: false });
    mobileFixture.detectChanges();

    expect(el.querySelector('.hamburger-btn')).toBeNull();
    expect(el.querySelector('.nav-links')).not.toBeNull();
  });
});
