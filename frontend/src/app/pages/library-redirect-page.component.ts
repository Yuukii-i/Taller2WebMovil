import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../services/auth.store';

@Component({
  selector: 'app-library-redirect-page',
  standalone: true,
  template: ``,
})
export class LibraryRedirectPageComponent {
  constructor() {
    const authStore = inject(AuthStore);
    const router = inject(Router);
    const username = authStore.user()?.username;
    if (username) {
      router.navigate(['/u', username]);
    } else {
      router.navigate(['/']);
    }
  }
}
