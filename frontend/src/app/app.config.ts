import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { AuthService } from './services/auth.service';
import { AuthStore } from './services/auth.store';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      })
    ),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    provideAppInitializer(() => {
      const authStore = inject(AuthStore);
      const authService = inject(AuthService);
      if (authStore.token()) {
        return firstValueFrom(
          authService.me().pipe(
            catchError(() => {
              authStore.clear();
              return of(null);
            })
          )
        );
      }
      return Promise.resolve();
    }),
  ],
};
