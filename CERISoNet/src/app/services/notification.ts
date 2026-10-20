import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Interface pour représenter une notification
 */
export interface Notification { 
  message: string; // message de la notification
  type: 'success' | 'error' | 'info'; // type de la notification pour le style
  visible: boolean; // indique si la notification est visible ou non
}

@Injectable({providedIn: 'root'})
export class NotificationService {

  //creation d'un objet notification avec un message vide
  private _notification = new BehaviorSubject<Notification>({ 
    message: '', 
    type: 'info', 
    visible: false
  });

  notification$ = this._notification.asObservable(); // observable pour que les composants puissent s'abonner aux notifications

  /**
   * méthode pour afficher une notification
   * @param message message de la notification
   * @param type type de la notification par défaut 'info'
   * @param duration durée d'affichage de la notification en millisecondes, par défaut 4000ms
   */
  show(message: string, type: Notification['type'] = 'info', duration = 4000) { 
    this._notification.next({ message, type, visible: true });
    setTimeout(() => this.hide(), duration); 
  } 

  /**
   * méthode pour cacher la notification
   */
  hide() { 
    this._notification.next({ ...this._notification.value, visible: false }); 
  }
}
