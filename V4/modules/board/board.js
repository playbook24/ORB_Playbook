/**
 * board.js
 * Initialisation de l'éditeur tactique
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Démarrage du Board ORB...");

    // SÉCURITÉ : Si state.js n'a pas été chargé correctement, on évite le crash
    if (!window.ORB) window.ORB = {};
    if (!window.ORB.history) window.ORB.history = [];
    if (!window.ORB.redoStack) window.ORB.redoStack = [];
    if (!window.ORB.commitState) {
        window.ORB.commitState = function() {
            window.ORB.history.push(JSON.parse(JSON.stringify(window.ORB.playbookState)));
        }
    }

    // 1. Initialiser le Canvas (le terrain)
    window.ORB.canvas = document.getElementById('basketball-court');
    window.ORB.ctx = window.ORB.canvas.getContext('2d');
    window.ORB.animCanvas = document.getElementById('animation-canvas');
    if (window.ORB.animCanvas) window.ORB.animCtx = window.ORB.animCanvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = window.ORB.canvas.getBoundingClientRect();
    window.ORB.canvas.width = rect.width * dpr;
    window.ORB.canvas.height = rect.height * dpr;
    window.ORB.ctx.scale(dpr, dpr);

    // 2. Lancer la Base de Données
    if (typeof orbDB !== 'undefined' && typeof orbDB.open === 'function') {
        try {
            await orbDB.open();
        } catch (e) {
            console.error("Erreur DB:", e);
        }
    }

    // 3. Lancer l'interface et les clics
    if (window.ORB.ui && typeof window.ORB.ui.init === 'function') window.ORB.ui.init();
    if (window.ORB.interactions && typeof window.ORB.interactions.init === 'function') window.ORB.interactions.init();

    // 4. Premier état et sélection
    window.ORB.commitState();
    
    // Force la sélection de l'outil "Select" au démarrage pour activer l'UI
    const selectTool = document.getElementById("tool-select");
    if(selectTool) selectTool.classList.add('active');
    
    // S'assurer que le terrain se dessine une première fois
    if (window.ORB.renderer && typeof window.ORB.renderer.redrawCanvas === 'function') {
        window.ORB.renderer.redrawCanvas();
    }
});