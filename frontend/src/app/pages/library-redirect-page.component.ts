import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../services/auth.store';

@Component({
  selector: 'app-library-redirect-page',
  standalone: true,
  template: ``,
})
export class LibraryRedirectPageComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const username = this.authStore.user()?.username;
    if (username) {
      this.router.navigate(['/u', username], {
        queryParams: { tab: 'wishlist' },
        replaceUrl: true,
      });
    } else {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/library' },
        replaceUrl: true,
      });
    }
  }
}
