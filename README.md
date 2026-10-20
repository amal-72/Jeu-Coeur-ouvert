# CŒUR OUVERT — Survie Cellulaire & Neuro-Évolution

> **Un jeu de survie microscopique dans les profondeurs du cœur humain.**  
> Pilotez votre globule blanc, éliminez les bactéries avec vos alliés, et survivez à la menace virale.

---

## 🎮 Présentation

**CŒUR OUVERT** est un jeu de simulation biologique jouable dans le navigateur, développé avec [p5.js](https://p5js.org/) et [TensorFlow.js](https://www.tensorflow.org/js). Vous incarnez un **globule blanc** (leucocyte) qui défend l'organisme contre des bactéries envahissantes.

Le jeu intègre également un volet **pédagogique** démontrant :
- Les algorithmes de **Steering Behaviors** de Craig Reynolds (Seek, Flee, Pursue, Evade, Arrive, Wander, Path Following, Obstacle Avoidance)
- Les comportements de **Boids** (Séparation, Alignement, Cohésion)
- Le **Leader Following** dynamique (1 leader + 3 suiveurs autonomes)
- La **génétique bactérienne** (ADN, croisement, mutation, sélection par tournoi)
- La **neuro-évolution** du SuperVirus (réseau neuronal évolutionnaire)

---

## 🚀 Lancement

Le jeu ne nécessite **aucune installation**. Il suffit d'ouvrir `index.html` dans un navigateur moderne (Chrome, Firefox, Edge, Safari).

```
Jeu-Coeur-ouvert/
├── index.html        ← Point d'entrée du jeu
├── css/
│   └── style.css     ← Interface et styles
└── js/
    ├── main.js       ← Boucle de jeu principale
    ├── globals.js    ← Variables globales partagées
    ├── Vehicle.js    ← Classe de base Steering Behaviors
    ├── WhiteCell.js  ← Globule blanc (joueur & alliés)
    ├── Bacteria.js   ← Bactéries ennemies
    ├── BacteriaDNA.js         ← Génotype bactérien
    ├── BacteriaEvolution.js   ← Algorithme génétique bactérien
    ├── Virus.js               ← Virus prédateur (Pursue + hystérésis)
    ├── SuperVirusNeuroEvolution.js ← Réseau neuronal + neuro-évolution
    ├── RedCell.js             ← Globule rouge (Path Following)
    ├── LeaderFollowing.js     ← Démo Leader Following
    ├── ObstacleAvoidance.js   ← Évitement d'obstacles (rayons)
    ├── Obstacle.js            ← Obstacles biologiques statiques
    ├── Nutrient.js            ← Nutriments collectables
    ├── PowerUp.js             ← Power-ups (bouclier, vitesse)
    ├── BioArena.js            ← Fond biologique animé
    ├── HeartIntro.js          ← Écran d'intro animé
    └── utils.js               ← Fonctions utilitaires
```

> **Note :** Les fichiers `Car.js`, `Track.js`, `Genetic.js`, `Ray.js`, `NeuralNetwork.js` sont présents sur disque mais **non chargés** dans la version actuelle du jeu.

---

## 🕹️ Comment jouer

### Démarrage
1. Ouvrez `index.html` dans votre navigateur.
2. Un **écran d'accueil** animé (cœur battant) apparaît — **cliquez sur le cœur** pour entrer.
3. Le **menu principal** s'affiche. Cliquez sur **"COMMENCER LA PARTIE"**.

### Objectif principal
- **Éliminer toutes les bactéries** de l'arène biologique.

### Objectif secondaire
- **Collecter 5 nutriments** : bonus de **+25 points**.

### Conditions de défaite
- L'**énergie du joueur tombe à 0** (vidée passivement avec le temps et au contact des bactéries).
- Contact direct avec un **virus** : défaite immédiate.

### Condition de victoire
- Toutes les bactéries de la vague sont éliminées.

---

## ⌨️ Commandes

| Touche | Action |
|--------|--------|
| `Z` `Q` `S` `D` | Déplacer le globule blanc (AZERTY) |
| `W` `A` `S` `D` | Déplacer le globule blanc (QWERTY) |
| `↑` `↓` `←` `→` | Déplacer le globule blanc (flèches) |
| `Espace` | **Attaque phagocytaire** sur la bactérie la plus proche |
| `E` | **Bouclier immunitaire** (actif 1,8 s — recharge 9 s) |
| `Clic gauche` sur une bactérie | Désigner une **cible prioritaire** aux alliés |
| `Échap` | Pause / Reprendre |

---

## 🧬 Entités de l'arène

### 🔵 Globule blanc (Joueur)
- Se déplace au **clavier** (ZQSD / WASD / flèches).
- Perd de l'énergie passivement (drain constant) et au contact des bactéries.
- Récupère de l'énergie en collectant des **nutriments** (hexagones verts).
- Peut activer un **bouclier** temporaire (`E`) ou ramasser des **power-ups** sur l'arène.

### 🔵 Globules blancs alliés (IA autonome)
- 2 à 4 alliés configurables dans les paramètres (slider).
- **Rôle 1** : suit le joueur (Leader Following).
- **Rôles 2–4** : chassent la bactérie la plus proche, ou errent vers des nutriments.
- Répondent aux **ordres tactiques** du joueur (clic gauche sur une bactérie → tous les alliés convergent).
- Un allié dont la santé tombe à 0 est **retiré définitivement** de la partie (pas de game over).
- Comportements combinés : Arrive, Pursue, Obstacle Avoidance, Séparation.

### 🟣 Bactéries (Ennemies)
- Chacune possède un **ADN** (vitesse max, rayon de perception, agressivité, attraction nutriments, fuite, répulsion toxines).
- Comportements en jeu : **Poursuite** du joueur/allié le plus proche, **Boids** (Séparation, Alignement, Cohésion).
- **3 points de vie** au démarrage (forcés par `main.js`) — éliminées en 3 touches.
- Difficulté progressive : vitesse et agressivité augmentent sur 90 secondes.
- Les bactéries peuvent aussi **collecter des nutriments** (gameplay pédagogique).

### 🔴 Globule rouge (Décor animé)
- Suit un **chemin vasculaire** prédéfini de 16 points (Path Following, Craig Reynolds).
- N'interagit pas directement avec le gameplay.

### ☣️ Virus prédateur
- Chasse le joueur **et** les alliés avec poursuite prédictive (algorithme **Pursue** + hystérésis anti-oscillation).
- Sélectionne sa cible en tenant compte des **obstacles masquants** sur la ligne de visée.
- Un **contact avec le joueur = défaite immédiate**.
- Un **contact avec un allié** le supprime (santé mise à 0), mais la partie continue.
- Déclenche une **alerte sonore et visuelle** à son approche (< 280 px du joueur).

---

## ⏱️ Calendrier d'apparition des virus

Les virus sont présents dès le début **ET** de nouveaux apparaissent selon ce calendrier :

| Événement | Moment | Avertissement |
|-----------|--------|---------------|
| Virus supplémentaire #1 | 25 s | à 20 s |
| Virus supplémentaire #2 | 60 s (Normal / Difficile) | à 55 s |
| Virus supplémentaire #3 | 100 s (Difficile uniquement) | à 95 s |

Le nombre de virus **initiaux** (dès le lancement) dépend aussi de la difficulté :
- **Facile** : 1 virus initial · max 1
- **Normal** : 2 virus initiaux · max 2
- **Difficile** : 3 virus initiaux · max 3

---

## ⚙️ Paramètres de jeu

### Difficulté

| Paramètre | Facile | Normal | Difficile |
|-----------|--------|--------|-----------|
| Bactéries initiales | 10 | 12 | 14 |
| Dommages de contact | 6 | 8 | 10 |
| Cooldown dommages (ms) | 2 200 | 2 000 | 1 700 |
| Drain d'énergie / s | 0,3 | 0,45 | 0,65 |
| Énergie par nutriment | 35 | 35 | 32 |
| Cooldown attaque joueur (ms) | 1 300 | 1 300 | 1 200 |
| Cooldown attaque alliés (ms) | 4 400 | 4 600 | 4 200 |
| Vitesse bactéries (début → fin) | 0,7 → 0,92 | 0,76 → 1,0 | 0,86 → 1,12 |
| Agressivité bactéries (début → fin) | 0,5 → 0,78 | 0,65 → 1,0 | 0,82 → 1,25 |

### Paramètres joueur (panneau latéral)
- **Vitesse max** : slider de 1 à 10 (défaut : 4).
- **Force max** (réactivité de braquage) : slider de 0,05 à 1 (défaut : 0,25).
- **Nombre d'alliés** : slider de 2 à 4 (défaut : 2).

### Options
- **Son** : activé/désactivé + volume de 0 à 100 % (défaut : 25 %).
- **Effets visuels réduits** : désactive les micro-particules pour les appareils moins puissants.

---

## 🏆 Scoring

| Action | Points |
|--------|--------|
| Bactérie éliminée | +10 |
| Nutriment collecté (joueur) | +1 |
| Objectif secondaire accompli (5 nutriments) | +25 bonus |
| Power-up ramassé | +5 |

---

## 💊 Power-ups

Deux power-ups fixes se trouvent sur l'arène et réapparaissent après 18 secondes :

| Power-up | Effet |
|----------|-------|
| **Bouclier** (hexagone bleu) | Bouclier supplémentaire pendant 7 s |
| **Vitesse** (triangle orange) | Vitesse +35 % pendant 8 s |

---

## 🔬 Mode Pédagogique & Expériences avancées

Accessible via **"Paramètres avancés & Algorithmes"** dans le menu.

### Comportements & Boids
Ajustez en temps réel les poids des forces de flocking appliquées aux **bactéries** :
- **Séparation** (défaut : 2,5) — les bactéries s'écartent mutuellement.
- **Alignement** (défaut : 0,6) — elles s'alignent sur la direction moyenne du voisinage.
- **Cohésion** (défaut : 0,4) — elles se rapprochent du centre du groupe.

### Démonstration Leader Following
Démo indépendante du jeu principal : **1 leader + 3 suiveurs** autonomes se déplacent en formation dans l'arène. Le leader erre librement (Wander) en évitant les obstacles ; les suiveurs maintiennent leur position derrière lui.

Paramètres ajustables :
- Distance au leader (défaut : 70 px)
- Poids Arrive (défaut : 1,0)
- Poids Séparation (défaut : 3,0)
- Poids Évitement (défaut : 3,0)

### Génétique bactérienne (ADN & Sélection)
Active une **simulation évolutionnaire séparée** dans l'arène (population isolée) :
- Chaque bactérie porte un ADN à 6 gènes : `maxSpeed`, `perceptionRadius`, `nutrientAttraction`, `toxinRepulsion`, `playerFlee`, `aggression`.
- À chaque **génération** (16 secondes), les plus adaptées se reproduisent par **croisement + mutation** (taux de mutation : 20 %).
- Fitness = temps de vie + ressources collectées (×8) + descendants (×12) − contacts toxines (×3).
- Sélection par **tournoi** (3 candidats).
- Population : min 4, max 12, initiale 8.
- Affiche : génération, population vivante, meilleure fitness, gènes de la meilleure bactérie.

### Réseau neuronal — SuperVirus (Neuro-Évolution)

Le SuperVirus pédagogique est guidé par un **réseau neuronal entièrement codé à la main** (sans TensorFlow.js) :

```
Entrées (26)                       Couche cachée (12)    Sorties (3)
──────────────────────────         ──────────────        ──────────────────────────
5 angles × obstacle distance       12 neurones           0 : Braquage angulaire (tanh)
5 angles × distance globules       activation tanh       1 : Propulsion (sigmoid)
5 angles × distance nutriments                           2 : Attraction cible (sigmoid)
vitesse locale vx, vy
position normalisée x, y
vecteur cible (dx, dy, proximité)
4 proximités de paroi
```

**Paramètres d'évolution :**
- Taux de mutation : **8 %** (`MUTATION_RATE = 0.08`)
- Perturbation gaussienne : σ = 0,18
- Population : min 4, max 10, initiale 8
- Durée d'une génération : **18 secondes**
- Élitisme : **1 individu** conservé intact par génération
- Sélection : tournoi parmi les 65 % meilleurs

**Fitness** = âge + distance parcourue × 0,025 + proximité cible × 0,35 + contacts cible × 12.

> ⚠️ Toute modification du nombre de couches, d'entrées ou de neurones nécessite une réinitialisation complète de la population via le bouton dédié.

### Débogage visuel
Affichez en superposition (cases à cocher) :
- Vecteurs de force des véhicules (`Vehicle.debug`)
- Couloir de Path Following du globule rouge
- Voisins Boids détectés par les bactéries
- Vecteurs Séparation / Alignement / Cohésion individuels
- Pondérations actives des forces de flocking
- Repères Leader Following (zones frontales, vecteurs)
- Capteurs rayons et sorties du SuperVirus (meilleur individu uniquement)

---

## 🛠️ Technologies utilisées

- **[p5.js](https://p5js.org/) v1.9** — moteur graphique 2D et boucle de jeu (60 FPS, simulation à pas fixe 1000/60 ms)
- **[TensorFlow.js](https://www.tensorflow.org/js) v4.20** — chargé mais **non utilisé** par le jeu actuel (conservé pour compatibilité avec d'anciens fichiers)
- **Web Audio API** — sons génératifs procéduraux (oscillateurs, rampes de fréquence)
- **HTML5 / CSS3 / Vanilla JS** — interface et panneau de paramètres

---

## 📋 Notes techniques

- Le jeu est entièrement **client-side** : aucun serveur requis.
- Compatible claviers **AZERTY** (ZQSD) et **QWERTY** (WASD).
- La simulation tourne à **pas fixe** (≈16,67 ms) avec accumulateur pour découpler rendu et physique.
- Le canvas est **responsive** : les entités sont repositionnées proportionnellement lors du redimensionnement de la fenêtre.
- Le réseau neuronal du SuperVirus est une **implémentation manuelle** (tableaux JavaScript) sans dépendance à TensorFlow.
