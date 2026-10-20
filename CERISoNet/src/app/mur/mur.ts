import { AfterViewInit, Component, ElementRef, inject, Inject, OnDestroy, PLATFORM_ID, signal, ViewChild } from '@angular/core';
import { NotificationService } from '../services/notification';
import { APIService } from '../services/api';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {MatDialog} from '@angular/material/dialog';
import {MatInputModule} from '@angular/material/input';
import { Router } from '@angular/router';
import { WebSocketService } from '../services/web-socket-service';
import { Comment, Post } from '../services/mur-types';
import { NewPostDialog } from './new-post-dialog';


@Component({
  selector: 'app-mur',
  imports: [CommonModule, MatInputModule],
  templateUrl: './mur.html',
  styleUrl: './mur.css',
})
export class Mur {
  @ViewChild('scrollSentinel') scrollSentinel?: ElementRef<HTMLDivElement>;

  allposts:Post[]=[];
  posts=signal<Post[]>([]);
  readonly dialog = inject(MatDialog);
  typeFiltre=signal<string>("auteur");
  sortType=signal<string>("newest");
  filtreText=signal<string>("");

  page=signal<number>(1);
  readonly pageSize=10;
  isLoadingMore=signal<boolean>(false);
  hasMore=signal<boolean>(true);
  private observer: IntersectionObserver | null = null;
  
  activeCommentPostId=signal<number | string | null>(null);
  commentDraft=signal<string>("");
  openCommentSections=signal<Array<number | string>>([]);

  constructor(private notificationService: NotificationService,private api:APIService,@Inject(PLATFORM_ID) private platformId: any,private router: Router,private socket: WebSocketService) {}

  /**
   * méthode appelée lors de l'initialisation du composant pour afficher une notification si un message est présent dans l'état de navigation
   * et pour récupérer les posts si on est dans un navigateur, 
   * et pour se connecter au socket si ce n'est pas déjà fait, 
   * et pour écouter les notifications de nouveaux posts et de likes
   * @returns void
   */
  ngOnInit() {
    if (typeof history !== 'undefined') {
      const state = history.state as { message?: string; type?: any }; 
      if (state?.message) { 
        this.notificationService.show(state.message, state.type,10000); 
      } 
    }
    if(isPlatformBrowser(this.platformId)){ //pour faire fonctionner que sur le navigateur
      this.recupe_posts();
    }

    if(!this.socket.isStarted()){ //se connecter au socket si ce n'est pas déjà fait
      this.socket.connect();
    }

    //écouter les notifications de connexion/déconnexion
    this.socket.notif_connect().forEach(notif => {
      notif.subscribe((data) => {
        this.notificationService.show(data, 'info');
      });
    });

    //écouter les notifications de like/unlike pour mettre à jour le nombre de likes des posts en temps réel
    const likeNotifs =this.socket.notif_like();
    likeNotifs[0].subscribe((data) => {
      const post = this.getPostById(data);
      if (post) {
        post.likes++;
        this.posts.update(posts => {
          const index = posts.findIndex(p => String(p.id) === String(post.id));
          if (index !== -1) {
            const updatedPosts = [...posts];
            updatedPosts[index] = { ...updatedPosts[index], likes: post.likes };
            return updatedPosts;
          }
          return posts;
        });
      }
    });
    likeNotifs[1].subscribe((data) => {
      const post = this.getPostById(data);
      if (post) {
        post.likes--;
        this.posts.update(posts => {
          const index = posts.findIndex(p => String(p.id) === String(post.id));
          if (index !== -1) {
            const updatedPosts = [...posts];
            updatedPosts[index] = { ...updatedPosts[index], likes: post.likes };
            return updatedPosts;
          }
          return posts;
        });
      }
    });
    
  }

  /**
   * méthode appelée après l'initialisation de la vue pour configurer l'observateur d'infinite scroll sur le sentinel de scroll,
   */
  ngAfterViewInit() {
    this.setupInfiniteScrollObserver();
  }

  /**
   * méthode appelée lors de la destruction du composant pour déconnecter l'observateur d'infinite scroll et éviter les fuites de mémoire
   */
  ngOnDestroy() {
    this.observer?.disconnect();
  }

  /**
   * méthode appelée lors du changement de type de filtre pour mettre à jour le type de filtre et appliquer le filtre sur les posts
   * @param event l'événement de changement de sélection du type de filtre
   */
  filtreChange(event: Event){
    this.typeFiltre.set((event.target as HTMLSelectElement).value);
    this.filtreSearch(this.filtreText());
  }

  /**
   * méthode appelée lors de la saisie dans le champ de recherche pour mettre à jour le texte de filtre et appliquer le filtre sur les posts
   * @param valueOrEvent la valeur saisie ou l'événement de saisie dans le champ de recherche
   */
  filtreSearch(valueOrEvent: string | Event){
    const value_filter = typeof valueOrEvent === 'string'
      ? valueOrEvent.toLowerCase().trim()
      : ((valueOrEvent.target as HTMLInputElement).value || '').toLowerCase().trim();
    this.filtreText.set(value_filter);
    this.filtre();
  }

  /**
   * methode qui applique le filtre sur les posts
   * @returns posts filtrés et triés selon les critères sélectionnés
   */
  filtre(){
    this.reset_posts();
  }

  /**
   * méthode appelée lors du changement de type de tri pour mettre à jour le type de tri et appliquer le tri sur les posts
   * @param event 
   */
  sortChange(event: Event){
    this.sortType.set((event.target as HTMLSelectElement).value);
    this.reset_posts();
  }

  /**
   * méthode qui trie les posts selon le type de tri sélectionné
   * @param posts liste des posts à trier
   * @param type type de tri à appliquer (newest, oldest, most_liked, least_liked)
   * @returns liste des posts triés selon le type de tri sélectionné
   */
  sort(posts:Post[], type:string):Post[]{
    const sortedPosts = [...posts];
    if(type === "newest"){
      sortedPosts.sort((a,b) => {
        return this.parsePostDateTime(b.date) - this.parsePostDateTime(a.date);
      });
    }else if(type === "oldest"){
      sortedPosts.sort((a,b) => {
        return this.parsePostDateTime(a.date) - this.parsePostDateTime(b.date);
      });
    }else if(type === "most_liked"){
      sortedPosts.sort((a,b) => b.likes - a.likes);
    }else if(type === "least_liked"){
      sortedPosts.sort((a,b) => a.likes - b.likes);
    }
    return sortedPosts;
  }

  /**
   * méthode qui parse la date d'un post au format "dd/MM/yyyy à HH:mm" en timestamp pour pouvoir trier les posts par date
   * @param dateWithHour la date du post au format "dd/MM/yyyy à HH:mm" 
   * @returns le timestamp de la date du post, ou 0 si la date n'est pas valide
   */
  private parsePostDateTime(dateWithHour: string): number {
    const [datePart, timePart = '00:00'] = (dateWithHour ?? '').split(' à ');
    const [day = '01', month = '01', year = '1970'] = (datePart ?? '').split('/');
    const parsedDate = new Date(`${year}-${month}-${day}T${timePart}`);
    return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
  }

  /**
   * methode pour réinitialiser les filtres de recherche et de tri
   */
  reset_filters(){
    this.typeFiltre.set("auteur");
    this.sortType.set("newest");
    this.filtreText.set("");
    this.reset_posts();
  }


  /**
   * méthode pour récupérer les posts depuis le backend et les stocker dans l'état du composant, 
   * en gérant les erreurs d'authentification et de récupération des posts
   */
  recupe_posts(reset = true){
    if (reset) {
      this.page.set(1);
      this.hasMore.set(true);
      this.allposts = [];
      this.posts.set([]);
    }

    if (this.isLoadingMore() || !this.hasMore()) {
      return;
    }

    const currentPage = this.page();
    this.isLoadingMore.set(true);
    const params = this.getApiFiltersAndSort();

    this.api.allposts(
      currentPage,
      this.pageSize,
      params.filter,
      params.value,
      params.sort
    ).subscribe({
      next: (res: any) =>{
        const parsed = res as { items: any[]; hasMore: boolean };
        const newPosts = parsed.items.map((p: any) => this.create_post(p));

        const existingIds = new Set(this.allposts.map(p => String(p.id)));
        const uniqueNewPosts = newPosts.filter(p => !existingIds.has(String(p.id)));

        this.allposts = [...this.allposts, ...uniqueNewPosts];
        this.posts.set(this.allposts);

        const hasServerMore = Boolean(parsed.hasMore);
        const gotNewData = uniqueNewPosts.length > 0;
        this.hasMore.set(hasServerMore && gotNewData);
        this.page.set(currentPage + 1);
        this.isLoadingMore.set(false);

        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => this.loadMoreIfViewportNotFilled(), 0);
        }
      },
      error: (err: any) =>{
        this.isLoadingMore.set(false);
        //erreur non autorise, rediriger vers la page de login
        if(err.status === 401){
          this.router.navigate(["/login"]);
        }
        this.notificationService.show("erreur lors de la récupération des posts",'error');
      }
    });
  }

  /**
   * construit les paramètres de filtre/tri envoyés au backend.
   * si le champ de recherche est vide, on n'envoie pas de filtre.
   */
  private getApiFiltersAndSort(): { filter: string; value: string; sort: string } {
    const value = this.filtreText().trim();
    return {
      filter: value ? this.typeFiltre() : "",
      value,
      sort: this.sortType()
    };
  }

  /**
   * méthode pour configurer l'observateur d'infinite scroll sur le sentinel de scroll,
   * pour charger plus de posts lorsque le sentinel devient visible dans le viewport, 
   * en gérant les cas où le composant est rendu côté serveur ou où le sentinel n'est pas encore disponible dans la vue
   * @returns void
   */
  private setupInfiniteScrollObserver() {
    if (!isPlatformBrowser(this.platformId) || !this.scrollSentinel?.nativeElement) {
      return;
    }

    this.observer?.disconnect();
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        this.loadMorePosts();
      }
    }, {
      root: null,
      rootMargin: '240px',
      threshold: 0.01
    });

    this.observer.observe(this.scrollSentinel.nativeElement);
  }

  /**
   * méthode pour charger plus de posts en appelant la méthode de récupération des posts,
   */
  loadMorePosts() {
    this.recupe_posts(false);
  }

  /**
   * méthode pour charger plus de posts si le viewport n'est pas rempli
   */
  private loadMoreIfViewportNotFilled() {
    if (!this.hasMore() || this.isLoadingMore()) {
      return;
    }

    const pageHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    if (pageHeight <= viewportHeight + 80) {
      this.loadMorePosts();
    }
  }

  /**
   * méthode pour réinitialiser les posts affichés
   */
  reset_posts(){
    this.recupe_posts(true);
  }

  /**
   * méthode pour créer un post à partir des données reçues du backend, 
   * en gérant les formats de date et d'heure, les posts partagés, les commentaires et les hashtags
   * @param data les données du post reçues du backend
   * @returns Post
   */
  create_post(data:any):Post{
    const date = new Date(`${data.date}`);
    const sharedValue = data.shared ?? data.sharedPost;
    const sharedId = sharedValue && typeof sharedValue === 'object'
      ? (sharedValue._id ?? sharedValue.id)
      : sharedValue;

    const post:Post={
      id: data._id,
      content: data.body ?? "",
      author: data.createdBy,
      date: date.toLocaleDateString("fr-FR")+" à "+data.hour,
      likes: data.likes,
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
      image: data.images,
      comments:this.create_comments(data.comments),
      shared: sharedId,
      likedByCurrentUser: false,
      sharedPost: data.sharedPost ? this.create_post(data.sharedPost) : undefined
    };
    return post;
  }

  /**
   * méthode pour créer une liste de commentaires à partir des données reçues du backend
   * @param data les données des commentaires reçues du backend, qui peuvent être null ou undefined si le post n'a pas de commentaires
   * @returns liste de Comment
   */
  create_comments(data:any):Comment[]{
    if(!data) return [];
    return data.map((item: any, index: number) => {
      const date = new Date(`${item.date}`);
      const comment:Comment={
        id: index,
        text: item.text,
        author: item.commentedBy,
        date: date.toLocaleDateString("fr-FR")+" à "+item.hour
      };
      return comment;
    });
  }

  /**
   * méthode pour récupérer un post par son id à partir de l'état du composant
   * @param id l'id du post a recuperer
   * @returns Post
   */
  getPostById(id: string|number) {
    const post = this.posts().find(p => String(p.id) === String(id));
    return post ? post : null;
  }

  /**
   * méthode pour ouvrir la fenêtre de création d'un nouveau post, en passant l'id du post partagé si on partage un post,
   * et pour gérer la soumission du formulaire de création de post en appelant l'API pour ajouter le post, 
   * en affichant une notification de succès ou d'erreur selon le résultat de l'ajout du post
   * @param sharedPostId l'id du post partagé
   */
  openNewPostModal(sharedPostId?: string|number) {
    const dialogRef=this.dialog.open(NewPostDialog,{
      panelClass: 'custom-dialog-panel',
      autoFocus: false,
      data: sharedPostId != null ? { sharedPostId } : undefined
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const payload = { ...result };
        if (sharedPostId != null) {
          payload.shared = sharedPostId;
          payload.sharedPost = sharedPostId;
        }

        this.api.addpost(payload).subscribe({
          next: () =>{
            this.recupe_posts();
            this.notificationService.show("post ajouté avec succès", 'success');
          },
          error: () =>{
            this.notificationService.show("erreur lors de l'ajout du post", 'error');
          }
        });
      }
    });

  }

  /**
   * méthode pour ouvrir la fenêtre de création d'un nouveau post en partageant un post existant, en passant l'id du post partagé,
   * @param post le post à partager
   */
  openSharePostModal(post: Post) {
    this.openNewPostModal(post.id);
  }

  /**
   * méthode pour liker ou unliker un post, en mettant à jour l'état du post dans le composant
   *  et en émettant un événement de like ou d'unlike via le socket pour informer les autres utilisateurs du changement de like
   * @param post le post à liker ou unliker
   */
  toggleLike(post: Post) {
    post.likedByCurrentUser = !post.likedByCurrentUser;
    if (post.likedByCurrentUser) {
      post.likes++;
      this.socket.emit("like",post.id );
    }else{
      post.likes--;
      this.socket.emit("unlike",post.id );
    }

  }

  // Méthodes pour gérer les commentaires

  /**
   * méthode pour vérifier si la section de commentaires d'un post est ouverte
   * @param postId l'id du post pour lequel vérifier si la section de commentaires est ouverte
   * @returns true si la section de commentaires est ouverte, false sinon
   */
  isCommentSectionOpen(postId: number | string): boolean {
    return this.openCommentSections().includes(postId);
  }

  /**
   * méthode pour ouvrir ou fermer la section de commentaires d'un post, en fonction de son état actuel
   * @param postId l'id du post pour lequel ouvrir ou fermer la section de commentaires
   * @returns void
   */
  toggleCommentSection(postId: number | string) {
    if (this.isCommentSectionOpen(postId)) {
      this.openCommentSections.set(this.openCommentSections().filter(id => id !== postId));
      if (this.activeCommentPostId() === postId) {
        this.closeNewComment();
      }
      return;
    }
    this.openCommentSections.set([...this.openCommentSections(), postId]);
  }

  /**
   * méthode pour ouvrir la section de commentaires d'un post et activer le champ de saisie du commentaire, en mettant à jour l'état du composant
   * @param postId l'id du post pour lequel ouvrir la section de commentaires et activer le champ de saisie du commentaire
   */
  openNewComment(postId: number | string) {
    if (!this.isCommentSectionOpen(postId)) {
      this.openCommentSections.set([...this.openCommentSections(), postId]);
    }
    this.activeCommentPostId.set(postId);
    this.commentDraft.set("");
  }

  /**
   * méthode pour fermer la section de saisie d'un nouveau commentaire, en mettant à jour l'état du composant
   */
  closeNewComment() {
    this.activeCommentPostId.set(null);
    this.commentDraft.set("");
  }

  /**
   * méthode pour mettre à jour le brouillon de commentaire en fonction de la saisie de l'utilisateur, en mettant à jour l'état du composant
   * @param event
   */
  updateCommentDraft(event: Event) {
    const value = (event.target as HTMLTextAreaElement).value ?? "";
    this.commentDraft.set(value);
  }

  /**
   * méthode pour soumettre un nouveau commentaire, en vérifiant que le texte du commentaire n'est pas vide
   * @param postId l'id du post pour lequel soumettre le commentaire
   * @returns void
   */
  submitComment(postId: number | string) {
    const text = this.commentDraft().trim();
    if (!text) {
      this.notificationService.show("Le commentaire ne peut pas être vide", 'error');
      return;
    }

    this.api.addcomment(postId, text).subscribe({
      next: () => {
        this.notificationService.show("Commentaire ajouté", 'success');
        this.closeNewComment();
        this.recupe_posts();
      },
      error: () => {
        this.notificationService.show("Erreur lors de l'ajout du commentaire", 'error');
      }
    });
  }


}
