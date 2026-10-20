import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Mur } from './mur';

describe('Mur', () => {
  let component: Mur;
  let fixture: ComponentFixture<Mur>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mur]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Mur);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
