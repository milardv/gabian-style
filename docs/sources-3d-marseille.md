# Données 3D de Marseille — recherche du 9 octobre 2026

## Résultat

Une maquette texturée de Marseille est accessible chez Luciad/Hexagon, mais son service est limité aux tests et démonstrations. La piste ouverte vérifiée pour le jeu est le LiDAR IGN (sol et sursol), combiné aux orthophotos métropolitaines 2022 à 5 cm. Ces données nécessitent une préparation ; elles ne constituent pas une maquette photogrammétrique prête à brancher. La reconstruction ouverte a ensuite été intégrée dans `corniche-v2` : six tuiles, photos métropolitaines composites, MNT/MNS IGN et toitures dérivées. Les services Google et Airbus/Luciad restent exclus de la production.

## Maquette Airbus / Luciad

- Documentation : https://dev.luciad.com/portal/productDocumentation/LuciadRIA/docs/samples.html?component=LuciadRIA.LuciadRIA
- Entrée : https://sampleservices.luciad.com/ogc/3dtiles/marseille-mesh/tileset.json
- Créateur indiqué : Airbus, avec Airbus Street Factory.
- Vérification directe : manifest HTTP 200, version 3D Tiles 1.0, 2 064 contenus dans sa hiérarchie. Une tuile `Data/0.b3dm` répond HTTP 200 et contient un glTF 2.0 avec une image JPEG embarquée.
- Emprise du volume racine convertie de radians en degrés : longitude 5.339112–5.406213 ; latitude 43.269377–43.320453. Elle englobe le centre et une partie du littoral, sans garantir la présence de géométrie partout dans ce rectangle. Elle ne couvre pas l'île Maïre ni les Calanques.
- Le fournisseur réserve explicitement le service aux tests et démonstrations. Aucune licence autorisant sa redistribution dans le jeu public n'a été trouvée. Ne pas en faire une dépendance de production ni recopier l'ensemble dans la PWA.
- Adaptation technique requise : volumes `region`, positions ECEF / RTC_CENTER et conversion vers les coordonnées locales du jeu. Le README Babylon de NASA indique encore l'absence de prise en charge de `boundingRegion`. Le traitement des textures JPEG embarquées doit aussi être adapté : le pilote IGN actuel recharge des JPEG externes.

## Orthophotoplan métropolitain 2022 : source ouverte vérifiée

- Fiche : https://data.ampmetropole.fr/explore/assets/fr-orthophoto-mamp-2022/
- Métadonnées : https://data.ampmetropole.fr/api/explore/v2.1/catalog/datasets/fr-orthophoto-mamp-2022
- Téléchargement : https://data.ampmetropole.fr/pages/orthophoto-2022-mamp/
- WMS : https://imageries.datasud.fr/orthothr ; couche `MAMP`.
- Formats et projections : WMS avec EPSG:3857, 2154, 3944, 4326 ; fichiers JP2 en Lambert 93 et ECW en CC44.
- L'API officielle indique Licence Ouverte 2.0 Etalab, résolution 5 cm/pixel, précision planimétrique 10 cm, prises de vue du 14 avril au 4 juillet 2022.
- Vérification : GetCapabilities valide et GetMap PNG 1024 × 1024 HTTP 200 sur une emprise de 100 × 100 m autour de la Fausse-Monnaie. Image inspectée : route, rochers et mer visibles. Échantillon temporaire `/tmp/marseille-ortho-2022-corniche.png`.
- Utilité : textures plus nettes des routes, rochers et toits. Une photo verticale ne donne pas les façades ; 5 cm dans la source ne signifie pas 5 cm dans une texture du jeu rééchantillonnée. Prévoir découpage fin, niveaux de détail, attribution et budget mobile.

## IGN : géométrie du sol et du sursol

- Catalogue : https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_NUAGES-DE-POINTS-LIDAR-HD
- Présentation : https://www.ign.fr/lidar-hd-architecture
- WMS : https://data.geopf.fr/wms-r
- Couche sursol vérifiée : `IGNF_LIDAR-HD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93`.
- Test Corniche : GetMap GeoTIFF 257 × 257 sur 300 × 300 m, HTTP 200 ; 65 626 valeurs utilisables sur 66 049, maximum 55,01 m. Échantillon temporaire `/tmp/marseille-corniche-mns.tif`.
- Le MNT actuellement exploité décrit le sol. Le MNS ajoute toits et végétation. Combiner MNT, MNS, empreintes BD TOPO et, si nécessaire, points classifiés pour améliorer les toitures et placer la végétation. Conserver le MNT pour le sol et la physique : remplacer le sol par le MNS ferait rouler les véhicules sur les toits. Un raster reste limité pour les façades, surplombs et dessous des ponts.

## Sources consultées mais insuffisantes pour alimenter Marseille

- Démo Babylon https://demos.babylonjs.com/3d-tiles/ : utilise Google Photorealistic 3D Tiles, pas un fichier Marseille ouvert. https://developers.google.com/maps/comms/eea/map-tiles confirme leur indisponibilité pour les projets EEE soumis aux nouvelles conditions ; les projets antérieurs peuvent relever du régime de transition. https://developers.google.com/maps/documentation/tile/policies limite préchargement, stockage et usages hors ligne. Incompatible avec notre stratégie de cache durable sans revoir ces conditions et l'accès au service. Couverture Marseille de cette API non vérifiée avec une clé autorisée.
- Démo NASA https://nasa-ammos.github.io/3DTilesRendererJS/babylonjs/index.html : Dingo Gap sur Mars. Le code `example/babylonjs/index.js` confirme cette source. La licence du moteur ne concède aucun droit sur des données tierces.
- https://www.ogc.org/standards/3dtiles/ : spécification du format, pas catalogue Marseille.
- https://cesium.com/learn/3d-tiling/ et https://github.com/CesiumGS/3d-tiles/blob/main/RESOURCES.md : outils de conversion et sources variées ; aucun jeu Marseille ouvert prêt à intégrer identifié dans ces listes.
- https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/babylonjs/renderer/README.md : limites Babylon, notamment `boundingRegion`, I3DM et PNTS non pris en charge. Les nuages LiDAR doivent être transformés en maillages compatibles pour notre renderer.
- Jumeau régional : https://connaissance-territoire.maregionsud.fr/la-plateforme/les-projets/jumeau-numerique ; premières productions annoncées sur le Briançonnais et les Alpes-Maritimes. Pas de téléchargement d'une maquette Marseille confirmé. Ne pas interpréter l'annonce d'ouverture fin 2026 comme une couverture Marseille déjà disponible.

## Travail intégré et suite

1. Intégré : Corniche–Malmousque, Maïre et secteur du départ Calanques, textures fines et MNT IGN.
2. Intégré : toitures dérivées du MNS et des emprises BD TOPO. Les ponts et la végétation détaillée restent à traiter séparément.
3. Les tests de couverture et les fichiers ont été préparés pour les deux tuiles de Maïre et la tuile du départ Calanques ; le reste des Calanques ne bénéficie pas encore de ce traitement.
4. Pour une ville entièrement photogrammétrique avec façades photographiques : obtenir une licence de la maquette Airbus ou attendre/identifier une publication ouverte effective.
