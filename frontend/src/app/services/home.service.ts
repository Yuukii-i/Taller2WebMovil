import { Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Genre, Home } from '../models';

@Injectable({
  providedIn: 'root',
})
export class HomeService {
  private readonly baseUrl = environment.apiUrl;

  home() {
    return httpResource<Home>(() => `${this.baseUrl}/home`);
  }

  genres() {
    return httpResource<Genre[]>(() => `${this.baseUrl}/genres`);
  }
}
