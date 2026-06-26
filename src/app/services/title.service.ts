// src/app/services/title.service.ts
import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, mergeMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TitleService {
  private defaultTitle = '28dias - Business Suite';

  constructor(
    private titleService: Title,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.listenToRouteChanges();
  }

  private listenToRouteChanges() {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => this.activatedRoute),
        map(route => {
          while (route.firstChild) {
            route = route.firstChild;
          }
          return route;
        }),
        filter(route => route.outlet === 'primary'),
        mergeMap(route => route.data)
      )
      .subscribe(data => {
        const title = data['title'];
        if (title) {
          this.titleService.setTitle(`${title} | 28dias`);
        } else {
          this.titleService.setTitle(this.defaultTitle);
        }
      });
  }

  setTitle(title: string) {
    this.titleService.setTitle(`${title} | 28dias`);
  }

  resetTitle() {
    this.titleService.setTitle(this.defaultTitle);
  }
}