# Design « Plateau TV » de la Partie (fork)

Direction retenue parmi les 4 propositions arcade (canevas « Partie multijoueur — 4 designs arcade », option **B**).
L'idée : un jeu télé. Projecteurs, pupitres des candidats, boutons épais qui s'enfoncent, podium et confettis.
On reste dans la palette de Nightingale (fond bleu nuit, bleu primaire, couleurs des joueurs) ; seul le côté jeu change.

## Jetons

| Rôle | Valeur | Tailwind |
| --- | --- | --- |
| Scène (fond) | `#0D0D16` (= `--background` sombre) | `dark bg-background` |
| Carte / pupitre | `#212130` (= `--card` sombre) | `bg-card` |
| Bleu principal | `#4A6BF7`, ombre `#2B3FA8` | `bg-primary`, ombre `color-mix(primary 55%, black)` |
| Accent « or » (badges, score, bouton Lancer) | `#FACC15`, encre `#1A1400`, ombre `#A16207` | `yellow-400` / `yellow-950` / `yellow-700` |
| Joueurs | rose `#F43F5E` / `#9F1239`, fuchsia `#D946EF` / `#86198F`, ambre `#F59E0B` / `#92400E` (encre sombre), émeraude `#10B981` / `#047857` | `*-500` remplissage, `*-800` ombre |
| Police d'affichage | Rubik 800–900, repli `ui-rounded`, système | `font-party` |
| Rayons | 18–24 px pour les cartes, pilule pour les badges | `rounded-2xl`, `rounded-3xl`, `rounded-full` |

Les écrans de la partie sont **toujours sombres** (classe `dark` sur leur racine), même si l'app est en thème clair.

## Règles de style

- **Relief « bouton de plateau »** : pas de flou, une ombre pleine décalée vers le bas (`0 6–8px 0 <teinte foncée>`). Au clic, le bouton descend (`active:translate-y-1`) et l'ombre disparaît.
- **Bandeaux inclinés** (−2° à −5°) pour les annonces : « C'est parti pour le karaoké ! », « Et le gagnant est… », bonus.
- **Projecteurs** : deux faisceaux en dégradé, bleu à gauche et or à droite, plus un sol plus clair en bas de la scène.
- **Pupitres** : une plaque de couleur du joueur avec le nom en très gras, posée sur un socle. Le maître du jeu a un badge or. Une place libre est en pointillés émeraude.
- **Jauges** (Justesse, Rythme, Paroles) : une pilule épaisse sur fond nuit, de la couleur du joueur, avec 5 graduations. Le score est une plaque or sur fond noir, en chiffres tabulaires.
- **Paroles en jeu** : la ligne en cours sur une grande carte claire, la ligne suivante en gris.
- **Résultats** : un podium 2-1-3 de la couleur des joueurs, une couronne or pour le gagnant, des confettis fixes. Une carte bleue « X choisit la suite » et une carte QR pour rejoindre.

## Écrans

- TV : Salon (bandeau, carte QR, compteur de candidats, rangée de pupitres), En jeu (pupitres en bas du HUD), Résultats (podium).
- Téléphone : Rejoindre, Salon (avec les résultats de la manche), Maître du jeu (« On chante quoi ? » avec 3 gros boutons, puis « Lancer la manche » en or), Chant (anneau micro de la couleur du joueur, qui réagit au niveau).

## Implémentation

- `client/src/features/party/components/stage.tsx` : décor, bandeau, bouton épais, tons des joueurs.
- `player-desk.tsx`, `podium.tsx`, `score-gauge.tsx`, `results-list.tsx`, `player-list.tsx` : briques réutilisées par la TV, le téléphone et le HUD.
- Rubik n'est pas encore embarquée : sans connexion pour installer `@fontsource-variable/rubik`, la pile retombe sur la police système en graisse 900. Pour l'ajouter, installer le paquet et l'importer dans `main.tsx` ; `--font-party` la prend déjà en premier.
