# Pilote Corniche–Malmousque

Trois tuiles IGN (`16870/12005`, `16871/12005`, `16871/12004`) utilisent le MNT LiDAR HD et les orthophotographies IGN. Le raster source est au pas de 50 cm ; le jeu le rééchantillonne à environ 3,48 m pour limiter le poids et le coût graphique. Hors couverture, le relief RGE ALTI complète les points manquants. Aucun bâtiment photogrammétrique n'est inclus : les bâtiments BD TOPO restent en place.

Les données préparées sont livrées dans `public/geodata/corniche-v1/`. Elles ne dépendent pas du cache temporaire de Render et ne nécessitent aucune API payante. L'API terrain sert le même fichier d'altitudes que les modèles GLB, pour conserver la cohérence des véhicules et du décor.

Le moteur natif Babylon charge les GLB par `3d-tiles-renderer/babylonjs`, avec trois niveaux de détail : 65, 129 et 257 points par côté. Le niveau dépend de la caméra et de la qualité choisie ; le mode mobile accepte une erreur visuelle plus grande. Le décor classique reste visible jusqu'à ce que les tuiles natives et leurs shaders soient prêts, et revient si une tuile est retirée ou indisponible. Les photos marines sont conservées.

Les fichiers géographiques sont téléchargés à la demande et conservés dans le cache carte de la PWA, avec le quota habituel. Ils sont exclus du téléchargement initial des fichiers du jeu. Seuls les niveaux déjà parcourus sont disponibles hors ligne.

## Reconstruction

Avec Node 24 : `npm ci`, puis `npm run build:coast` et `npm run build:babylon`. Le script réutilise les grilles déjà présentes pour reconstruire les GLB ; supprimer une grille relance sa préparation depuis les sources IGN. Pour publier de nouvelles données après ce pilote, changer le répertoire `corniche-v1`, son URL dans `coast-config.js`, la lecture côté serveur et la version de l'URL terrain afin d'éviter les anciens caches mobiles.

Sources : [flux IGN](https://data.geopf.fr/wms-r?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities), [MNT LiDAR HD](https://www.data.gouv.fr/datasets/mnt-lidar-hd), [intégration Babylon](https://doc.babylonjs.com/features/featuresDeepDive/geospatial/loading3dTiles). Données IGN sous Licence Ouverte Etalab 2.0 ; bibliothèque NASA/AMMOS et Babylon sous Apache 2.0.

La suite consiste à obtenir des modèles réutilisables pour les ouvrages et bâtiments remarquables, puis à améliorer les matériaux et l'atmosphère. Le MNT décrit le sol et ne suffit pas à reconstruire un tablier de pont.
