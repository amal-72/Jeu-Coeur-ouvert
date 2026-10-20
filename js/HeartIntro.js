/**
 * HeartIntro.js — Écran d'accueil et animation d'ouverture du cœur
 * Projet CŒUR OUVERT
 *
 * Responsabilités :
 * - Affiche le cœur humain fermé, vivant et détaillé au centre
 * - Anime les pulsations cardiaques douces (systole/diastole)
 * - Gère l'arrière-plan organique immersif (particules, lueurs, vaisseaux)
 * - Déclenche la séquence cinématique d'ouverture au clic/toucher (unique)
 * - Maintient le jeu en pause absolue jusqu'à la fin de la transition
 * - Démarre la partie en toute sécurité sans modifier la logique de jeu
 */

(function () {
    'use strict';

    let isInitialized = false;
    let isOpening = false;
    let callbacks = {
        onStartGame: null,
        ensureAudio: null,
        playTone: null
    };

    let bgCanvas = null;
    let bgCtx = null;
    let bgAnimFrameId = null;
    let bgParticles = [];

    // Synthesiseur audio de battement cardiaque réaliste (Web Audio)
    function playCardiacHeartbeat(audioCtx, isIntense = false) {
        if (!audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const volume = isIntense ? 0.45 : 0.22;

            // 1er temps : "Lub" (contraction ventriculaire / fermeture mitrale-tricuspide)
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(isIntense ? 80 : 66, now);
            osc1.frequency.exponentialRampToValueAtTime(30, now + 0.14);

            gain1.gain.setValueAtTime(0.0001, now);
            gain1.gain.linearRampToValueAtTime(volume, now + 0.02);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.start(now);
            osc1.stop(now + 0.17);

            // 2e temps : "Dub" (fermeture des valves aortique et pulmonaire)
            const t2 = now + (isIntense ? 0.13 : 0.16);
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(isIntense ? 96 : 82, t2);
            osc2.frequency.exponentialRampToValueAtTime(36, t2 + 0.12);

            gain2.gain.setValueAtTime(0.0001, t2);
            gain2.gain.linearRampToValueAtTime(volume * 0.75, t2 + 0.018);
            gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.13);

            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start(t2);
            osc2.stop(t2 + 0.14);
        } catch (e) {
            // Audio non disponible ou bloqué
        }
    }

    // Effet sonore d'ouverture profonde et incandescente
    function playOpeningSfx(audioCtx) {
        if (!audioCtx) return;
        try {
            const now = audioCtx.currentTime;

            // Onde sub-bass profonde
            const sub = audioCtx.createOscillator();
            const subGain = audioCtx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(110, now);
            sub.frequency.exponentialRampToValueAtTime(34, now + 0.8);
            subGain.gain.setValueAtTime(0.001, now);
            subGain.gain.linearRampToValueAtTime(0.4, now + 0.06);
            subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
            sub.connect(subGain);
            subGain.connect(audioCtx.destination);
            sub.start(now);
            sub.stop(now + 0.86);

            // Éclat de lumière / résonance harmonique
            const shimmer = audioCtx.createOscillator();
            const shimGain = audioCtx.createGain();
            shimmer.type = 'triangle';
            shimmer.frequency.setValueAtTime(280, now + 0.1);
            shimmer.frequency.exponentialRampToValueAtTime(560, now + 0.9);
            shimGain.gain.setValueAtTime(0.0001, now + 0.1);
            shimGain.gain.linearRampToValueAtTime(0.2, now + 0.35);
            shimGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
            shimmer.connect(shimGain);
            shimGain.connect(audioCtx.destination);
            shimmer.start(now + 0.1);
            shimmer.stop(now + 1.15);
        } catch (e) {
            // Audio ignorable
        }
    }

    // Animation du canevas d'arrière-plan de l'écran d'accueil
    function initBackgroundCanvas(canvas) {
        if (!canvas) return;
        bgCanvas = canvas;
        bgCtx = canvas.getContext('2d');

        function resize() {
            if (!bgCanvas) return;
            bgCanvas.width = window.innerWidth;
            bgCanvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        // Particules biologiques flottantes en arrière-plan
        bgParticles = [];
        const count = Math.min(60, Math.floor((window.innerWidth * window.innerHeight) / 22000));
        for (let i = 0; i < count; i++) {
            bgParticles.push({
                x: Math.random() * bgCanvas.width,
                y: Math.random() * bgCanvas.height,
                radius: 1.2 + Math.random() * 3.5,
                vx: (Math.random() - 0.5) * 0.25,
                vy: -0.15 - Math.random() * 0.3,
                alpha: 0.12 + Math.random() * 0.35,
                colorType: i % 4 === 0 ? 'cyan' : (i % 3 === 0 ? 'magenta' : 'red')
            });
        }

        let lastT = performance.now();
        function loopBg(now) {
            if (!bgCanvas || isOpening) return;
            const dt = Math.min(50, now - lastT) * 0.001;
            lastT = now;

            bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

            // Pulsation subtile de fond
            const pulse = 0.5 + 0.5 * Math.sin(now * 0.0028);

            // Tissus cellulaires lointains
            bgCtx.save();
            const grad = bgCtx.createRadialGradient(
                bgCanvas.width * 0.5, bgCanvas.height * 0.5, 40,
                bgCanvas.width * 0.5, bgCanvas.height * 0.5, Math.max(bgCanvas.width, bgCanvas.height) * 0.75
            );
            grad.addColorStop(0, `rgba(180, 24, 60, ${0.06 + 0.03 * pulse})`);
            grad.addColorStop(0.5, `rgba(80, 12, 35, ${0.04 + 0.02 * pulse})`);
            grad.addColorStop(1, 'rgba(4, 2, 8, 0)');
            bgCtx.fillStyle = grad;
            bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
            bgCtx.restore();

            // Particules
            for (const p of bgParticles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.y < -10) {
                    p.y = bgCanvas.height + 10;
                    p.x = Math.random() * bgCanvas.width;
                }
                if (p.x < -10) p.x = bgCanvas.width + 10;
                if (p.x > bgCanvas.width + 10) p.x = -10;

                bgCtx.beginPath();
                bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                if (p.colorType === 'cyan') {
                    bgCtx.fillStyle = `rgba(100, 230, 220, ${p.alpha * 0.7})`;
                } else if (p.colorType === 'magenta') {
                    bgCtx.fillStyle = `rgba(235, 70, 150, ${p.alpha * 0.8})`;
                } else {
                    bgCtx.fillStyle = `rgba(225, 45, 75, ${p.alpha})`;
                }
                bgCtx.fill();
            }

            bgAnimFrameId = requestAnimationFrame(loopBg);
        }

        bgAnimFrameId = requestAnimationFrame(loopBg);
    }

    // Déclenchement de l'animation d'ouverture du cœur
    function triggerHeartOpening(event) {
        if (isOpening) return;
        isOpening = true;

        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const overlay = document.getElementById('heartIntroOverlay');
        const heartEl = document.getElementById('heartInteractive');
        if (!overlay || !heartEl) return;

        // Débloquer et activer l'audio au geste utilisateur
        let audioCtx = null;
        if (callbacks.ensureAudio) {
            audioCtx = callbacks.ensureAudio();
        }

        // Son d'ouverture immersif
        playOpeningSfx(audioCtx);

        // 1. Réaction immédiate : pulsation systolique prononcée
        overlay.classList.add('is-reacting');

        // 2. Écartement des parois du cœur & jaillissement de la lumière intérieure
        setTimeout(() => {
            overlay.classList.remove('is-reacting');
            overlay.classList.add('is-opening');
            playCardiacHeartbeat(audioCtx, true);
        }, 220);

        // 3. Zoom vers l'intérieur & révélation du monde biologique
        setTimeout(() => {
            overlay.classList.add('is-zooming');
        }, 700);

        // 4. Éclat lumineux de transition
        setTimeout(() => {
            overlay.classList.add('is-flashing');
        }, 1500);

        // 5. Fin de la cinématique et démarrage de la partie
        setTimeout(() => {
            overlay.classList.add('is-completed');
            if (bgAnimFrameId) {
                cancelAnimationFrame(bgAnimFrameId);
                bgAnimFrameId = null;
            }

            // Masquer complètement l'overlay d'accueil
            overlay.hidden = true;
            overlay.style.display = 'none';

            // Afficher le menu principal (pas démarrer la partie directement)
            // La partie ne commence qu'au clic sur "COMMENCER LA PARTIE"
            if (typeof callbacks.onShowMainMenu === 'function') {
                callbacks.onShowMainMenu();
            } else if (typeof callbacks.onStartGame === 'function') {
                // Fallback de compatibilité si onShowMainMenu n'est pas fourni
                callbacks.onStartGame();
            }
        }, 2100);
    }

    // API Publique du module
    window.HeartIntro = {
        init: function (options) {
            if (isInitialized) return;
            isInitialized = true;
            callbacks = Object.assign(callbacks, options || {});

            const overlay = document.getElementById('heartIntroOverlay');
            const heartTarget = document.getElementById('heartInteractive');
            const bgCanvasEl = document.getElementById('heartIntroBgCanvas');
            const settingsBtn = document.getElementById('heartSettingsBtn');

            if (!overlay || !heartTarget) return;

            // Initialiser l'ambiance visuelle d'arrière-plan
            initBackgroundCanvas(bgCanvasEl);

            // Événements d'ouverture sur le cœur : souris, tactile, clavier
            heartTarget.addEventListener('click', triggerHeartOpening);
            heartTarget.addEventListener('touchstart', triggerHeartOpening, { passive: false });
            heartTarget.addEventListener('keydown', function (e) {
                if (e.code === 'Enter' || e.code === 'Space') {
                    triggerHeartOpening(e);
                }
            });

            // Battements cardiaques sonores subtils lors du survol
            heartTarget.addEventListener('mouseenter', function () {
                if (isOpening) return;
                if (callbacks.ensureAudio) {
                    const ctx = callbacks.ensureAudio();
                    if (ctx && ctx.state === 'running') {
                        playCardiacHeartbeat(ctx, false);
                    }
                }
            });
        },

        isOpening: function () {
            return isOpening;
        },

        reset: function () {
            isOpening = false;
            const overlay = document.getElementById('heartIntroOverlay');
            if (overlay) {
                overlay.classList.remove('is-reacting', 'is-opening', 'is-zooming', 'is-flashing', 'is-completed');
                overlay.hidden = false;
                overlay.style.display = 'flex';
                overlay.style.opacity = '1';
            }
            const bgCanvasEl = document.getElementById('heartIntroBgCanvas');
            if (bgCanvasEl && !bgAnimFrameId) {
                initBackgroundCanvas(bgCanvasEl);
            }
        }
    };
})();
