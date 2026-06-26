import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WebsitePage } from './website.page';

describe('WebsitePage', () => {
  let component: WebsitePage;
  let fixture: ComponentFixture<WebsitePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(WebsitePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
