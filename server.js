import express from 'express';
import session from 'express-session';
import https from 'https';
import fs from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import connectMongoDBSession from 'connect-mongodb-session';
import { MongoClient, ObjectId } from "mongodb";
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server} from "socket.io";
import { url } from 'inspector';

const MongoDBStore = connectMongoDBSession(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();


// Activation d'Express
const app = express();


// Port du serveur
const PORT=3140;


// Activation du décodage du body des requêtes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//connection vers la bd postgres
const bd = new Pool({ 
  user: process.env.PG_USER, 
  host: process.env.PG_HOST, 
  database: process.env.PG_DATABASE, 
  password: process.env.PG_PASSWORD, 
  port: Number(process.env.PG_PORT), 
}); 

//connection avec MongoDB
const store = new MongoDBStore({ 
  uri: process.env.MONGO_URI, 
  collection: 'MySession'+PORT,
});

//affichage s'il y a une erreur avec MongoDB
store.on('error',function(error){
  console.log(error);
});

const mongoClient = new MongoClient(process.env.MONGO_URI);
await mongoClient.connect();
const Cposts = mongoClient.db("db-CERI").collection("CERISoNet");//collection pour les posts

/**
 * fonction pour formater une date en format ISO local (YYYY-MM-DD)
 * @param {*} dateObj objet Date à formater
 * @returns {string} date formatée en ISO local
 */
function formatDateToIsoLocal(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * fonction pour normaliser une date en format ISO local (YYYY-MM-DD)
 * @param {*} dateValue valeur de la date à normaliser
 * @returns {string} date normalisée en ISO local
 */
function normalizeDateToIso(dateValue) {
  if (!dateValue) {
    return formatDateToIsoLocal(new Date());
  }

  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    return formatDateToIsoLocal(dateValue);
  }

  const value = String(dateValue).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateToIsoLocal(parsed);
  }

  return value;
}

/**
 * fonction pour normaliser une heure en format HH:MM
 * @param {*} hourValue valeur de l'heure à normaliser
 * @returns {string} heure normalisée en HH:MM
 */
function normalizeHourToHHMM(hourValue) {
  if (!hourValue) {
    return '00:00';
  }

  const value = String(hourValue).trim();
  const match = value.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) {
    return value;
  }

  const hours = String(match[1]).padStart(2, '0');
  const minutes = String(match[2]).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * fonction pour supprimer les caractères spéciaux d'une chaîne de caractères
 * @param {*} value valeur à échapper
 * @returns {string} chaîne de caractères nettoyée
 */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

//creation de la session avec le stockage sur mongoDB
const sessionMiddleware = session({
  secret:process.env.SESSION_SECRET,
  cookie:{maxAge:1000*60*60},//1h
  resave:false,
  saveUninitialized:false,
  store:store,
});

app.use(sessionMiddleware);

// Récupération des fichiers clé et certificat pour le HTTPS, 
const options = { 
  key: fs.readFileSync('key.pem'), 
  cert: fs.readFileSync('cert.pem') 
};


/**
 * Route POST pour le formulaire de connexion.
 * verification si l'utilisateur existe et les information sont correcte
 * et ensuite crée une session contenant un objet user contenant ces infos
 * renvoie une réponse JSON indiquant le succès ou l'échec de la connexion
 */
app.post('/login',async (req, res) => {
  let mail=req.body.email;
  let password=req.body.password;
  const hash = crypto .createHash('sha1').update(password, 'utf8').digest('hex');
  const result=await bd.query('SELECT * FROM fredouil.compte WHERE mail=$1 AND motpasse=$2',[mail,hash]);
  if(result.rows.length!=1){
    res.status(401).send('Email ou mot de passe incorrect');
  }
  else{
    bd.query('UPDATE fredouil.compte SET statut_connexion=1 WHERE id=$1',[result.rows[0].id]);
    let user=result.rows[0];
    req.session.user={
      id:user.id,
      mail: mail,
      pseudo: user.pseudo,
      avatar: user.avatar,
    }
    req.session.isConnected = true; 
    res.json({success:true});
  }
});


/**
 * Route GET pour récupérer tous les posts.
 * vérification si l'utilisateur est connecté, et ensuite récupère tous les posts de la base de données MongoDB
 * pour chaque post et commentaire, remplace l'id de l'auteur par son pseudo
 * 
 * params de requete :
 * - page : numéro de la page à récupérer (par défaut 1)
 * - limit : nombre de posts par page (par défaut 10)
 * - trie : optionnel, format du trie des posts (eg: newest, oldest, most_liked, least_liked)
 * - sort: optionnel, format du filtre des posts (eg: auteur, hashtag, contenu), si le filtre est appliqué, il faut aussi fournir la valeur du filtre
 *  -valeur du filtre : optionnel, valeur du filtre à appliquer
 * 
 * la réponse JSON contient un objet avec les propriétés suivantes :
 * - items : tableau des posts récupérés pour la page demandée
 * - hasMore : booléen indiquant s'il y a plus de posts à charger après cette page
 * 
 */
app.get('/allposts',async (req,res)=>{
  //vérification si l'utilisateur est connecté
  if(!req.session.isConnected){
    return res.status(401).send('Non autorisé');
  }

  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 10;
  let sortOption = req.query.sort || 'newest';
  let filterOption = req.query.filter || null;
  let filterValue = req.query.value || null;

  let filter = {};
  if(filterOption && !filterValue){
    return res.status(400).send('Valeur de filtre manquante');
  }else if(filterOption && filterValue){
    const normalizedFilterValue = String(filterValue).trim();
    switch (filterOption) {
      case 'auteur':
        const userResult = await bd.query('SELECT id FROM fredouil.compte WHERE pseudo ILIKE $1', [`%${normalizedFilterValue}%`]);
        if (userResult.rows.length === 0) {
          return res.status(404).send('Auteur non trouvé');
        }
        filter.createdBy = userResult.rows[0].id;
        break;
      case 'hashtag':
        filter.hashtags = { $regex: escapeRegex(normalizedFilterValue), $options: 'i' };
        break;
      case 'contenu':
        filter.body = { $regex: escapeRegex(normalizedFilterValue), $options: 'i' };
        break;
      default:
        return res.status(400).send('Option de filtre invalide');
    }
  }

  let posts=await Cposts.find(filter).toArray();

  posts=normalizeDate(posts);
  switch (sortOption) {
    case 'newest':
      posts.sort((a, b) => {
        const dateA = `${a.date} ${a.hour}`;
        const dateB = `${b.date} ${b.hour}`;
        return dateB.localeCompare(dateA);
      });
      break;
    case 'oldest':
      posts.sort((a, b) => {
        const dateA = `${a.date} ${a.hour}`;
        const dateB = `${b.date} ${b.hour}`;
        return dateA.localeCompare(dateB);
      });
      break;
    case 'most_liked':
      posts.sort((a, b) => b.likes - a.likes);
      break;
    case 'least_liked':
      posts.sort((a, b) => a.likes - b.likes);
      break;
    default:
      break;
  }

  let startIndex = (page - 1) * limit;
  let endIndex = page * limit;
  posts=posts.slice(startIndex,endIndex);

  for(let i=0;i<posts.length;i++){
    if(!posts[i].createdBy){
      Cposts.deleteOne({_id: posts[i]._id});
      posts.splice(i,1);
      i--;
      continue;
    }
    let user=await bd.query('SELECT pseudo FROM fredouil.compte WHERE id=$1',[posts[i].createdBy]);
    posts[i].createdBy=user.rows[0].pseudo;
    if(posts[i].comments){
      for (let y = 0; y < posts[i].comments.length; y++) {
        posts[i].comments[y].date = normalizeDateToIso(posts[i].comments[y].date);
        posts[i].comments[y].hour = normalizeHourToHHMM(posts[i].comments[y].hour);
      }

      posts[i].comments.sort((a,b)=>{
        const dateA = `${a.date} ${a.hour}`;
        const dateB = `${b.date} ${b.hour}`;
        return dateB.localeCompare(dateA);
      });
  
      for(let y=0;y<posts[i].comments.length;y++){
        let comment=posts[i].comments[y];
        let user=await bd.query('SELECT pseudo FROM fredouil.compte WHERE id=$1',[comment.commentedBy]);
        if(user.rows.length>0){
          comment.commentedBy=user.rows[0].pseudo;
          posts[i].comments[y]=comment;
        }
      }
    }

    //correction des erreur de creation des posts avec des champs images incorrects
    if( !posts[i].images || ( Array.isArray(posts[i].images) && posts[i].images.length==0)){
      posts[i].images=null;
    }
    else if(posts[i].images.url=='' && (posts[i].images.title=='' || posts[i].images.titre=='')){
      posts[i].images=null;
    }

    if(!posts[i].likes){
      posts[i].likes=0;
    }  

    //correction des erreur de creation des posts avec des champs likes incorrects  
    if(Array.isArray(posts[i].likes)){
      posts[i].likes=posts[i].likes.length;
      Cposts.updateOne({_id: posts[i]._id},{$set:{likes: posts[i].likes}});
    }
    
    if(posts[i].shared){
      let sharedPost=await Cposts.findOne({_id: new ObjectId(String(posts[i].shared))});
      if(sharedPost){
        if(sharedPost.createdBy){
          let user=await bd.query('SELECT pseudo FROM fredouil.compte WHERE id=$1',[sharedPost.createdBy]);
          sharedPost.createdBy=user.rows[0].pseudo;
        }
        for(let y=0;y<posts[i].comments.length;y++){
          let comment=posts[i].comments[y];
          let user=await bd.query('SELECT pseudo FROM fredouil.compte WHERE id=$1',[comment.commentedBy]);
          if(user.rows.length>0){
            comment.commentedBy=user.rows[0].pseudo;
            posts[i].comments[y]=comment;
          }
        }
        posts[i].sharedPost=sharedPost;
        

      }
    }
  }
  let hasMore = endIndex < (await Cposts.countDocuments(filter));
  let result={items:posts, hasMore};
  res.json(result);
});

/**
 * fonction pour normaliser les dates des posts
 * @param {*} posts tableau de posts à normaliser
 * @returns {Array} tableau de posts avec les dates normalisées
 */
function normalizeDate(posts){
  for(let i=0;i<posts.length;i++){
    posts[i].date = normalizeDateToIso(posts[i].date);
    posts[i].hour = normalizeHourToHHMM(posts[i].hour);
  }
  return posts;
}

/**
 * Route pour ajouter un nouveau post
 */
app.post('/addpost',async (req,res)=>{
  //vérification si l'utilisateur est connecté
  if(!req.session.isConnected){
    return res.status(401).send('Non autorisé');
  }
  let temp=req.body;
  let post={body:temp.content};
  
  const now = new Date();
  post.createdBy=req.session.user.id;
  post.date=formatDateToIsoLocal(now);
  post.hour=normalizeHourToHHMM(now.toTimeString().split(' ')[0]);
  if(temp.hashtags){
    post.hashtags=temp.hashtags;
  }
  if(temp.image){
    post.images={url:temp.image, title:temp.imageTitle};
  }
  if(temp.sharedPost){
    const sharedPost = await Cposts.findOne({ _id: new ObjectId(String(temp.sharedPost)) });
    if(sharedPost){
      post.Shared=temp.sharedPost;
    }
  }
  //console.log("final=",post);
  await Cposts.insertOne(post);
  res.json({success:true});
});

/**
 * Route pour ajouter un nouveau commentaire
 */
app.post('/addcomment', async (req, res) => {
  //vérification si l'utilisateur est connecté
  if(!req.session.isConnected){
    return res.status(401).send('Non autorisé');
  }
  
  let { postId, text } = req.body;
  let comment = {
    commentedBy: req.session.user.id,
    date: new Date().toISOString().split('T')[0],
    hour: new Date().toTimeString().split(' ')[0].substring(0,5),
    text: text
  };
  const mongoPostId = new ObjectId(String(postId));
  await Cposts.updateOne({ _id: mongoPostId }, { $push: { comments: comment } });

  return res.json({ success: true });
});



//ajouter des pages css et js dans la partie static
app.use(express.static(path.join(__dirname)))

//redirection si session existe ou pas
app.get('/', (req, res) => { 
  if(req.session.isConnected){
     res.redirect('/main');
  }else{
    res.redirect('/login');
  }
});


//tout les autres routes sont redirigé vers angular pour le changement de page coté client
app.get(/.*/, (req, res) => { 
  res.sendFile(path.join(__dirname,'index.html'));
});


const httpsServer=https.createServer(options, app).listen(PORT, () => { 
    console.log(`Serveur HTTPS sur les adresses :`);
    console.log(`- https://localhost:${PORT}`); 
    console.log(`- https://pedago.univ-avignon.fr:${PORT}`);
});

//initialisation de socket.io pour la communication en temps réel entre le serveur et les clients
const io = new Server(httpsServer);
io.engine.use(sessionMiddleware);//partage de la session entre Express et Socket.io

/**
 * gestion des événements de connexion, de déconnexion, de like et d'unlike des posts
 */
io.on('connection', (socket) => {
  socket.broadcast.emit('userConnected',"Un nouvel utilisateur est connecté");

  socket.on("disconnect", () => {
    const userId = socket.request?.session?.user?.id;
    if (userId) {
      bd.query('UPDATE fredouil.compte SET statut_connexion=0 WHERE id=$1',[userId]);
    }
    const pseudo = socket.request?.session?.user?.pseudo;
    console.log('Un client est déconnecté :', pseudo || "Utilisateur inconnu");
    socket.broadcast.emit('userDisconnected', pseudo ? `${pseudo} s'est déconnecté` : "Un utilisateur est déconnecté");
  });


  socket.on('like', (postId) => {
    console.log(`Post ${postId} a été liké`);
    updateLike(postId, true);
    socket.broadcast.emit('postLiked', postId);
  });

  socket.on('unlike', (postId) => {
    console.log(`Post ${postId} a été unliké`);
    updateLike(postId, false);
    socket.broadcast.emit('postUnliked', postId);
  });

});

/**
 * fonction pour mettre à jour le nombre de likes d'un post
 * @param {*} postId id du post à mettre à jour
 * @param {*} isLiked booléen indiquant si le post a été liké ou unliké
 */
function updateLike(postId, isLiked) {
  const mongoPostId = new ObjectId(String(postId));
  if (isLiked) {
    Cposts.updateOne({ _id: mongoPostId }, { $inc: { likes: 1 } });
  } else {
    Cposts.updateOne({ _id: mongoPostId }, { $inc: { likes: -1 } });
  }
}