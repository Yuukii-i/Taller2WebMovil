import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { MatListModule } from '@angular/material/list';
import { FormsModule } from '@angular/forms';
import { SITE_NAME } from './site.config';
import { AuthStore } from './services/auth.store';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatMenuModule,
    MatListModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly siteName = SITE_NAME;
  readonly authStore = inject(AuthStore);
  readonly authService = inject(AuthService);
  readonly router = inject(Router);
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly isMobile = toSignal(
    this.breakpointObserver
      .observe('(max-width: 767.98px)')
      .pipe(map((res) => res.matches)),
    { initialValue: false }
  );

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects || e.url)
    ),
    { initialValue: '/' }
  );

  readonly scrollY = signal(0);
  readonly isScrolled = computed(() => this.scrollY() > 40);
  readonly isHome = computed(() => {
    const url = this.currentUrl();
    return url === '/' || url === '' || url.startsWith('/?');
  });
  readonly isTransparentToolbar = computed(
    () => this.isHome() && !this.isScrolled()
  );

  searchQuery = '';

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (typeof window !== 'undefined') {
      this.scrollY.set(window.scrollY || window.pageYOffset || 0);
    }
  }

  onSearch(query: string, drawer?: { close: () => void }): void {
    const trimmed = query.trim();
    if (trimmed) {
      this.router.navigate(['/games'], { queryParams: { q: trimmed } });
      this.searchQuery = '';
      if (drawer) {
        drawer.close();
      }
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: () => {
        this.router.navigate(['/']);
      },
    });
  }
}
