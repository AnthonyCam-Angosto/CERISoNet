import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Mur } from './mur/mur';

export const routes: Routes = [
    {path:'',redirectTo:'login',pathMatch:"full"}, //route par défaut redirige vers login
    {path:'login',component:Login}, //route pour la page de login
    {path:'main',component:Mur}];//route pour la page principale (mur)
