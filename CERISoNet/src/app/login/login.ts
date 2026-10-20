import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators,ReactiveFormsModule } from '@angular/forms';
import { APIService } from '../services/api';
import { Router } from '@angular/router';
import { NotificationService } from '../services/notification';
import {LocalStorageService} from '../services/local-storage';
import { WebSocketService } from '../services/web-socket-service';


@Component({
  selector: 'app-login',
  imports: [CommonModule,ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  loginForm: FormGroup; // Formulaire de connexion
  loading = false; //variable pour indiquer l'état du bouton de connexion
  error: string | null = null; // Message d'erreur à afficher
  last_con="";// Dernière connexion stocker dans le local storage
  socket:WebSocketService;// Service WebSocket pour gérer les communications en temps réel

  constructor(private fb: FormBuilder,private api:APIService,private router: Router,private notif: NotificationService,private ls:LocalStorageService,socket:WebSocketService) { 
    // Initialisation du formulaire de connexion avec les champs email et password et leurs validateurs respectifs
    this.loginForm = this.fb.group({
       email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]], 
    });
    this.socket=socket;

    const temp=ls.getLastConnexion();// Récupération de la dernière connexion depuis le local storage
    if(temp!=null){
      this.last_con=temp;
    }else{
      this.last_con="";
    }
  }

  /**
   * méthode appelée lors de l'envoi du formulaire de connexion.
   * elle vérifie si le formulaire est valide et si l'utilisateur existe.
   * pendand le chargement, le bouton affiche un spinner et le desactive
   * affichage d'un bandeau pour indiquer le résultat de la tentative de connexion.
   * @returns void
   */
  submit() { 
    if (this.loginForm.invalid) { 
      this.loginForm.markAllAsTouched(); 
      return; 
    }
    this.loading = true; 
    this.error = null;

    this.api.login(this.loginForm.value).subscribe({
      next: res =>{
        this.loading=false;
        this.notif.show("connection reussi, derniere connexion: " + this.last_con,'success');
        this.ls?.saveLastConnexion(new Date().toLocaleString());

        this.socket.connect();

        //navigation vers la page principale avec un message de succès pour l'afficher sur le bandeau
        this.router.navigate(["/main"],{
          state:{notif:{message:"connection reussi, derniere connexion: " + this.last_con,type:"success"}}
        });
      },
      error: err => {
        this.notif.show(err.error,'error');
        this.loginForm.get('password')?.reset();
        this.loading=false;
      }
    });
  }
}


