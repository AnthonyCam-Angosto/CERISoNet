import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Bandeau } from './bandeau';

describe('Bandeau', () => {
  let component: Bandeau;
  let fixture: ComponentFixture<Bandeau>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Bandeau]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Bandeau);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
