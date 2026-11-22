# Mode multijoueur « Partie » (fork)

Direction **arcade** : un score lisible et amusant, pas une simulation parfaite.

## Déroulé

1. Sur l'ordinateur, bouton **Partie multijoueur** (barre latérale, ou accueil
   quand la bibliothèque est vide) → écran `/party` avec un grand QR code.
2. Chaque joueur scanne le QR code avec son téléphone et choisit un pseudo.
   Au premier scan, le téléphone affiche un avertissement de sécurité
   (certificat auto-signé) : « Paramètres avancés » → « Continuer ». C'est
   obligatoire pour que le navigateur autorise le micro.
3. Le **premier téléphone** est le **maître du jeu**. Il choisit la suite :
   une **chanson** (recherche), un **genre** (morceau au hasard dans ce genre)
   ou le **hasard** complet.
4. Dès qu’il y a **au moins 1 joueur** (4 au maximum), le maître du jeu
   lance la manche : l'ordinateur démarre la chanson, **tout le monde chante en
   même temps**, chacun dans son téléphone.
5. À la fin, les scores s'affichent sur l'ordinateur (avec le QR code pour que
   d'autres rejoignent) et sur les téléphones. **Le gagnant devient maître du
   jeu** et choisit la chanson suivante.

## Scoring arcade

Chaque téléphone détecte lui-même la hauteur de la voix (même détecteur que la
version bureau) et envoie environ 10 mesures par seconde à l'ordinateur, qui
les compare à la piste vocale de la chanson. Trois jauges, en direct à l'écran :

| Jauge | Ce qu'elle mesure |
| --- | --- |
| Justesse | proximité de la note chantée avec la note de la chanson |
| Rythme | entrées au bon moment (±0,35 s) et silence pendant les pauses |
| Paroles | part du temps chanté pendant que la chanson a des paroles (approximation) |

Score final = 45 % justesse + 25 % rythme + 30 % paroles (sur 100).

## Technique

- État de la partie : `app-api/src/party.rs` (commandes `party_*`, événements
  `party-changed`, `party-start`, `party-pitch`).
- Morceaux jouables (analysés seulement), genres lus dans les étiquettes des
  fichiers : `app-core/src/party_library.rs`.
- HTTPS : certificat auto-signé (`app-core/src/party_tls.rs`, gardé dans
  `party-tls/`, refait si l'adresse IP change) servi sur le port **64450**
  par l'application de bureau, en plus du port HTTP 64449.
- Téléphone : `client/src/features/party/phone/` (route `/party`).
- Ordinateur : `client/src/features/party/host/`. Les joueurs de la partie
  sont des joueurs multijoueur dont le micro est `party:<id>` ; leur hauteur
  de voix vient du téléphone (`party-pitch-store.ts`).
- Jauges : `client/src/features/playback/lib/pitch/arcade.ts`.

## Limites actuelles

- 4 joueurs maximum par partie (les 4 places de chanteur de la lecture).
- Mode bureau uniquement pour le HTTPS des téléphones (pas en auto-hébergé).
- Genres : seulement pour les fichiers qui ont une étiquette de genre.
- Le son de la chanson est aussi capté par les téléphones : chanter près du
  téléphone et pas trop près des enceintes donne de meilleurs résultats.
