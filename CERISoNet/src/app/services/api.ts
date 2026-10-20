import { HttpClient,HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class APIService {
  constructor(private http: HttpClient) {} 
  
  /**
   * méthode pour envoyer une requete de login au backend
   * @param data body de la requete login contenant les champs email et password
   * @returns reponse de la requete login
   */
  login(data: any) { 
    return this.http.post("/login", data,{withCredentials: true}); 
  }

  /**
   * méthode pour recuperer une partie des posts du backend
   * @param page numero de la page a recuperer
   * @param limit nombre de posts par page
   * @returns reponse de la requete allposts
   */
  allposts(page: number = 1, limit: number =10,filter: string = "",value: string = "",trier: string = "") {
    let params = new HttpParams();
    params = params.set('page', String(page));
    params = params.set('limit', String(limit));
    if (filter!= "" && value!="") {
      params = params.set('filter', filter);
      params = params.set('value', value);
    }
    if (trier!= "") {
      params = params.set('sort', trier);
    }


    return this.http.get("/allposts", {
      withCredentials: true,
      params
    });
  }
  
  addpost(data: any) {
    return this.http.post("/addpost", data,{withCredentials: true});
  }

  addcomment(postId: number | string, text: string) {
    return this.http.post("/addcomment", { postId, text }, {withCredentials: true});
  }
}
