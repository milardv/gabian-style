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

- Flèches / ZQSD : monter, descendre et incliner pour tourner. `+` / `−` : vitesse ; `T` : poussée rapide (jusqu’à 220 km/h, vol non réaliste) ; `N` : nitro (environ 360 km/h, appuyer à nouveau pour couper) ; `P` : réduire/ouvrir le panneau de contrôles ; `C` : première personne ; `G` : plané ; `H` : masquer l’interface ; espace : pause ; `R` : repartir.
- Souris par glissement, boutons tactiles et manette (stick gauche, gâchettes) disponibles.
- Sept départs, dont la rade du Frioul, vitesse souhaitée, mistral simulé, qualité graphique et plein écran. Le vol reste sur Marseille et le corridor maritime balisé, avec sol contrôlé par RGE ALTI ; il s’arrête sur contact avec le relief, les bâtiments ou les clochers chargés.
- Modèle physique simplifié : portance, traînée, gravité, inclinaison, inertie, décrochage et battements liés à l’effort. Paramètres illustratifs ; aucune validation biologique. Le mistral et les ascendances sont simulés.
- Maillage du relief RGE ALTI à environ 11 m en ville et 5,5 m dans les Calanques et leurs îles, dont Maïre. Les tuiles proches conservent leur résolution complète, aussi sur mobile. Le fond général est masqué exactement dans les secteurs détaillés ; le terrain se charge indépendamment de l’orthophoto. Les appels altimétriques IGN utilisent des lots POST de 4000 points et une file commune limitée à moins de cinq requêtes par seconde. Orthophoto IGN haute résolution (2048 px) près du gabian, résolution allégée plus loin, et vue aérienne générale de Marseille en arrière-plan. Les toits reprennent leur image aérienne réelle ; les façades détaillent fenêtres, volets et balcons par textures procédurales. Les volumes restent simplifiés, sans photogrammétrie. Les hauteurs IGN sont utilisées quand elles existent ; sinon elles sont approximées à partir des étages. Mode Fluide : 25 tuiles de terrain, bâtiments sur 9 ; Détaillée : 49 et 25. Les tuiles éloignées sont libérées. WebGL 2 requis. La fluidité dépend du matériel ; aucun débit d’images garanti.
- **Petit voilier pilotable** : choisir Petit voilier dans Véhicule. Départs au large du Vieux-Port, du Frioul, de la Corniche, du Prado, de l’Estaque et des Calanques ; les choix situés en ville repartent dans la rade du Vieux-Port. Flèches gauche/droite : barre ; haut : border, bas : choquer (mêmes boutons tactiles). Le mistral vient du nord-ouest : environ 40° de chaque côté du vent sont non navigables, il faut tirer des bords. Vitesse en nœuds et indicateur discret du vent ressenti : flèche de provenance par rapport à la proue, bâbord/tribord, angle et conseil pour border ou choquer selon le réglage physique. Le mistral se règle de 0 à 200 km/h ; sa force agit sur la propulsion et la gîte, avec une résistance de coque progressive à grande vitesse. Physique de voile simplifiée : vent apparent, inertie, résistance de coque, dérive et gîte progressive. La toile se creuse sous la pression et faseye lorsqu’elle est déventée ; la bôme accompagne les changements de bord. Coque, vagues locales, barre et sillage suivent la simulation à 120 Hz avec interpolation, caméra amortie et pause. La côte est contrôlée avec le relief et l’orthophoto chargés ; un échouage affiche Repartir. Pas de nitro sur le voilier. Les livraisons terrestres restent accessibles en changeant de véhicule.
- Deux cargos illustratifs aux couleurs CMA CGM et trois voiliers animés parcourent la rade. Ils sont décoratifs, avec houle simplifiée ; leur position et trajectoire ne sont pas du suivi AIS.
- `npm run sync:marseille` prépare le relief global et cinq tuiles centrales. Cache dans `.data/marseille` : JSON rafraîchi après 30 jours, orthophotos conservées jusqu’à suppression du cache. Le cache n’indique pas la date de prise de vue ou du relevé IGN.

Sources : [IGN RGE ALTI](https://geoservices.ign.fr/rgealti), [BD ORTHO](https://geoservices.ign.fr/bdortho), [BD TOPO](https://geoservices.ign.fr/bdtopo), [API Géo](https://geo.api.gouv.fr/). Les services peuvent être temporairement indisponibles ; les zones concernées sont signalées et réessayées.

## Tests

```bash
npm test
```

### Interface et ambiance

Le panneau de pilotage se replie sans masquer la télémétrie ni la carte. La carte en overlay alterne entre la rade et les rues. `H` masque toute l’interface ; `H`, `Échap` ou un double-clic sur le paysage la réaffichent. La direction graphique s’inspire de l’esprit solaire de Cagnard : bleu, crème, touches jaune et orange, typographie affirmée.

Au Vélodrome, un match fictif anime des joueurs, des tribunes et des fumigènes bleus et blancs. Les particules sont réutilisées et les effets limités aux environs du stade. Le nitro est coupé au changement de véhicule, lors d’une collision du gabian, au redémarrage et lorsque la fenêtre perd le focus.

### Carnet du gabian

Les lieux IGN ont des étiquettes en overlay : police de taille fixe, sans occultation par le relief, cinq noms maximum et évitement des panneaux. Passer à moins de 130 m d’un lieu, à hauteur du sol ou jusqu’à 350 m au-dessus de son sommet, valide sa première visite (+100 points). Les visites sont indépendantes de l’affichage des étiquettes, fonctionnent en gabian et en scooter, et restent dans le navigateur via localStorage. Les badges arrivent à 1, 5, 10 et 25 visites. Aucun point supplémentaire en repassant au même endroit.

`V` ou le bouton « Cri » produit un cri synthétique de gabian via Web Audio, uniquement à la demande. Le gabian illustré de l’accueil picore sa sardine ; cliquer dessus le fait crier. L’animation peut être mise en pause et respecte la préférence de mouvement réduit.

### Marseille populaire

Les scènes illustrées complètent les données IGN : ferry-boat et passagers au Vieux-Port, pétanque à Borély, étals à Noailles, apéro sur la Corniche, cortège bleu et blanc près du Vélodrome, linge et gabians au Panier, sardine géante occasionnelle dans le port, plongeurs acrobatiques et amis qui applaudissent sur la Corniche, et familles autour de barbecues aux merguez sur deux plages du Prado. Les scènes peuvent se décaler de quelques mètres pour éviter les bâtiments ; il ne s’agit pas d’une reconstitution documentaire.

Elles apparaissent sur les cartes et dans les étiquettes, et leur première visite vaut 100 points dans le carnet. Les nouveaux départs Noailles, Borély et Le Panier permettent de les trouver facilement. `V` fait réagir les gens proches (saluts, réponses écrites, gabians qui approchent).

« Ambiances sonores » dans les contrôles active des sons synthétiques selon la proximité : ferveur du stade, corne du ferry, boules, verres et oiseaux. Ils restent désactivés par défaut. Avec un mistral d’au moins 3 m/s, une ascendance côtière près de la Corniche aide le vol à basse altitude. La sardine apparaît pendant 85 secondes après un délai initial de 45 à 180 secondes, puis revient toutes les huit minutes de jeu.

Les plongeurs prennent leur élan, effectuent un salto, entrent dans la mer avec éclaboussures puis nagent ; les amis les félicitent à chaque arrivée dans l’eau. Les familles du Prado réunissent adultes et enfants, parasols, serviettes, glacières, cuisiniers et fumée légère portée par le mistral. Des femmes adultes bronzent seins nus sur leurs serviettes, avec bas de maillot, lunettes et chapeaux posés à côté, dans le même style illustré. La répartition couvre 30 zones du littoral : les 23 plages référencées dans le [catalogue géographique de la Ville de Marseille](https://www.marseille.fr/sites/default/files/QEB/qab.geojson), plus Malmousque, la Fausse-Monnaie, le Vallon des Auffes, Maldormé, Saména, Sugiton et Morgiret. Le catalogue est figé au 9 octobre 2026 ; les scènes restent dans les limites et secteurs déjà accessibles du jeu. Chaque nouvelle zone cherche jusqu’à quatre emplacements sur les plages et deux sur les rochers, en évitant eau, bâtiments et pentes selon l’orthophoto et le relief chargés. Les figures sont fusionnées en un seul maillage par zone, construit à proximité puis réutilisé. Les applaudissements synthétiques suivent l’option Ambiances sonores. Les animations suivent la pause et les nouvelles scènes réduisent les mouvements lorsque cette préférence est activée sur l’appareil. Les décors sont construits à proximité, attendent les bâtiments IGN pour leur placement, partagent leurs géométries et utilisent des instances pour les foules. Les scènes éloignées sont masquées et réutilisées au retour.

### Conduite du scooter

Le scooter utilise un modèle cinématique à deux roues : braquage progressif, rayon de virage limité par la vitesse et l’adhérence, inclinaison calculée à partir de l’accélération latérale. Les changements de direction, accélérations et freinages sont amortis. Le guidon et la roue avant suivent le braquage ; le scooter se redresse à l’arrêt. La route ne recale plus automatiquement le véhicule vers son centre.

La physique avance à 120 Hz et la pose affichée est interpolée entre les étapes. La caméra de poursuite garde l’horizon droit et anticipe doucement le virage. Les hauteurs route/relief sont mélangées progressivement. Les données routières arrivant après le départ ne déplacent pas un scooter en mouvement. Flèches/ZQSD, boutons tactiles et manette permettent de conduire. C’est un modèle de conduite simplifié, pas une reproduction mesurée d’un TMAX réel.

En scooter, maintenir `Maj` en tournant déclenche un dérapage assisté à partir de 11 km/h : l’arrière glisse, le scooter pivote davantage et perd un peu de vitesse. Relâcher reprend progressivement l’adhérence. Le bouton « Déraper » fonctionne en maintien tactile ou clavier (Espace/Entrée), et le bouton A de la manette produit le même effet. C’est une aide arcade pour serrer les virages.

`N` ou le bouton « Nitro » active aussi la nitro du scooter : accélérer fournit une poussée progressive, jusqu’à environ 250 km/h sur le plat. La désactivation ralentit progressivement. À grande vitesse, une crête peut faire perdre le contact des roues : le scooter conserve sa trajectoire en l’air, subit la gravité et amortit la réception. Accélérer, freiner et déraper agissent au sol ; les données de relief chargées brutalement ne déclenchent pas un saut artificiel.

## Internet et téléphone

Voir [le guide de déploiement](docs/deploiement.md) : démo Render gratuite avec HTTPS, passage possible à un disque persistant payant, ou conteneur Docker sur votre serveur. `HOST=0.0.0.0` permet l’accès réseau ; `/healthz` contrôle le serveur sans appeler l’IGN.

Sur écran tactile, le mode « Mobile · léger » limite le rendu et les textures, replie les réglages et laisse les commandes principales accessibles. WebGL 2 et une connexion restent nécessaires ; la fluidité sur de vrais téléphones reste à vérifier.

L’accueil tactile conserve le gabian animé au-dessus du texte défilant. Le bouton plein écran est accessible dès l’accueil et via le raccourci dans le coin inférieur droit. Le passage en paysage tente le plein écran ; si le navigateur exige une interaction, le prochain toucher pendant la partie réessaie. Une sortie volontaire est respectée jusqu’à la prochaine rotation. En vue libre, « Afficher les contrôles » reste visible dans le coin.

## Application mobile (PWA)

Le manifeste fournit une identité stable et un lancement autonome, avec icônes PNG 192/512 px, une version Android maskable et une icône Apple 180 px. « Installer l’app » ouvre l’invitation native lorsqu’elle est disponible ; sinon il indique la procédure du navigateur. Sur iPhone : Safari → Partager → Sur l’écran d’accueil.

HTTPS est nécessaire en production. Le service worker conserve les fichiers du jeu dans un cache versionné, et enregistre à la demande le relief, les bâtiments, les routes et les orthophotos déjà parcourus. Ces zones sont ensuite servies directement depuis le téléphone. Le cache carte survit aux mises à jour du jeu ; les nouveaux secteurs et les missions nécessitent toujours une connexion. Une mise à jour complète des fichiers est préparée en arrière-plan et le bouton « Mettre à jour le jeu » permet de relancer sans interrompre une partie automatiquement. Les visites restent dans le stockage local de cette origine ; selon le navigateur, le carnet de l’app installée peut être distinct de celui de l’onglet.

Le cache carte vise jusqu’à 1 Go, avec un plafond réduit selon le quota et l’usage estimés par le navigateur (256 Mo si l’estimation manque). Il conserve au maximum 4 000 ressources et supprime les moins récemment utilisées quand la limite est atteinte. Les données JSON se rafraîchissent après 30 jours, les images après 90 jours, sans bloquer la lecture du cache. Les missions aléatoires ne sont jamais mémorisées. Le cache est activé par défaut, dès l’ouverture du jeu. La conservation durable est demandée automatiquement, puis retentée à la première interaction si nécessaire. « Vider le cache carte » libère les données géographiques sans effacer les souvenirs ni désactiver les prochains enregistrements. Le navigateur garde la décision sur le quota et la conservation effective.

Après une collision du gabian, un panneau de récupération affiche un grand bouton orange « Repartir », même en vue libre ou avec les réglages repliés. Il indique la préparation du départ, empêche les relances multiples et reste disponible pour réessayer si le chargement échoue.
