import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../services/auth.store';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthRoute = req.url.includes('/auth/');

      if (error.status === 401 && !isAuthRoute) {
        authStore.clear();
        snackBar.open('Session expired', 'Dismiss', { duration: 4000 });
        const currentUrl = router.url;
        router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
      } else if (error.status === 0 || error.status >= 500) {
        snackBar.open('Server unavailable / unexpected error', 'Dismiss', {
          duration: 5000,
        });
      }

      return throwError(() => error);
    })
  );
};
