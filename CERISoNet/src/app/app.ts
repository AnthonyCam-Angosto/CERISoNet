import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Bandeau } from "./bandeau/bandeau";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Bandeau],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('CERISoNet');
}
