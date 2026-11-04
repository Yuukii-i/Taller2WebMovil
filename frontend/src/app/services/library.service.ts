import { Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { UserLibraryItem } from '../models';

@Injectable({
  providedIn: 'root',
})
export class LibraryService {
  private readonly baseUrl = environment.apiUrl;

  getPlaying(usernameFn: () => string | null | undefined) {
    return httpResource<UserLibraryItem[]>(() => {
      const u = usernameFn();
      if (!u) return undefined;
      return `${this.baseUrl}/users/${encodeURIComponent(u)}/library?status=playing`;
    });
  }
}
