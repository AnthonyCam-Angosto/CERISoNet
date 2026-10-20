import { Injectable,inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private platformId = inject(PLATFORM_ID);//injection de la plateforme pour vérifier si on est dans un navigateur

  /**
   * méthode pour sauvegarder la date de la dernière connexion dans le local storage
   * @param date_lastcon date de la dernière connexion en format texte
   */
  saveLastConnexion(date_lastcon:string):void{
    if(isPlatformBrowser(this.platformId)){
      localStorage.setItem("last_con",date_lastcon);
    }
  }

  /**
   * méthode pour récupérer la date de la dernière connexion depuis le local storage
   * @returns la date de la dernière connexion ou null si non trouvée
   */
  getLastConnexion():string | null{
    if(isPlatformBrowser(this.platformId)){
      const date_lastcon=localStorage.getItem("last_con");
      return date_lastcon;
    }
    return null;
  }
}
