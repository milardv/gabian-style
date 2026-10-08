# Mettre Gabian Style en ligne

Le jeu a besoin du serveur Node : `/api/marseille/*` récupère et met en cache les données IGN. Un simple hébergement statique (GitHub Pages, par exemple) ne suffit pas.

## Solution simple : Render

Le dépôt contient `Dockerfile` et `render.yaml`. Le Blueprint prépare une **démo gratuite** : un service Docker en Europe, sans disque persistant. Le cache IGN est temporaire. Vérifier que le formulaire indique bien l’offre Free avant de valider.

1. Publier les modifications sur le dépôt GitHub `milardv/gabian-style`.
2. Dans Render, choisir **New → Blueprint**, connecter ce dépôt et sélectionner la branche contenant `render.yaml`.
3. Vérifier l’offre Free, puis créer le Blueprint.
4. Attendre le déploiement, ouvrir l’adresse HTTPS `*.onrender.com` fournie, puis jouer sur ordinateur ou téléphone avec ce même lien.
5. Vérifier `/healthz`, l’accueil, le chargement des tuiles, une mission, la conduite et le rechargement du carnet. Le contrôle de santé valide le serveur ; il ne garantit pas la disponibilité des services IGN.

Le premier chargement des secteurs peut être lent : les données absentes du cache sont récupérées à la demande. Surveiller le trafic sortant et les quotas de l’offre gratuite ; adapter les ressources selon le nombre de joueurs. Ne pas lancer une synchronisation complète sans besoin.

Documentation officielle : [Web services](https://render.com/docs/web-services), [Blueprints](https://render.com/docs/blueprint-spec), [disques persistants](https://render.com/docs/disks).

### Limites de la démo gratuite

Cette offre s’endort après 15 minutes d’inactivité ; le redémarrage prend environ une minute. Le cache local est perdu lors des redémarrages/redéploiements, ce qui oblige à récupérer à nouveau les données IGN. Elle convient à une démo, moins à un jeu toujours disponible. Pour passer à une offre payante ultérieurement, choisir un service compatible avec un disque et monter celui-ci sur `/app/.data` (par exemple 5 Go), après vérification du tarif. [Limites officielles](https://render.com/docs/free).

## Tester le conteneur / autre hébergeur Docker

```bash
docker build -t gabian-style .
docker run --rm --name gabian-style -p 4174:4174 -v gabian-marseille:/app/.data gabian-style
```

Ouvrir `http://localhost:4174`. Chez un autre hébergeur, conserver un volume sur `/app/.data`, laisser le conteneur écouter sur `0.0.0.0` et mettre HTTPS devant le service. La variable `PORT` peut être remplacée par celle attendue par l’hébergeur.

## Téléphone

Le jeu fonctionne dans le navigateur, sans application de store : il nécessite **WebGL 2**, une connexion et un appareil assez puissant. Le mode « Mobile · léger » est choisi par défaut avec un pointeur tactile : résolution de rendu limitée, orthophotos 1024 px et moins de tuiles de relief. La qualité reste réglable.

Au lancement, les réglages sont repliés. Les flèches tactiles et les boutons Nitro, Déraper (maintenir) et Pause restent accessibles. En scooter, les flèches verticales accélèrent/freinent ; en gabian elles montent/descendent. Les marges tiennent compte de l’encoche et de l’indicateur d’accueil. Le paysage donne plus de place au décor. La fluidité et les gestes doivent encore être vérifiés sur un vrai iPhone et un Android, notamment à grande vitesse et après changement d’orientation.

Pour essayer sur le même Wi-Fi avant déploiement :

```bash
HOST=0.0.0.0 npm start
```

Ouvrir `http://IP_LOCALE_DE_L_ORDINATEUR:4174` sur le téléphone ; autoriser le port 4174 sur le réseau local si nécessaire. Le serveur ne crée pas de tunnel public. Les souvenirs restent propres au navigateur et à l’origine : le carnet de localhost n’est pas transféré à l’adresse publique.

Le plein écran dépend de l’API disponible dans le navigateur : la rotation seule peut être refusée, car une activation utilisateur est généralement requise. Le jeu réessaie au prochain toucher et propose un bouton explicite. Voir [les restrictions de requestFullscreen](https://developer.mozilla.org/fr/docs/Web/API/Element/requestFullscreen). Le mode reste utilisable sans plein écran.

## Installer la PWA

Après le déploiement HTTPS, ouvrir le lien puis « Installer l’app », ou l’option d’installation du navigateur. Sur iPhone, ouvrir Safari → Partager → Sur l’écran d’accueil. L’icône du gabian à la sardine est fournie pour Android et Apple. Au lancement depuis l’icône, le manifeste demande un affichage autonome, sans barre d’adresse.

Le jeu et les zones déjà enregistrées se relisent depuis le téléphone ; Internet reste nécessaire pour découvrir de nouveaux secteurs et recevoir de nouvelles missions. Une page de secours existe si le cache du jeu est indisponible. Les mises à jour utilisent une version calculée automatiquement à partir des fichiers publics, et le cache des zones IGN est conservé. Vérifier l’installation, l’icône et le lancement depuis l’accueil sur un vrai Android/iPhone après déploiement. [Conditions d’installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Le cache carte peut atteindre 1 Go si le quota estimé le permet, avec une réserve de stockage et éviction des ressources les moins récentes. Les réglages affichent son usage et permettent de demander une conservation durable ou de vider uniquement la carte. Le mode durable dépend du navigateur ; il ne peut pas empêcher une suppression explicite des données par l’utilisateur. [Quotas et conservation](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
