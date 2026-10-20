import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../services/notification';

@Component({
  selector: 'app-bandeau',
  imports: [CommonModule],
  templateUrl: './bandeau.html',
  styleUrl: './bandeau.css',
})
export class Bandeau {
  constructor(public notificationService: NotificationService) {}
}
