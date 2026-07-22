# Format de projet Stickman — Spécification v1

Le projet est **un seul document JSON**. C'est le contrat entre les trois briques du système :
l'**éditeur** l'écrit, le **player navigateur** le joue en temps réel, le **worker de rendu**
(Render + FFmpeg) le rejoue image par image pour produire le MP4 final. Même JSON, même moteur
de dessin, résultat identique.

Il est stocké tel quel dans Neon (colonne `JSONB` de la table `projets`).

---

## 1. Racine du document

```json
{
  "version": 1,
  "meta": {
    "titre": "Mon premier sketch",
    "format": "9:16",
    "fps": 30,
    "resolution": { "l": 1080, "h": 1920 }
  },
  "personnages": [ ... ],
  "audios": [ ... ],
  "scenes": [ ... ]
}
```

| Champ | Rôle |
|---|---|
| `version` | Version du schéma. Permet les migrations futures sans casser les vieux projets. |
| `meta.format` | `"9:16"` (TikTok/Reels), `"1:1"` ou `"16:9"`. Détermine la résolution de rendu. |
| `meta.fps` | 30 par défaut, 60 pour les plans payants supérieurs. |

La **durée totale** n'est pas stockée : c'est la somme des durées de scènes (calculée),
ce qui évite toute incohérence. Le serveur la vérifie contre la limite du plan de
l'utilisateur avant tout rendu.

---

## 2. Personnages (`personnages[]`)

Les personnages sont définis **une fois au niveau du projet**, puis référencés par les scènes.
C'est ce qui permet la fonction « mes personnages sauvegardés » : on copie simplement cet objet
d'un projet à l'autre.

```json
{
  "id": "hero",
  "nom": "Kader",
  "style": {
    "couleur": "#101223",
    "epaisseur": 1.0,
    "tete": "ronde",
    "taille": 1.0,
    "accessoires": ["casquette"],
    "objet": null
  }
}
```

| Champ | Valeurs |
|---|---|
| `couleur` | Hex. Couleur du trait du corps. |
| `epaisseur` | Multiplicateur du trait (0.7 fin → 1.5 épais). |
| `tete` | `"ronde"` \| `"carree"` \| `"contour"` (cercle non rempli). |
| `taille` | Échelle globale (0.8 enfant → 1.2 grand). |
| `accessoires` | Ids de la bibliothèque : `casquette`, `lunettes`, `cravate`, `couronne`… Chaque accessoire est un petit dessin vectoriel attaché à un point du squelette : il suit l'animation automatiquement. |
| `objet` | Objet en main (`telephone`, `micro`, `ballon`…) ou `null`. |

---

## 3. Audios (`audios[]`)

Fichiers importés ou enregistrés au micro. Le fichier lui-même vit dans le stockage
(R2/disque) ; le JSON n'en garde que la référence et le **résultat de l'analyse labiale**,
calculé une seule fois à l'import.

```json
{
  "id": "voix1",
  "url": "audios/abc123.m4a",
  "duree": 3.4,
  "bouche": [0, 0, 2, 3, 1, 2, 3, 3, 1, 0]
}
```

`bouche` : piste de synchronisation labiale par **amplitude**. Une valeur par fenêtre de
**50 ms** : `0` fermée · `1` entrouverte · `2` ouverte · `3` grande ouverte. Générée par
la Web Audio API côté navigateur à l'import (aucune dépendance à la langue). Le player et
le worker se contentent de lire ce tableau — ils n'analysent jamais l'audio eux-mêmes.

---

## 4. Scènes (`scenes[]`)

Une vidéo = une suite de scènes. Chaque scène est autonome.

```json
{
  "id": "s1",
  "duree": 4.0,
  "decor": { "type": "preset", "id": "studio" },
  "camera": { "zoom": 1.0, "tremblement": false },
  "acteurs": [ ... ],
  "textes": [ ... ],
  "sons": [ ... ],
  "transition": { "type": "fondu", "duree": 0.4 }
}
```

- `decor` : `preset` (bibliothèque : `studio`, `ville`, `bureau`, `salle_sport`…), `couleur`
  (aplat/dégradé personnalisé) ou `image` (fond uploadé, plans payants).
- `camera.zoom` : 1.0 par défaut ; un léger `1.05` animé donne la « caméra vivante ».
  `tremblement` : secousse d'impact ponctuelle.
- `transition` : appliquée en **sortie** de scène. `fondu`, `cut`, `glissement`, `zoom`.

### 4a. Acteurs (`acteurs[]`)

Une **instance** d'un personnage dans la scène, avec sa chronologie d'actions.

```json
{
  "personnageId": "hero",
  "position": { "x": 0.2, "y": 0.85 },
  "miroir": false,
  "chrono": [
    { "t": 0.0, "action": "marcher", "duree": 2.0, "versX": 0.55 },
    { "t": 2.0, "action": "saluer",  "duree": 2.0, "expression": "content" }
  ],
  "voix": { "audioId": "voix1", "t": 2.2 }
}
```

- `position` : fractions de l'écran (`x` 0→1 gauche-droite, `y` = ligne de sol).
  Indépendant de la résolution : le même projet se rend en 720p ou 1080p sans changement.
- `chrono[]` : le cœur du système « boutons ». Chaque entrée = **une action de la
  bibliothèque** (`immobile`, `marcher`, `courir`, `sauter`, `saluer`, `pointer`,
  `celebrer`, `tomber`, `reflechir`…) + durée. `versX` déclenche un déplacement (le moteur
  oriente le personnage automatiquement). `expression` change le visage (`neutre`,
  `content`, `surpris`, `fache`, `triste`).
- `voix` : quand elle joue, le moteur superpose la piste `bouche` de l'audio au visage —
  le personnage parle **pendant** qu'il fait ses gestes (deux couches indépendantes).

### 4b. Textes (`textes[]`)

```json
{ "t": 2.2, "duree": 1.8, "type": "bulle", "acteur": "hero", "contenu": "Bienvenue !" }
{ "t": 0.0, "duree": 3.0, "type": "titre", "contenu": "ÉPISODE 1", "style": "impact" }
```

`bulle` (attachée à un acteur, suit sa tête) · `soustitre` (bas d'écran) · `titre`
(plein écran, styles typographiques prédéfinis).

### 4c. Sons (`sons[]`)

```json
{ "audioId": "musique1", "t": 0, "volume": 0.5, "role": "musique" }
{ "sfx": "applaudissements", "t": 3.2, "volume": 0.8 }
```

3 rôles mixés au rendu : `voix`, `musique`, `sfx`. Le **ducking** est automatique : la
musique descend à ~30 % pendant qu'une voix joue, remonte ensuite. Fondu de sortie
automatique sur la dernière scène. Tout le mixage final est fait par FFmpeg (filtres
`amix` + `sidechaincompress`/enveloppes de volume).

---

## 5. Le squelette (référence moteur — pas dans le JSON utilisateur)

Le stickman est un squelette hiérarchique de **13 segments**, paramétré par la hauteur
`H` du personnage :

```
                 tête (rayon 0.11H)
                  │
   main─avantbras─┤cou
        (0.15H)   │
   bras(0.16H)──épaules
                  │ colonne (0.25H)
                bassin (racine)
                ╱      ╲
        cuisse(0.24H)  cuisse
            │             │
        tibia(0.24H)   tibia
            │             │
          pied          pied
```

Une **pose** = un jeu d'angles (colonne, tête, épaule/coude ×2, hanche/genou ×2) + un
décalage vertical du bassin (`dy`, pour les rebonds et sauts).

Une **action de la bibliothèque** = une liste de poses-clés sur une phase 0→1, avec
interpolation adoucie (ease-in-out) entre les clés, bouclée ou non. Exemple (marche) :

```json
{
  "id": "marcher", "boucle": true, "periode": 0.8,
  "cles": [
    { "p": 0.0,  "pose": { "hancheG": -28, "hancheD": 28, "genouG": 12, ... } },
    { "p": 0.25, "pose": { ... } },
    { "p": 0.5,  "pose": { "hancheG": 28, "hancheD": -28, ... } },
    ...
  ]
}
```

**Conséquence clé de cette conception** : les actions sont des **données**, pas du code.
En ajouter une nouvelle (danser, dribbler, prier…) = ajouter un JSON à la bibliothèque,
sans toucher au moteur. C'est notre actif produit : la qualité et la richesse de cette
bibliothèque.

Le rendu (trait rond, ombre portée au sol, visage expressif, bouche 4 états, accessoires
ancrés aux articulations) est le même code TypeScript dans le navigateur (canvas) et dans
le worker (node-canvas) — moteur **isomorphe**, garanti pixel-identique.

---

## 6. Ce que la v1 ne couvre pas (réservé, prévu)

- `voix.tts` : générer l'audio depuis le texte (plus tard — s'insérera sans changer le
  schéma : un TTS produit un audio → même pipeline `bouche`).
- `calques` : images/props libres posés dans la scène.
- `multi-pistes camera` : mouvements de caméra keyframés.

Chaque ajout futur incrémentera `version`, avec migration automatique des anciens projets.
