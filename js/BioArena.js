/**
 * BioArena.js — Couche de rendu biologique d'arrière-plan haute fidélité
 * Projet CŒUR OUVERT
 *
 * RÈGLE ABSOLUE :
 * Purement décoratif et cosmétique.
 * Aucun impact sur la simulation, les collisions, la physique, les vitesses,
 * les forces, les trajectoires ou les algorithmes de steering Reynolds / Boids.
 *
 * Architecture :
 *  - staticLayer : p5.Graphics mis en cache (tissus, matrice interstitielle,
 *    grandes artères, veines, capillaires ramifiés, cellules secondaires).
 *  - updateAndDraw : animation procédurale 60fps (pulsations vasculaires,
 *    globules rouges biconcaves circulants, particules de plasma/lymphe/plaquettes).
 */

var _bio = (function () {
    'use strict';

    let staticLayer = null;

    // Définitions des grands vaisseaux ramifiés (coordonnées normalisées 0.0 - 1.0)
    // Format : [x0, y0, cx1, cy1, cx2, cy2, x1, y1] + épaisseurs & teintes
    const VESSEL_DEFS = [
        // 1. Grande artère gauche descendante (aorte / artère principale)
        { pts: [0.00, 0.08, 0.14, 0.22, 0.11, 0.54, 0.00, 0.72], ew: 58, iw: 28, br: 140, type: 'artery' },
        // 2. Branche artérielle supérieure vers le centre
        { pts: [0.10, 0.38, 0.22, 0.36, 0.32, 0.31, 0.46, 0.30], ew: 42, iw: 20, br: 130, type: 'artery' },
        // 3. Ramification artériole vers le quadrant supérieur
        { pts: [0.11, 0.24, 0.18, 0.14, 0.28, 0.09, 0.40, 0.06], ew: 28, iw: 13, br: 120, type: 'arteriole' },
        // 4. Vaisseau traversant inférieur (arcade vasculaire basale)
        { pts: [0.00, 0.86, 0.24, 0.76, 0.54, 0.78, 0.82, 0.94], ew: 48, iw: 24, br: 135, type: 'artery' },
        // 5. Veine cave / tronc veineux droit descendant
        { pts: [1.00, 0.04, 0.86, 0.18, 0.88, 0.46, 1.00, 0.62], ew: 54, iw: 26, br: 110, type: 'vein' },
        // 6. Branche veineuse droite vers le centre inférieur
        { pts: [0.90, 0.36, 0.78, 0.45, 0.64, 0.52, 0.50, 0.50], ew: 36, iw: 17, br: 105, type: 'vein' },
        // 7. Capillaire sinueux supérieur droit
        { pts: [0.70, 0.00, 0.74, 0.12, 0.78, 0.22, 0.86, 0.28], ew: 22, iw: 10, br: 115, type: 'arteriole' },
        // 8. Branche capillaire inférieure médiane
        { pts: [0.34, 1.00, 0.40, 0.86, 0.58, 0.84, 0.68, 1.00], ew: 24, iw: 11, br: 118, type: 'artery' },
        // 9. Pont anastomotique central
        { pts: [0.28, 0.54, 0.36, 0.60, 0.44, 0.62, 0.52, 0.68], ew: 20, iw: 9, br: 112, type: 'capillary' },
        // 10. Capillaire apical supérieur médian
        { pts: [0.46, 0.00, 0.48, 0.09, 0.53, 0.14, 0.60, 0.20], ew: 18, iw: 8, br: 114, type: 'capillary' },
        // 11. Ramification profonde quadrant droit
        { pts: [0.64, 0.52, 0.72, 0.58, 0.80, 0.68, 0.78, 0.82], ew: 22, iw: 10, br: 108, type: 'vein' },
        // 12. Arcade capillaire gauche médiane
        { pts: [0.22, 0.36, 0.26, 0.44, 0.28, 0.54, 0.28, 0.64], ew: 18, iw: 8, br: 115, type: 'capillary' }
    ];

    // Capillaires fins et réseaux de microcirculation
    const CAPILLARY_DEFS = [
        { pts: [0.14, 0.64, 0.20, 0.66, 0.26, 0.62, 0.32, 0.58], type: 'art' },
        { pts: [0.58, 0.22, 0.64, 0.28, 0.68, 0.34, 0.66, 0.42], type: 'ven' },
        { pts: [0.84, 0.58, 0.80, 0.66, 0.76, 0.72, 0.72, 0.78], type: 'ven' },
        { pts: [0.38, 0.78, 0.44, 0.72, 0.48, 0.76, 0.54, 0.82], type: 'art' },
        { pts: [0.18, 0.16, 0.22, 0.21, 0.28, 0.23, 0.34, 0.19], type: 'art' },
        { pts: [0.54, 0.40, 0.58, 0.46, 0.56, 0.54, 0.50, 0.58], type: 'art' },
        { pts: [0.72, 0.30, 0.76, 0.36, 0.74, 0.44, 0.68, 0.48], type: 'ven' },
        { pts: [0.32, 0.82, 0.28, 0.88, 0.24, 0.92, 0.18, 0.94], type: 'art' }
    ];

    // Cellules secondaires du tissu interstitiel (non-bloquantes, purement décoratives)
    const SECONDARY_CELLS = [
        { nx: 0.12, ny: 0.76, r: 26, type: 'epithelial' },
        { nx: 0.26, ny: 0.18, r: 22, type: 'fibroblast' },
        { nx: 0.68, ny: 0.15, r: 28, type: 'epithelial' },
        { nx: 0.84, ny: 0.72, r: 24, type: 'fibroblast' },
        { nx: 0.16, ny: 0.46, r: 17, type: 'mast' },
        { nx: 0.62, ny: 0.84, r: 19, type: 'mast' },
        { nx: 0.74, ny: 0.42, r: 23, type: 'epithelial' },
        { nx: 0.42, ny: 0.13, r: 16, type: 'fibroblast' },
        { nx: 0.89, ny: 0.13, r: 15, type: 'mast' },
        { nx: 0.07, ny: 0.28, r: 16, type: 'epithelial' },
        { nx: 0.52, ny: 0.92, r: 18, type: 'fibroblast' },
        { nx: 0.32, ny: 0.89, r: 14, type: 'mast' },
        { nx: 0.86, ny: 0.32, r: 18, type: 'macrophage' },
        { nx: 0.38, ny: 0.38, r: 14, type: 'macrophage' },
        { nx: 0.60, ny: 0.62, r: 16, type: 'epithelial' }
    ];

    // Éléments animés en mémoire
    let decorativeRBCs = [];
    let plasmaParticles = [];
    let _t = 0;

    // ─────────────────────────────────────────────────────────────
    // Rendu statique (précalculé une seule fois dans staticLayer)
    // ─────────────────────────────────────────────────────────────

    function _drawDeepBackground(g, W, H) {
        // Fond de base : champ histologique profond (rouge bordeaux/nuit)
        g.background(8, 3, 10);

        // Dégradé radial volumétrique simulant la cavité interne d'un organe vivant
        const cx = W * 0.5;
        const cy = H * 0.5;
        const maxDim = Math.max(W, H);
        g.noStroke();

        const steps = 9;
        for (let i = steps; i >= 0; i--) {
            const frac = i / steps;
            const r = maxDim * (0.28 + frac * 0.85);
            // Cœur plus chaud, périphérie plus sombre
            const red = Math.floor(34 + (1 - frac) * 26);
            const green = Math.floor(6 + (1 - frac) * 8);
            const blue = Math.floor(18 + (1 - frac) * 16);
            const alpha = 24 * (1 - frac);
            g.fill(red, green, blue, alpha);
            g.circle(cx, cy, r * 2);
        }

        // Vignette douce sur les 4 bordures
        for (let i = 0; i < 6; i++) {
            const t = i / 5;
            g.fill(4, 1, 6, 28 * (1 - t));
            const pad = i * 55;
            g.rect(0, 0, W, pad);
            g.rect(0, H - pad, W, pad);
            g.rect(0, 0, pad, H);
            g.rect(W - pad, 0, pad, H);
        }
    }

    function _drawInterstitialMatrix(g, W, H) {
        // Matrice extracellulaire de cellules conjonctives polygonales translucides
        const gridW = 105;
        const gridH = 90;
        for (let row = -1; row < Math.ceil(H / gridH) + 1; row++) {
            for (let col = -1; col < Math.ceil(W / gridW) + 1; col++) {
                const bx = col * gridW + (row % 2 === 0 ? 0 : gridW * 0.5);
                const by = row * gridH;
                const ox = Math.sin(col * 0.72 + row * 0.44) * 20;
                const oy = Math.cos(col * 0.51 - row * 0.63) * 16;
                const cx = bx + ox;
                const cy = by + oy;
                const rx = 32 + 9 * Math.sin(col * 0.88 + row * 1.12);
                const ry = rx * (0.76 + 0.14 * Math.cos(col * 1.25));

                // Membrane cellulaire translucide
                g.noFill();
                g.stroke(145, 24, 62, 14);
                g.strokeWeight(1.2);
                g.ellipse(cx, cy, rx * 2, ry * 2);

                // Halo cytoplasmique discret
                g.noStroke();
                g.fill(85, 14, 38, 7);
                g.ellipse(cx, cy, rx * 1.6, ry * 1.6);

                // Noyau profond chromatinique
                const nx = cx + rx * 0.16;
                const ny = cy + ry * 0.12;
                g.stroke(120, 22, 58, 12);
                g.strokeWeight(0.9);
                g.ellipse(nx, ny, rx * 0.75, ry * 0.6);

                // Nucléole
                g.noStroke();
                g.fill(160, 35, 75, 10);
                g.circle(nx - rx * 0.04, ny, rx * 0.24);
            }
        }
    }

    function _drawFiberNetwork(g, W, H) {
        // Faisceaux de fibres de collagène (crème-ivoire) et élastine (cyan-émeraude)
        const fiberCount = 48;
        g.noFill();

        // 1. Collagène : ondulations douces
        for (let i = 0; i < fiberCount; i++) {
            const seed = i * 142.31;
            const x1 = (seed * 11.7) % W;
            const y1 = (seed * 7.3) % H;
            const angle = Math.sin(i * 0.38) * Math.PI;
            const len = 70 + 90 * Math.abs(Math.sin(i * 0.72));
            const x2 = x1 + Math.cos(angle) * len;
            const y2 = y1 + Math.sin(angle) * len;
            const midX = (x1 + x2) * 0.5 + Math.sin(i * 1.25) * 22;
            const midY = (y1 + y2) * 0.5 + Math.cos(i * 1.15) * 22;

            g.stroke(215, 175, 140, 11);
            g.strokeWeight(0.7 + (i % 3) * 0.45);
            g.beginShape();
            g.vertex(x1, y1);
            g.quadraticVertex(midX, midY, x2, y2);
            g.endShape();
        }

        // 2. Élastine : filaments sinueux extensibles (vert d'eau / cyan)
        for (let i = 0; i < 26; i++) {
            const seed = i * 97.4 + 480;
            const x1 = (seed * 12.9) % W;
            const y1 = (seed * 8.1) % H;
            const x2 = x1 + Math.sin(i * 1.7) * 210;
            const y2 = y1 + Math.cos(i * 1.3) * 170;
            const cx1 = x1 + (x2 - x1) * 0.33 + Math.sin(i * 2.2) * 42;
            const cy1 = y1 + (y2 - y1) * 0.33 + Math.cos(i * 1.8) * 42;
            const cx2 = x1 + (x2 - x1) * 0.66 - Math.sin(i * 1.6) * 36;
            const cy2 = y1 + (y2 - y1) * 0.66 - Math.cos(i * 2.1) * 36;

            g.stroke(35, 190, 205, 10);
            g.strokeWeight(0.6 + (i % 4) * 0.35);
            g.beginShape();
            g.vertex(x1, y1);
            g.bezierVertex(cx1, cy1, cx2, cy2, x2, y2);
            g.endShape();
        }
    }

    function _bezierPoint4(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
    }


    // ─────────────────────────────────────────────────────────────
    // Grandes structures organiques et masses tissulaires imposantes
    // (Décor pur : 100% traversable, aucun obstacle physique)
    // ─────────────────────────────────────────────────────────────

    function _drawOrganLobe(g, cx, cy, baseR, lobes, seed, colorFill, colorStroke) {
        g.push();
        g.translate(cx, cy);

        // 1. Ombre portée diffuse 3D
        g.noStroke();
        g.fill(2, 0, 5, 85);
        g.beginShape();
        for (let i = 0; i < lobes; i++) {
            const angle = (Math.PI * 2 * i) / lobes;
            const variance = 1.0 + 0.22 * Math.sin(angle * 2.8 + seed) + 0.12 * Math.cos(angle * 4.2 + seed * 1.3);
            const r = baseR * variance + 14;
            g.vertex(Math.cos(angle) * r + 12, Math.sin(angle) * r + 16);
        }
        g.endShape(g.CLOSE);

        // 2. Paroi adventitielle externe
        g.stroke(colorStroke[0], colorStroke[1], colorStroke[2], colorStroke[3] || 180);
        g.strokeWeight(3.5);
        g.fill(colorFill[0], colorFill[1], colorFill[2], colorFill[3] || 220);
        g.beginShape();
        for (let i = 0; i < lobes; i++) {
            const angle = (Math.PI * 2 * i) / lobes;
            const variance = 1.0 + 0.22 * Math.sin(angle * 2.8 + seed) + 0.12 * Math.cos(angle * 4.2 + seed * 1.3);
            const r = baseR * variance;
            g.vertex(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        g.endShape(g.CLOSE);

        // 3. Strate intermédiaire (parenchyme musculaire profond)
        g.noStroke();
        g.fill(colorFill[0] + 25, colorFill[1] + 8, colorFill[2] + 16, 175);
        g.beginShape();
        for (let i = 0; i < lobes; i++) {
            const angle = (Math.PI * 2 * i) / lobes;
            const variance = 0.76 + 0.16 * Math.sin(angle * 2.8 + seed);
            const r = baseR * variance;
            g.vertex(Math.cos(angle) * r - 4, Math.sin(angle) * r - 4);
        }
        g.endShape(g.CLOSE);

        // 4. Inclusions de noyaux cellulaires denses et micro-vésicules
        const numNuclei = 6;
        for (let n = 0; n < numNuclei; n++) {
            const na = (n / numNuclei) * Math.PI * 2 + seed * 0.4;
            const ndist = baseR * (0.35 + 0.25 * Math.sin(n * 1.7 + seed));
            const nx = Math.cos(na) * ndist;
            const ny = Math.sin(na) * ndist;
            const nr = baseR * (0.12 + 0.08 * Math.cos(n * 2.1));

            g.fill(130, 20, 60, 110);
            g.ellipse(nx, ny, nr * 2.2, nr * 1.7);
            g.fill(180, 40, 90, 85);
            g.circle(nx - nr * 0.2, ny - nr * 0.15, nr * 0.7);
        }

        // 5. Reflets spéculaires humides le long des crêtes
        g.noFill();
        g.stroke(255, 185, 215, 38);
        g.strokeWeight(4.5);
        g.beginShape();
        for (let i = 0; i < Math.floor(lobes * 0.45); i++) {
            const angle = (Math.PI * 2 * i) / lobes - 0.8;
            const variance = 0.95 + 0.2 * Math.sin(angle * 2.8 + seed);
            const r = baseR * variance;
            g.vertex(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        g.endShape();

        g.pop();
    }

    function _drawLargeOrganicStructures(g, W, H) {
        // Échelle responsive adaptative
        const baseScale = Math.min(W, H) / 780;

        // 1. Grand Massif Pariétal Supérieur Gauche (Éperon musculaire géant)
        _drawOrganLobe(g, W * 0.08, H * 0.08, 160 * baseScale, 18, 1.4, [48, 8, 26, 235], [95, 14, 46, 210]);
        _drawOrganLobe(g, W * 0.18, H * 0.04, 130 * baseScale, 16, 2.7, [58, 10, 32, 230], [115, 18, 55, 200]);
        _drawOrganLobe(g, W * 0.04, H * 0.22, 140 * baseScale, 16, 3.9, [44, 7, 24, 235], [88, 12, 42, 210]);

        // 2. Colossal Amas Cellulaire Inférieur Droit (Massif hypertrophique)
        _drawOrganLobe(g, W * 0.94, H * 0.92, 190 * baseScale, 20, 5.2, [42, 12, 38, 240], [105, 24, 72, 210]);
        _drawOrganLobe(g, W * 0.84, H * 0.96, 145 * baseScale, 16, 6.5, [54, 15, 48, 235], [120, 28, 85, 200]);
        _drawOrganLobe(g, W * 0.96, H * 0.78, 150 * baseScale, 18, 7.8, [48, 14, 42, 235], [110, 26, 78, 205]);

        // 3. Crête Tissulaire Supérieure Droite (Barrière endothéliale)
        _drawOrganLobe(g, W * 0.88, H * 0.06, 145 * baseScale, 16, 9.1, [52, 10, 30, 230], [115, 20, 58, 200]);
        _drawOrganLobe(g, W * 0.98, H * 0.18, 135 * baseScale, 16, 10.4, [46, 9, 26, 235], [98, 16, 48, 210]);

        // 4. Massif Folliculaire Inférieur Gauche (Agrégat lymphoïde géant)
        _drawOrganLobe(g, W * 0.06, H * 0.94, 165 * baseScale, 18, 12.3, [40, 10, 32, 235], [92, 18, 62, 210]);
        _drawOrganLobe(g, W * 0.18, H * 0.96, 125 * baseScale, 16, 13.6, [50, 12, 38, 230], [108, 22, 75, 200]);

        // 5. Ponts Tissulaires & Piliers Médian Latéraux (Berges vasculaires)
        _drawOrganLobe(g, -20, H * 0.52, 110 * baseScale, 14, 15.2, [48, 8, 26, 230], [100, 15, 48, 200]);
        _drawOrganLobe(g, W + 20, H * 0.46, 115 * baseScale, 14, 16.7, [44, 12, 36, 230], [96, 20, 68, 200]);

        // 6. Nodule Interne Apical Médian (Relief tissulaire supérieur)
        _drawOrganLobe(g, W * 0.50, -30, 120 * baseScale, 16, 18.1, [55, 12, 34, 230], [118, 22, 60, 205]);
    }

    function _drawVessels(g, W, H) {
        // Dessin multicouche des parois vasculaires anatomiques :
        // 1. Ombre portée adventitielle (profondeur)
        // 2. Tunica adventitia (gaine fibreuse externe bordeaux)
        // 3. Tunica media (muscle lisse circulaire)
        // 4. Endothélium & Lumen (hémoglobine luminescente)
        // 5. Reflet spéculaire humide (lustre de surface)
        g.noFill();

        for (const v of VESSEL_DEFS) {
            const [nx0, ny0, ncx1, ncy1, ncx2, ncy2, nx1, ny1] = v.pts;
            const x0 = nx0 * W, y0 = ny0 * H;
            const cx1 = ncx1 * W, cy1 = ncy1 * H;
            const cx2 = ncx2 * W, cy2 = ncy2 * H;
            const x1 = nx1 * W, y1 = ny1 * H;

            const isVein = v.type === 'vein';

            // 1. Ombre portée biologique profonde
            g.stroke(2, 1, 4, 45);
            g.strokeWeight(v.ew + 18);
            g.bezier(x0, y0, cx1, cy1, cx2, cy2, x1, y1);

            // 2. Tunica adventitia (tissu conjonctif d'ancrage)
            if (isVein) {
                g.stroke(35, 18, 55, 60);
            } else {
                g.stroke(95, 12, 38, 65);
            }
            g.strokeWeight(v.ew);
            g.bezier(x0, y0, cx1, cy1, cx2, cy2, x1, y1);

            // 3. Tunica media (fibres musculaires lisses)
            if (isVein) {
                g.stroke(50, 28, 80, 50);
            } else {
                g.stroke(145, 24, 56, 52);
            }
            g.strokeWeight(v.ew * 0.74);
            g.bezier(x0, y0, cx1, cy1, cx2, cy2, x1, y1);

            // 4. Lumen vasculaire (canal conducteur saturé de sang)
            if (isVein) {
                g.stroke(75, 25, 95, 70);
            } else {
                g.stroke(195, 34, 68, 70);
            }
            g.strokeWeight(v.iw);
            g.bezier(x0, y0, cx1, cy1, cx2, cy2, x1, y1);

            // 5. Reflet spéculaire longitudinal (surface endothéliale humide)
            g.stroke(245, 120, 155, 26);
            g.strokeWeight(v.iw * 0.34);
            g.bezier(x0, y0, cx1, cy1, cx2, cy2, x1, y1);

            // 6. Halo bioluminescent externe subtil
            if (isVein) {
                g.stroke(60, 40, 130, 16);
            } else {
                g.stroke(v.br, 25, 60, 18);
            }
            g.strokeWeight(v.ew * 1.38);
            g.bezier(x0, y0, cx1, cy1, cx2, cy2, x1, y1);
        }
    }

    function _drawCapillaries(g, W, H) {
        g.noFill();
        for (const c of CAPILLARY_DEFS) {
            const [nx0, ny0, ncx1, ncy1, ncx2, ncy2, nx1, ny1] = c.pts;
            const x0 = nx0 * W, y0 = ny0 * H;
            const cx1 = ncx1 * W, cy1 = ncy1 * H;
            const cx2 = ncx2 * W, cy2 = ncy2 * H;
            const x1 = nx1 * W, y1 = ny1 * H;

            const isVenous = c.type === 'ven';

            // Gaine endothéliale capillaire
            if (isVenous) {
                g.stroke(40, 60, 110, 42);
            } else {
                g.stroke(115, 20, 50, 46);
            }
            g.strokeWeight(9);
            g.bezier(x0, y0, cx1, cy1, cx2, cy2, x1, y1);

            // Lumen capillaire
            if (isVenous) {
                g.stroke(55, 95, 160, 38);
            } else {
                g.stroke(180, 36, 68, 38);
            }
            g.strokeWeight(4);
            g.bezier(x0, y0, cx1, cy1, cx2, cy2, x1, y1);
        }
    }

    function _drawSecondaryCell(g, x, y, r, type) {
        g.noStroke();
        if (type === 'epithelial') {
            // Cellule épithéliale : forme pavimenteuse arrondie, cytoplasme translucide
            g.fill(185, 45, 90, 16);
            g.ellipse(x, y, r * 2.3, r * 1.9);
            g.fill(210, 65, 105, 12);
            g.ellipse(x, y, r * 1.6, r * 1.35);

            // Noyau ovalaire
            g.fill(125, 28, 68, 22);
            g.ellipse(x + r * 0.1, y - r * 0.08, r * 0.85, r * 0.7);
            // Nucléole
            g.fill(175, 48, 95, 20);
            g.circle(x + r * 0.05, y - r * 0.06, r * 0.32);

            // Membrane
            g.noFill();
            g.stroke(215, 80, 120, 26);
            g.strokeWeight(1.0);
            g.ellipse(x, y, r * 2.3, r * 1.9);

        } else if (type === 'fibroblast') {
            // Fibroblaste : cellule fusiforme allongée avec extensions dendritiques
            const angle = Math.atan2(y - 0.5, x - 0.5) * 0.6;
            g.push();
            g.translate(x, y);
            g.rotate(angle);
            g.fill(75, 30, 115, 18);
            g.ellipse(0, 0, r * 3.0, r * 1.05);
            g.fill(100, 45, 145, 14);
            g.ellipse(0, 0, r * 1.9, r * 0.7);

            // Membrane
            g.noFill();
            g.stroke(115, 60, 170, 24);
            g.strokeWeight(0.9);
            g.ellipse(0, 0, r * 3.0, r * 1.05);
            g.pop();

        } else if (type === 'mast') {
            // Mastocyte : cellule arrondie riche en grains d'histamine
            g.fill(65, 22, 90, 20);
            g.circle(x, y, r * 2.05);
            const granuleCount = 7;
            for (let i = 0; i < granuleCount; i++) {
                const ga = (i / granuleCount) * Math.PI * 2 + 0.35;
                const gr = r * 0.52;
                g.fill(125, 42, 165, 26);
                g.circle(x + Math.cos(ga) * gr, y + Math.sin(ga) * gr, r * 0.3);
            }
            g.noFill();
            g.stroke(140, 55, 185, 24);
            g.strokeWeight(0.9);
            g.circle(x, y, r * 2.05);

        } else if (type === 'macrophage') {
            // Macrophage tissulaire résident : forme amiboïde avec pseudopodes
            g.fill(90, 28, 55, 18);
            g.ellipse(x, y, r * 2.4, r * 1.8);
            g.fill(120, 36, 75, 15);
            g.circle(x - r * 0.2, y + r * 0.1, r * 0.9);
            g.noFill();
            g.stroke(150, 48, 88, 22);
            g.strokeWeight(0.8);
            g.ellipse(x, y, r * 2.4, r * 1.8);
        }
    }

    function _drawSecondaryCells(g, W, H) {
        for (const sc of SECONDARY_CELLS) {
            _drawSecondaryCell(g, sc.nx * W, sc.ny * H, sc.r, sc.type);
        }
    }

    function _drawCapillaryNodes(g, W, H) {
        // Carrefours et nœuds de microvascularisation (anastomoses)
        const nodes = [
            { nx: 0.10, ny: 0.38 }, { nx: 0.46, ny: 0.30 }, { nx: 0.40, ny: 0.06 },
            { nx: 0.50, ny: 0.50 }, { nx: 0.86, ny: 0.28 }, { nx: 0.90, ny: 0.36 },
            { nx: 0.28, ny: 0.54 }, { nx: 0.52, ny: 0.68 }
        ];
        g.noStroke();
        for (const n of nodes) {
            const x = n.nx * W;
            const y = n.ny * H;
            g.fill(120, 20, 52, 32);
            g.circle(x, y, 26);
            g.fill(160, 34, 70, 24);
            g.circle(x, y, 16);
            g.fill(210, 60, 95, 14);
            g.circle(x, y, 8);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Éléments animés : circulation sanguine & particules
    // ─────────────────────────────────────────────────────────────

    function _sampleVesselPoint(vIdx, t) {
        const v = VESSEL_DEFS[vIdx % VESSEL_DEFS.length];
        const [nx0, ny0, ncx1, ncy1, ncx2, ncy2, nx1, ny1] = v.pts;
        const x = _bezierPoint4(nx0, ncx1, ncx2, nx1, t);
        const y = _bezierPoint4(ny0, ncy1, ncy2, ny1, t);
        return { x, y, iw: v.iw, type: v.type };
    }

    function _initDecorativeRBCs(W, H) {
        decorativeRBCs = [];
        // Globules rouges décoratifs répartis dans les grands axes vasculaires
        const activeVessels = [0, 1, 3, 4, 5, 7, 8];
        for (let i = 0; i < 34; i++) {
            const vIdx = activeVessels[i % activeVessels.length];
            const t0 = (i * 0.113 + (i % 7) * 0.07) % 1.0;
            const speed = 0.00055 + (i % 6) * 0.00012;
            decorativeRBCs.push({
                vIdx,
                t: t0,
                speed,
                wobble: (i % 5) * 0.2,
                wobbleAmp: (VESSEL_DEFS[vIdx].iw * 0.24) / Math.max(W, H),
                scale: 0.42 + (i % 4) * 0.14
            });
        }
    }

    function _initPlasmaParticles(W, H) {
        plasmaParticles = [];
        // Particules légères de plasma, plaquettes et lymphe
        for (let i = 0; i < 50; i++) {
            plasmaParticles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.16,
                vy: -0.07 - Math.random() * 0.2,
                radius: 1.0 + Math.random() * 2.2,
                phase: Math.random() * Math.PI * 2,
                type: i % 4 === 0 ? 'lymph' : (i % 5 === 0 ? 'platelet' : 'plasma')
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // API publique
    // ─────────────────────────────────────────────────────────────

    return {

        /**
         * Reconstruit la texture statique d'arrière-plan (taille d'écran).
         * À appeler depuis createBioBackground() dans main.js.
         */
        build: function (W, H) {
            if (staticLayer) {
                staticLayer.remove();
            }
            staticLayer = createGraphics(W, H);
            staticLayer.pixelDensity(1);

            _drawDeepBackground(staticLayer, W, H);
            _drawInterstitialMatrix(staticLayer, W, H);
            _drawLargeOrganicStructures(staticLayer, W, H);
            _drawFiberNetwork(staticLayer, W, H);
            _drawVessels(staticLayer, W, H);
            _drawCapillaries(staticLayer, W, H);
            _drawCapillaryNodes(staticLayer, W, H);
            // Suppression des fausses cellules secondaires décoratives non-bloquantes :
            // Tous les obstacles visibles sont désormais de véritables entités Vehicle tangibles.

            _initDecorativeRBCs(W, H);
            _initPlasmaParticles(W, H);
            _t = 0;
        },

        /**
         * Dessine la texture statique d'arrière-plan sur le canvas principal.
         * Appelé tout au début de draw(), derrière toutes les entités de jeu.
         */
        drawStatic: function () {
            if (staticLayer) {
                image(staticLayer, 0, 0, width, height);
            } else {
                background(8, 3, 10);
            }
        },

        /**
         * Dessine la couche animée (pulsations, globules rouges circulants, particules).
         * Purement cosmétique — aucun obstacle ni collision.
         */
        updateAndDraw: function (elapsedMs, tTotal, effectsEnabled) {
            if (!effectsEnabled) return;

            _t = tTotal;
            const dt = Math.max(0, elapsedMs) / 16.666;
            const W = width;
            const H = height;
            const t01 = _t * 0.001;

            // 1. Pulsations vasculaires animées (onde systolique douce)
            noFill();
            const pulseIntensity = 0.5 + 0.5 * Math.sin(t01 * 2.8); // Rythme cardiaque doux
            for (let vi = 0; vi < Math.min(4, VESSEL_DEFS.length); vi++) {
                const v = VESSEL_DEFS[vi];
                const [nx0, ny0, ncx1, ncy1, ncx2, ncy2, nx1, ny1] = v.pts;
                const wave = Math.sin(t01 * 3.2 - vi * 0.6);
                const isVein = v.type === 'vein';

                if (isVein) {
                    stroke(65, 30, 110, 8 + 6 * wave);
                } else {
                    stroke(210, 45, 80, 8 + 8 * wave);
                }
                strokeWeight(v.iw * 0.22 + 1.2 * wave);
                bezier(
                    nx0 * W, ny0 * H, ncx1 * W, ncy1 * H,
                    ncx2 * W, ncy2 * H, nx1 * W, ny1 * H
                );
            }

            // 2. Globules rouges décoratifs circulants (forme biconcave reconnaissable)
            noStroke();
            for (const rbc of decorativeRBCs) {
                rbc.t += rbc.speed * dt;
                if (rbc.t > 1.0) rbc.t -= 1.0;

                const pt = _sampleVesselPoint(rbc.vIdx, rbc.t);
                const cx = pt.x * W;
                const cy = pt.y * H;

                // Légère oscillation axiale le long du lumen
                const wobbleX = Math.sin(_t * 0.0022 + rbc.wobble * 3.14) * pt.iw * 0.22;
                const wobbleY = Math.cos(_t * 0.0019 + rbc.wobble * 2.7) * pt.iw * 0.15;

                const scalePixels = pt.iw * 0.62 * rbc.scale;
                const rx = scalePixels * 1.42;
                const ry = scalePixels * 0.88;

                // Orientation selon la tangente du vaisseau
                const tNext = Math.min(rbc.t + 0.02, 0.99);
                const ptN = _sampleVesselPoint(rbc.vIdx, tNext);
                const angle = Math.atan2(ptN.y - pt.y, ptN.x - pt.x);

                const isVenous = pt.type === 'vein';
                const alpha = constrain(50 * rbc.scale + 10 * Math.sin(t01 + rbc.wobble), 20, 70);

                push();
                translate(cx + wobbleX, cy + wobbleY);
                rotate(angle);

                // Bourrelet périphérique biconcave (anneau externe épais)
                if (isVenous) {
                    fill(120, 24, 70, alpha);
                } else {
                    fill(195, 38, 70, alpha);
                }
                ellipse(0, 0, rx * 2, ry * 2);

                // Dépression centrale biconcave caractéristique (dimple)
                if (isVenous) {
                    fill(65, 12, 40, alpha * 0.88);
                } else {
                    fill(105, 14, 32, alpha * 0.88);
                }
                ellipse(0, 0, rx * 0.76, ry * 0.58);

                // Reflet spéculaire doux sur le rebord supérieur
                fill(245, 110, 130, alpha * 0.42);
                ellipse(-rx * 0.18, -ry * 0.22, rx * 0.5, ry * 0.32);

                pop();
            }

            // 3. Particules de plasma, lymphe et plaquettes
            noStroke();
            for (const p of plasmaParticles) {
                p.x += p.vx * dt + Math.sin(t01 * 1.15 + p.phase) * 0.08 * dt;
                p.y += p.vy * dt;

                if (p.y < -6) {
                    p.y = H + 6;
                    p.x = Math.random() * W;
                }
                if (p.x < -6) p.x = W + 6;
                if (p.x > W + 6) p.x = -6;

                const pAlpha = 18 + 8 * Math.sin(t01 * 1.4 + p.phase);

                if (p.type === 'lymph') {
                    // Gouttelette lymphatique vert d'eau
                    fill(110, 235, 215, pAlpha);
                    circle(p.x, p.y, p.radius * 2.2);
                } else if (p.type === 'platelet') {
                    // Plaquette discoïde ambrée
                    fill(245, 190, 85, pAlpha * 0.85);
                    push();
                    translate(p.x, p.y);
                    rotate(t01 * 0.45 + p.phase);
                    ellipse(0, 0, p.radius * 3.2, p.radius * 1.4);
                    pop();
                } else {
                    // Micromolécule de plasma rose diffus
                    fill(240, 85, 125, pAlpha * 0.6);
                    circle(p.x, p.y, p.radius * 1.9);
                }
            }

            // 4. Bioluminescence capillaire douce
            for (let ci = 0; ci < Math.min(3, CAPILLARY_DEFS.length); ci++) {
                const c = CAPILLARY_DEFS[ci];
                const [nx0, ny0, ncx1, ncy1, ncx2, ncy2, nx1, ny1] = c.pts;
                const pulse = Math.abs(Math.sin(t01 * 0.75 + ci * 0.95));
                noFill();
                stroke(40, 150, 210, 6 * pulse);
                strokeWeight(12 * pulse);
                bezier(
                    nx0 * W, ny0 * H, ncx1 * W, ncy1 * H,
                    ncx2 * W, ncy2 * H, nx1 * W, ny1 * H
                );
            }
        },

        /** Libère la mémoire */
        dispose: function () {
            if (staticLayer) {
                staticLayer.remove();
                staticLayer = null;
            }
            decorativeRBCs = [];
            plasmaParticles = [];
        },

        getVesselDefs: function () {
            return VESSEL_DEFS;
        },

        /**
         * Dessine le mini-radar biologique tactique en bas à gauche de l'écran.
         * Purement consultatif (lecture seule des coordonnées existantes).
         */
        drawMiniRadar: function (W, H, obstaclesList, bacteriaList, alliesList, virusEntity, playerEntity) {
            const rw = 145;
            const rh = 100;
            const rx = 18;
            const ry = H - rh - 18;

            push();
            // Fond du scanner biologique
            noStroke();
            fill(8, 2, 10, 215);
            rect(rx, ry, rw, rh, 10);

            // Contour verre organique
            stroke(90, 22, 50, 180);
            strokeWeight(1.4);
            noFill();
            rect(rx, ry, rw, rh, 10);

            // Graticule radar
            stroke(255, 45, 95, 28);
            strokeWeight(0.8);
            line(rx + rw * 0.5, ry + 18, rx + rw * 0.5, ry + rh - 4);
            line(rx + 6, ry + (rh + 18) * 0.5, rx + rw - 6, ry + (rh + 18) * 0.5);

            // En-tête du scanner
            noStroke();
            fill(255, 75, 120, 220);
            textSize(8.5);
            textStyle(BOLD);
            textAlign(LEFT, TOP);
            text('SCANNER BIOLOGIQUE', rx + 10, ry + 6);

            // Fonction de projection coordonnées monde -> coordonnées radar
            const padX = 10;
            const padY = 20;
            const mapX = (x) => rx + padX + ((x / Math.max(1, W)) * (rw - padX * 2));
            const mapY = (y) => ry + padY + ((y / Math.max(1, H)) * (rh - padY - 8));

            // 1. Obstacles (cyan)
            if (obstaclesList) {
                fill(40, 200, 215, 160);
                for (const obs of obstaclesList) {
                    const ox = mapX(obs.pos.x);
                    const oy = mapY(obs.pos.y);
                    const or = Math.max(2.5, (obs.r / W) * rw);
                    circle(ox, oy, or * 2);
                }
            }

            // 2. Bactéries ennemies (ambre / magenta)
            if (bacteriaList) {
                fill(255, 70, 90, 220);
                for (const bac of bacteriaList) {
                    circle(mapX(bac.pos.x), mapY(bac.pos.y), 3.5);
                }
            }

            // 3. Alliés (bleu-cyan)
            if (alliesList) {
                fill(70, 220, 240, 220);
                for (const ally of alliesList) {
                    if (ally.health > 0) {
                        circle(mapX(ally.pos.x), mapY(ally.pos.y), 4);
                    }
                }
            }

            // 4. Virus prédateurs (rouge vif clignotant)
            const virusList = Array.isArray(virusEntity) ? virusEntity : (virusEntity ? [virusEntity] : []);
            if (virusList.length > 0) {
                const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.15);
                fill(255, 20, 50, 180 + 75 * pulse);
                for (const v of virusList) {
                    if (v && v.pos) {
                        circle(mapX(v.pos.x), mapY(v.pos.y), 7 + 2 * pulse);
                    }
                }
            }

            // 5. Globule blanc joueur (blanc / cyan éclatant)
            if (playerEntity) {
                const px = mapX(playerEntity.pos.x);
                const py = mapY(playerEntity.pos.y);
                fill(255, 255, 255, 255);
                circle(px, py, 5);
                noFill();
                stroke(60, 240, 220, 200);
                strokeWeight(1);
                circle(px, py, 9);
            }

            pop();
        }
    };
})();
