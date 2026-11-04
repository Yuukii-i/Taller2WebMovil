import { Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Page, ReviewWithGame, UserLibraryItem, UserPublic } from '../models';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly baseUrl = environment.apiUrl;

  profile(usernameFn: () => string | null | undefined) {
    return httpResource<UserPublic>(() => {
      const u = usernameFn();
      if (!u) return undefined;
      return `${this.baseUrl}/users/${encodeURIComponent(u)}`;
    });
  }

  library(
    usernameFn: () => string | null | undefined,
    statusFn: () => string | null | undefined = () => null,
    pageFn: () => number | null | undefined = () => 1,
    pageSizeFn: () => number | null | undefined = () => 20
  ) {
    return httpResource<Page<UserLibraryItem>>(() => {
      const u = usernameFn();
      if (!u) return undefined;

      const searchParams = new URLSearchParams();
      const status = statusFn();
      if (status) {
        searchParams.set('status', status);
      }
      const page = pageFn() || 1;
      const pageSize = pageSizeFn() || 20;
      searchParams.set('page', String(page));
      searchParams.set('page_size', String(pageSize));

      return `${this.baseUrl}/users/${encodeURIComponent(u)}/library?${searchParams.toString()}`;
    });
  }

  reviews(
    usernameFn: () => string | null | undefined,
    pageFn: () => number | null | undefined = () => 1,
    pageSizeFn: () => number | null | undefined = () => 20
  ) {
    return httpResource<Page<ReviewWithGame>>(() => {
      const u = usernameFn();
      if (!u) return undefined;

      const searchParams = new URLSearchParams();
      const page = pageFn() || 1;
      const pageSize = pageSizeFn() || 20;
      searchParams.set('page', String(page));
      searchParams.set('page_size', String(pageSize));

      return `${this.baseUrl}/users/${encodeURIComponent(u)}/reviews?${searchParams.toString()}`;
    });
  }
}
