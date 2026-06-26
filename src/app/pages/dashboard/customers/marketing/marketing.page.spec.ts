import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketingPage } from './marketing.page';

describe('MarketingPage', () => {
  let component: MarketingPage;
  let fixture: ComponentFixture<MarketingPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MarketingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
