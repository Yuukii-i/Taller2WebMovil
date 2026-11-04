import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home-page.component').then((m) => m.HomePageComponent),
  },
  {
    path: 'games',
    loadComponent: () =>
      import('./pages/games-page.component').then((m) => m.GamesPageComponent),
  },
  {
    path: 'games/:id',
    loadComponent: () =>
      import('./pages/game-detail-page.component').then(
        (m) => m.GameDetailPageComponent
      ),
  },
  {
    path: 'reviews/:id',
    loadComponent: () =>
      import('./pages/review-detail-page.component').then(
        (m) => m.ReviewDetailPageComponent
      ),
  },
  {
    path: 'u/:username',
    loadComponent: () =>
      import('./pages/profile-page.component').then(
        (m) => m.ProfilePageComponent
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login-page.component').then(
        (m) => m.LoginPageComponent
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register-page.component').then(
        (m) => m.RegisterPageComponent
      ),
  },
  {
    path: 'library',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/library-redirect-page.component').then(
        (m) => m.LibraryRedirectPageComponent
      ),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found-page.component').then(
        (m) => m.NotFoundPageComponent
      ),
  },
];
