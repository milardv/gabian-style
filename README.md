# gabian-style

Jeu de vol au-dessus de Marseille, avec exploration en gabian et en scooter TMAX.

## Démarrer

Node.js 24 ou plus récent, sans paquet npm à installer.

```bash
cd /home/valm/IdeaProjects/gabian-style
npm start
```

Ouvrir http://127.0.0.1:4174. Le port peut être changé avec `PORT`.

## Jeu et données


Ouvrir `/` (`/marseille` reste disponible). Vue 3D locale avec Three.js 0.186.1 embarqué sous licence MIT, sans installation npm ni clé API. Relief RGE ALTI, orthophotos et bâtiments BD TOPO IGN ; contour communal API Géo. Les hauteurs absentes sont approximées à partir des étages. Les façades et les toits sont des volumes simplifiés, pas une reconstruction photogrammétrique.

- Flèches / ZQSD : monter, descendre et incliner pour tourner. `+` / `−` : vitesse ; `T` : poussée rapide (jusqu’à 220 km/h, vol non réaliste) ; `C` : première personne ; `G` : plané ; `H` : masquer l’interface ; espace : pause ; `R` : repartir.
- Souris par glissement, boutons tactiles et manette (stick gauche, gâchettes) disponibles.
- Sept départs, dont la rade du Frioul, vitesse souhaitée, mistral simulé, qualité graphique et plein écran. Le vol reste sur Marseille et le corridor maritime balisé, avec sol contrôlé par RGE ALTI ; il s’arrête sur contact avec le relief, les bâtiments ou les clochers chargés.
- Modèle physique simplifié : portance, traînée, gravité, inclinaison, inertie, décrochage et battements liés à l’effort. Paramètres illustratifs ; aucune validation biologique. Le mistral et les ascendances sont simulés.
- Maillage du relief RGE ALTI resserré à environ 10 m par tuile. Orthophoto IGN haute résolution (2048 px) près du gabian, résolution allégée plus loin, et vue aérienne générale de Marseille en arrière-plan. Les toits reprennent leur image aérienne réelle ; les façades détaillent fenêtres, volets et balcons par textures procédurales. Les volumes restent simplifiés, sans photogrammétrie. Les hauteurs IGN sont utilisées quand elles existent ; sinon elles sont approximées à partir des étages. Mode Fluide : 25 tuiles de terrain, bâtiments sur 9 ; Détaillée : 49 et 25. Les tuiles éloignées sont libérées. WebGL 2 requis. La fluidité dépend du matériel ; aucun débit d’images garanti.
- Deux cargos illustratifs aux couleurs CMA CGM et trois voiliers animés parcourent la rade. Ils sont décoratifs, avec houle simplifiée ; leur position et trajectoire ne sont pas du suivi AIS.
- `npm run sync:marseille` prépare le relief global et cinq tuiles centrales. Cache dans `.data/marseille` : JSON rafraîchi après 30 jours, orthophotos conservées jusqu’à suppression du cache. Le cache n’indique pas la date de prise de vue ou du relevé IGN.

Sources : [IGN RGE ALTI](https://geoservices.ign.fr/rgealti), [BD ORTHO](https://geoservices.ign.fr/bdortho), [BD TOPO](https://geoservices.ign.fr/bdtopo), [API Géo](https://geo.api.gouv.fr/). Les services peuvent être temporairement indisponibles ; les zones concernées sont signalées et réessayées.

## Tests

```bash
npm test
```
