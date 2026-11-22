# Nightingale TV (Android TV / Google TV)

Petite appli pour la TV : elle trouve les serveurs Nightingale du réseau local et affiche
l'interface en plein écran dans la WebView du système (le Chromium de la TV, mis à jour par Google Play).
Le PC fait tourner le serveur autonome (`client/src-server`), les téléphones servent de micros (mode Partie).

## Ce que fait l'appli
- **Découverte** : elle envoie une sonde UDP sur le port 64451 ; chaque serveur répond avec son nom et son port.
  Aucune adresse IP à taper. En secours : « Saisir une adresse ».
- **Reconnexion** : au lancement suivant, elle rouvre directement le dernier serveur s'il répond.
- **Plein écran** en « mode TV » (`?tv=1`), écran toujours allumé.
- **Télécommande** :
  - Retour pendant une chanson : menu de pause (avec « Quitter ») ; dans une fenêtre : la ferme ;
  - ailleurs : page précédente ; à l'accueil, deux appuis pour quitter ;
  - Menu (≡) : revenir au choix du serveur.

## Compiler l'APK
Prérequis : JDK 17 et le SDK Android (le plus simple : Android Studio).

- **Android Studio** : ouvrir le dossier `tv-app/`, laisser installer le SDK demandé, puis *Build › Build APK(s)*.
- **En ligne de commande** (SDK installé, `ANDROID_HOME` défini) :
  ```
  cd tv-app
  ./gradlew assembleDebug
  ```
  L'APK est dans `app/build/outputs/apk/debug/app-debug.apk`.

## Installer sur le Google TV Streamer
1. Sur la TV : *Paramètres › Système › À propos*, appuyer 7 fois sur *Build du système d'exploitation Android TV*
   pour activer les options pour les développeurs.
2. *Paramètres › Système › Options pour les développeurs* : activer le **débogage sans fil**
   (ou le débogage USB / réseau selon la version), et noter l'adresse affichée.
3. Sur le PC :
   ```
   adb pair <ip-tv>:<port-d-appairage>   # si la TV affiche un code d'appairage
   adb connect <ip-tv>:<port>
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
4. L'appli « Nightingale » apparaît dans les applis de la TV (bannière dans la rangée des applis).

## Côté PC
Lancer le serveur, sans l'appli de bureau ouverte :
```
./target/release/server --bind 0.0.0.0:8080 --name "Salon"
```
Ouvrir dans le pare-feu : TCP 8080 (interface), TCP 64450 (micros des téléphones), **UDP 64451** (découverte).
