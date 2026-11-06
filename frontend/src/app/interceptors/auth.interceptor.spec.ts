import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from '../services/auth.store';
import { environment } from '../../environments/environment';
import { User } from '../models';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authStore: AuthStore;

  const mockUser: User = {
    id: 1,
    username: 'bob',
    email: 'bob@example.com',
    created_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthStore,
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authStore = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches Authorization header when requesting environment.apiUrl and token is set', () => {
    authStore.setSession('sample-jwt-token', mockUser);

    http.get(`${environment.apiUrl}/games`).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/games`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sample-jwt-token');
    req.flush([]);
  });

  it('does NOT attach Authorization header when token is null', () => {
    authStore.clear();

    http.get(`${environment.apiUrl}/games`).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/games`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('does NOT attach Authorization header to non-API URLs even if token is present', () => {
    authStore.setSession('sample-jwt-token', mockUser);

    http.get('https://api.igdb.com/v4/games').subscribe();

    const req = httpMock.expectOne('https://api.igdb.com/v4/games');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
