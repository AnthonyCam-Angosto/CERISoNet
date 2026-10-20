# CERISoNet

CERISoNet est une application web de réseau social développée dans le cadre du
projet Web. Elle permet aux utilisateurs de se connecter, de consulter et
d'ajouter des publications, de commenter et d'interagir avec les publications
en temps réel.

## Fonctionnalités

- authentification des utilisateurs ;
- affichage paginé des publications ;
- filtrage et tri des publications ;
- création de publications ;
- ajout de commentaires ;
- likes et unlikes ;
- notifications de connexion, déconnexion et interactions en temps réel ;
- communication temps réel avec Socket.IO.

## Architecture

Le projet est organisé en deux parties :

```text
.
├── server.js              # API Express, sessions, HTTPS et Socket.IO
├── package.json           # dépendances du backend
├── cert.pem               # certificat HTTPS local (non versionné)
├── key.pem                # clé privée HTTPS locale (non versionnée)
└── CERISoNet/
    ├── src/               # application Angular
    ├── public/            # ressources statiques
    ├── angular.json       # configuration Angular
    └── package.json       # dépendances du frontend
```

Le backend utilise :

- **PostgreSQL** pour les comptes et les informations associées aux
  utilisateurs ;
- **MongoDB** pour les publications, les commentaires et le stockage des
  sessions ;
- **Express** pour l'API HTTP ;
- **Socket.IO** pour les événements en temps réel.

Le frontend est développé avec Angular et Angular Material.

## Prérequis

- Node.js et npm ;
- une base PostgreSQL accessible ;
- une base MongoDB accessible ;
- un certificat et une clé privée utilisables par le serveur HTTPS.

Les versions précises des dépendances sont indiquées dans les fichiers
[`package.json`](./package.json) et
[`CERISoNet/package.json`](./CERISoNet/package.json).

## Installation

Depuis la racine du projet, installer les dépendances du backend :

```bash
npm install
```

Installer ensuite celles du frontend :

```bash
cd CERISoNet
npm install
cd ..
```

## Configuration

Créer un fichier `.env` à la racine du projet. Il doit contenir les variables
suivantes :

```dotenv
PG_USER=utilisateur_postgresql
PG_HOST=localhost
PG_DATABASE=nom_de_la_base
PG_PASSWORD=mot_de_passe_postgresql
PG_PORT=5432

MONGO_URI=mongodb://localhost:27017
SESSION_SECRET=une_valeur_secrete_longue_et_aleatoire
```

Ne jamais versionner ce fichier ni les fichiers `cert.pem` et `key.pem`.

Le backend écoute sur le port `3140` en HTTPS. Le serveur de développement
Angular écoute sur le port `3141`.

## Certificat HTTPS local

Le backend charge automatiquement `key.pem` et `cert.pem` depuis la racine du
projet. Ces fichiers doivent donc être présents avant le lancement du serveur.

Pour générer un certificat auto-signé avec OpenSSL :

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout key.pem -out cert.pem -days 365 \
  -subj "/CN=localhost"
```

Un navigateur peut afficher un avertissement avec un certificat auto-signé.

## Lancement en développement

Dans un premier terminal, lancer le backend :

```bash
node server.js
```

Dans un second terminal, lancer le frontend :

```bash
cd CERISoNet
npm start
```

L'application Angular est alors disponible à l'adresse
[`http://localhost:3141`](http://localhost:3141). L'API backend est disponible
sur [`https://localhost:3140`](https://localhost:3140).

## Compilation

Pour produire une compilation de production du frontend :

```bash
cd CERISoNet
npm run build
```

Les fichiers générés sont placés dans `CERISoNet/dist/`. Ils sont exclus du
contrôle de version.

## Tests

Les tests unitaires Angular utilisent Vitest et se lancent avec :

```bash
cd CERISoNet
npm test
```

## API principale

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/login` | Authentifie un utilisateur et crée sa session |
| `GET` | `/allposts` | Récupère les publications avec pagination, filtre et tri |
| `POST` | `/addpost` | Ajoute une publication |
| `POST` | `/addcomment` | Ajoute un commentaire à une publication |

Les routes nécessitant une authentification utilisent la session Express et
doivent être appelées avec les identifiants (`withCredentials` côté Angular).

## Événements temps réel

Socket.IO est utilisé notamment pour les événements suivants :

- `userConnected` ;
- `userDisconnected` ;
- `postLiked` ;
- `postUnliked`.

## Sécurité

- conserver les secrets uniquement dans `.env` ;
- ne pas publier `key.pem` ;
- utiliser un certificat reconnu par l'autorité de certification en
  production ;
- remplacer les valeurs d'exemple par des identifiants propres à
  l'environnement utilisé.
