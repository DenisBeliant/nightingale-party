# Google TV (fork) — test avec le serveur autonome

Objectif : le PC fait tourner le serveur Nightingale (`client/src-server`, binaire `server`),
la TV (Google TV Streamer 4K) affiche l'interface dans un navigateur, les téléphones servent de micros (mode Partie).

## Ce qui a été adapté
- L'écoute HTTPS de la Partie (port 64450, certificat auto-signé) est maintenant dans le crate `server`
  (`src-server/src/party_tls.rs`), partagée par l'appli de bureau et le serveur autonome.
- `/party` n'est la page téléphone que sur les ports des téléphones (64449, 64450) ou avec le jeton `?t=`.
  Sur `http://<pc>:8080/party`, la TV affiche l'écran hôte.

## Lancer le test
1. Fermer l'appli de bureau : le serveur utilise le même dossier `~/.nightingale` (bibliothèque, analyses, session YouTube).
2. Construire : `cd client && pnpm build`, puis `cd .. && cargo build --release -p server`.
3. Lancer : `./target/release/server --bind 0.0.0.0:8080 --remote-url http://<ip-du-pc>:8080`.
4. Pare-feu : ouvrir 8080 (interface) et 64450 (micros des téléphones).
5. Sur la TV : navigateur TV Bro (Play Store), moteur WebView, puis `http://<ip-du-pc>:8080`.

## À observer
Navigation à la télécommande, fluidité (fonds animés, piste des notes), synchro son / paroles,
Partie : QR code sur la TV, téléphones qui rejoignent, décalage des jauges.

## Mode TV (`client/src/shared/tv-mode.ts`)
Le navigateur de la TV annonce une petite fenêtre en pixels CSS (souvent 960 × 540 pour un écran 4K) :
tout paraissait deux fois plus gros et, en jeu, la barre de défilement, la piste des notes et les paroles se chevauchaient.
En mode TV, la taille de base suit la fenêtre (`html.tv { font-size: min(1.0417vw, 1.852vh) }`),
donc l'écran est mis en page comme un bureau en 1920 × 1080.
Détection automatique (nom du navigateur ou Android sans écran tactile) ; `?tv=1` l'active, `?tv=0` le coupe (mémorisé).

## Appli TV (`tv-app/`)
Le navigateur de la TV n'était pas pratique (saisie de l'IP, bouton Retour capté par le navigateur).
`tv-app/` est une petite appli Android TV en Kotlin, sans bibliothèque :
- **Découverte** : sonde UDP sur le port 64451 ; le serveur répond (`src-server/src/discovery.rs`) avec son nom
  (`--name` / `NIGHTINGALE_NAME`, sinon le nom de la machine), son port HTTP et sa version.
- **WebView plein écran** (Chromium du système) sur `http://<serveur>/?tv=1`, avec `NightingaleTV/<version>` dans
  l'identifiant du navigateur.
- **Retour** : pendant une chanson ou une fenêtre, l'appli envoie Échap à la page (menu de pause avec « Quitter ») ;
  ailleurs, page précédente ; à l'accueil, deux appuis pour quitter. Touche Menu : choix du serveur.
- Compilation et installation : voir `tv-app/README.md`. Pare-feu : UDP 64451 en plus de TCP 8080 et 64450.

## La TV n'affiche que « Jouer »
En mode TV, l'interface se limite à l'écran de la Partie (`/party`) et à la lecture :
la bibliothèque, les réglages et l'écran YouTube redirigent vers `/party`, sans barre latérale
(`features/party/host/tv-party-layout.tsx`). L'appli TV ouvre directement `/party?tv=1` ;
Retour sur cet écran = quitter (deux appuis). La bibliothèque se gère depuis le PC ou un navigateur.

## Jouer sur la TV depuis l'appli de bureau
Le bouton « Jouer » ouvre `/play` (appli de bureau uniquement) : « Sur cet ordinateur » → `/party` ;
« Sur la TV » → l'appli de bureau sert elle-même l'interface web sur le réseau (`src-tauri/src/tv_server.rs`,
port TCP 64448 ou un port libre) et répond à la découverte UDP 64451. Plus besoin du binaire `server` :
même processus, même bibliothèque, même Partie. Pendant la diffusion, la fenêtre du PC ne lance pas les manches
(la TV les joue) ; « Arrêter la diffusion » coupe le serveur. Commandes Tauri : `tv_server_status|start|stop`,
événement `tv-server-changed`. Pare-feu : TCP 64448, TCP 64450, UDP 64451.
