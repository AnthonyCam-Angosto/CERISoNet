import { Injectable } from '@angular/core';
import { Observable,throwError } from 'rxjs';

import { io } from 'socket.io-client';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  
  socket;
  constructor() {
    //this.socket = io('https://localhost:3140', {autoConnect: false});
    this.socket = io('https://pedago.univ-avignon.fr:3140', {autoConnect: false});
  }

  connect() {
    this.socket.connect();
    this.socket.on('connect', () => {
      console.log('WebSocket connecté avec succès');
    });
  }

  isStarted(){
    return this.socket.connected;
  }

  notif_connect(){
    let notifs=[];
    notifs.push(this.listen("userDisconnected"));
    notifs.push(this.listen("userConnected"));

    return notifs;
  }

  notif_like(){
    let notifs=[];
    notifs.push(this.listen("postLiked"));
    notifs.push(this.listen("postUnliked"));
    return notifs;
  }


  /**
   * Permet d'émettre des événements vers le serveur via le WebSocket.
   * @param eventName type de l'événement à émettre
   * @param data données à envoyer avec l'événement
   */
  emit(eventName: string, data: any) {
    this.socket.emit(eventName, data);
  }

  /**
   * Permet d'écouter les événements émis par le serveur via le WebSocket.
   * @param eventName type de l'événement à écouter
   * @returns observable qui émet les données reçues à tous les abonnés de cet Observable
   */
  listen(eventName: string):Observable<any> {
    return new Observable((subscriber) => {
      this.socket.on(eventName, (data) => {
        subscriber.next(data);// émet les données reçues à tous les abonnés de cet Observable
      });
    });

  }


}
