/**
 * modules/board/ui.js
 * Gestion de l'interface utilisateur.
 */

window.ORB.ui = {

    init: function() {
        this.bindMainButtons();
        this.bindToolButtons();
        this.bindSceneControls();
        this.bindPropertiesPanel();
        this.bindExports();
        this.bindTheme();
        this.initColorPalettes();
        this.bindInputMode();
    },

    bindInputMode: function() {
        const btn = document.getElementById('input-mode-btn');
        const iconMouse = document.getElementById('icon-mode-mouse');
        const iconStylus = document.getElementById('icon-mode-stylus');
        
        if (!btn || !iconMouse || !iconStylus) return; // SÉCURITÉ

        const updateModeUI = () => {
            const mode = window.ORB.appState.inputMode;
            const isStylus = mode === 'stylus';
            
            iconMouse.classList.toggle('hidden', isStylus);
            iconStylus.classList.toggle('hidden', !isStylus);
            
            btn.classList.toggle('active', isStylus);
            btn.title = isStylus ? "Mode Stylet : Dessin libre" : "Mode Souris : Point à point";
        };

        const savedMode = localStorage.getItem('inputMode');
        if (savedMode) {
            window.ORB.appState.inputMode = savedMode;
        }
        updateModeUI();

        btn.addEventListener('click', () => {
            const current = window.ORB.appState.inputMode;
            const newMode = current === 'mouse' ? 'stylus' : 'mouse';
            window.ORB.appState.inputMode = newMode;
            localStorage.setItem('inputMode', newMode);
            updateModeUI();
        });
    },

    toggleFloatingPanel: function(panel, button) {
        if (!panel || !button) return;
        const isOpening = panel.classList.contains('hidden');
        document.querySelectorAll('.floating-panel').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('.header-left button, .header-right .btn-icon').forEach(b => b.classList.remove('active'));
        if (isOpening) {
            panel.classList.remove('hidden');
            button.classList.add('active');
        }
    },

    bindMainButtons: function() {
        const togglePlaybookManagerBtn = document.getElementById('toggle-playbook-manager-btn');
        const playbookManagerContainer = document.getElementById('play-manager-container');
        const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
        const settingsPanel = document.getElementById('settings-panel');

        if (togglePlaybookManagerBtn) {
            togglePlaybookManagerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFloatingPanel(playbookManagerContainer, togglePlaybookManagerBtn);
            });
        }

        if (toggleSettingsBtn) {
            toggleSettingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFloatingPanel(settingsPanel, toggleSettingsBtn);
            });
        }

        window.addEventListener('click', (e) => {
            const activeFloatingPanel = document.querySelector('.floating-panel:not(.hidden)');
            if (activeFloatingPanel) {
                const button = activeFloatingPanel.id.includes('play-manager') ? togglePlaybookManagerBtn : toggleSettingsBtn;
                if (!activeFloatingPanel.contains(e.target) && button && !button.contains(e.target)) {
                    if (!e.target.closest('.fullscreen-view') && !e.target.closest('.hidden')) {
                         activeFloatingPanel.classList.add('hidden');
                         if(button) button.classList.remove('active');
                    }
                }
            }
        });

        const undoBtn = document.getElementById('action-undo');
        if(undoBtn) undoBtn.addEventListener('click', () => window.ORB.undo());
        
        const redoBtn = document.getElementById('action-redo');
        if(redoBtn) redoBtn.addEventListener('click', () => window.ORB.redo());
        
        const mirrorBtn = document.getElementById('action-mirror');
        if(mirrorBtn) mirrorBtn.addEventListener('click', () => {
            const pbState = window.ORB.playbookState;
            const isHalf = document.body.classList.contains('view-half-court');
            const viewWidth = isHalf ? window.ORB.CONSTANTS.LOGICAL_WIDTH / 2 : window.ORB.CONSTANTS.LOGICAL_WIDTH;
            
            const currentScene = pbState.scenes[pbState.activeSceneIndex];
            currentScene.elements.forEach(el => {
                if (typeof el.x !== 'undefined') el.x = viewWidth - el.x;
                if (el.points) el.points.forEach(p => p.x = viewWidth - p.x);
                if (el.type === 'zone') el.x -= el.width;
                if (el.type === 'defender') el.rotation = (180 - el.rotation + 360) % 360;
            });
            window.ORB.commitState();
            window.ORB.renderer.redrawCanvas();
        });

        const clearBtn = document.getElementById("tool-clear");
        if(clearBtn) clearBtn.addEventListener("click", () => {
            if (confirm("Voulez-vous vraiment effacer tous les éléments de CETTE SCÈNE ?")) {
                window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements = [];
                window.ORB.appState.playerCounter = 1;
                window.ORB.appState.defenderCounter = 1;
                window.ORB.appState.selectedElement = null;
                window.ORB.appState.currentLoadedPlaybookId = null;
                window.ORB.commitState();
                this.updatePropertiesPanel();
                window.ORB.renderer.redrawCanvas();
            }
        });
        
        const nameInput = document.getElementById('play-name-input');
        if(nameInput) nameInput.addEventListener('change', e => {
            window.ORB.playbookState.name = e.target.value;
            window.ORB.commitState();
        });
    },

    bindToolButtons: function() {
        document.querySelectorAll(".tool-btn").forEach(button => {
            button.addEventListener("click", () => {
                if(!button.classList.contains('view-btn')) {
                    window.ORB.interactions.finalizeCurrentPath();
                    document.querySelectorAll(".tool-btn:not(.view-btn)").forEach(btn => btn.classList.remove("active"));
                    button.classList.add("active");
                    window.ORB.appState.currentTool = button.id.split("-")[1];
                    window.ORB.appState.selectedElement = null;
                    window.ORB.appState.selectedScene = null;
                    window.ORB.appState.tempElement = null;
                    this.updatePropertiesPanel();
                    window.ORB.renderer.redrawCanvas();
                }
            })
        });

        const viewFullBtn = document.getElementById('view-full-court-btn');
        const viewHalfBtn = document.getElementById('view-half-court-btn');
        
        const setView = (view) => {
            document.body.classList.remove("view-full-court", "view-half-court");
            document.body.classList.add(`view-${view}-court`);
            if(viewFullBtn) viewFullBtn.classList.toggle("active", view === "full");
            if(viewHalfBtn) viewHalfBtn.classList.toggle("active", view === "half");
            
            const courtSvg = document.getElementById('court-svg');
            if(courtSvg) {
                if (view === 'half') {
                    courtSvg.setAttribute('viewBox', '0 0 140 150');
                } else {
                    courtSvg.setAttribute('viewBox', '0 0 280 150');
                }
            }
            window.ORB.renderer.resizeCanvas();
        };

        if(viewFullBtn) viewFullBtn.addEventListener("click", () => setView("full"));
        if(viewHalfBtn) viewHalfBtn.addEventListener("click", () => setView("half"));
    },

    updateSceneListUI: function() {
        const sceneList = document.getElementById('scene-list');
        if (!sceneList) return;
        const pbState = window.ORB.playbookState;
        const appState = window.ORB.appState;

        sceneList.innerHTML = "";
        pbState.scenes.forEach((scene, index) => {
            const li = document.createElement("li");
            li.dataset.index = index;
            li.draggable = true;
            li.textContent = scene.name || `Scène ${index + 1}`;
    
            if (index === pbState.activeSceneIndex) li.classList.add("active");
            
            li.addEventListener("click", () => this.switchToScene(index));
            sceneList.appendChild(li);
        });
    },

    switchToScene: function(index, isUndoRedo = false) {
        const pbState = window.ORB.playbookState;
        const appState = window.ORB.appState;

        if (index < 0 || index >= pbState.scenes.length) return;
        if (!isUndoRedo) window.ORB.interactions.finalizeCurrentPath();
        
        pbState.activeSceneIndex = index;
        appState.selectedElement = null;
        appState.selectedScene = pbState.scenes[index];
        
        const commentsArea = document.getElementById('comments-textarea');
        if (pbState.scenes[index] && commentsArea) commentsArea.value = pbState.scenes[index].comments || "";
        
        this.updateSceneListUI();
        this.updatePropertiesPanel();
        window.ORB.renderer.redrawCanvas();
    },

    bindSceneControls: function() {
        const addSceneBtn = document.getElementById("add-scene-btn");
        if(addSceneBtn) addSceneBtn.addEventListener("click", () => {
            const pbState = window.ORB.playbookState;
            const currentScene = pbState.scenes[pbState.activeSceneIndex];
            const newScene = JSON.parse(JSON.stringify(currentScene));
            newScene.comments = "";
            newScene.durationOverride = null;
            const newIndex = pbState.activeSceneIndex + 1;
            newScene.name = `Scène ${pbState.scenes.length + 1}`;
            pbState.scenes.splice(newIndex, 0, newScene);
            window.ORB.commitState();
            this.switchToScene(newIndex);
        });

        const deleteSceneBtn = document.getElementById("delete-scene-btn");
        if(deleteSceneBtn) deleteSceneBtn.addEventListener("click", () => {
            const pbState = window.ORB.playbookState;
            if (pbState.scenes.length <= 1) return alert("Impossible de supprimer la dernière scène.");
            if (confirm("Supprimer cette scène ?")) {
                pbState.scenes.splice(pbState.activeSceneIndex, 1);
                const newIndex = Math.min(pbState.activeSceneIndex, pbState.scenes.length - 1);
                window.ORB.commitState();
                this.switchToScene(newIndex);
            }
        });
        
        const playAnimBtn = document.getElementById('play-animation-btn');
        if(playAnimBtn) playAnimBtn.addEventListener('click', () => {
            const courtView = document.body.classList.contains('view-half-court') ? 'half' : 'full';
            window.ORB.animationState.view = courtView;
            
            const player = document.getElementById('animation-player');
            if(player) player.classList.remove('hidden');
            
            const animContainer = document.getElementById('animation-container');
            if(animContainer) animContainer.style.aspectRatio = (courtView === 'half') ? '140 / 150' : '280 / 150';
            
            const courtSvg = document.getElementById('court-svg');
            if(courtSvg) {
                const svgClone = courtSvg.cloneNode(true);
                if (courtView === 'half') {
                    svgClone.setAttribute('viewBox', '0 0 140 150');
                    const logo = svgClone.querySelector('.center-court-logo');
                    if (logo) logo.style.display = 'none';
                } else {
                    svgClone.setAttribute('viewBox', '0 0 280 150');
                }
                const animBg = document.getElementById('animation-court-background');
                if(animBg) animBg.innerHTML = svgClone.outerHTML;
            }

            requestAnimationFrame(() => {
                if(animContainer && window.ORB.animCanvas) {
                    const animRect = animContainer.getBoundingClientRect();
                    const dpr = window.devicePixelRatio || 1;
                    window.ORB.animCanvas.width = animRect.width * dpr;
                    window.ORB.animCanvas.height = animRect.height * dpr;
                    window.ORB.animCtx.scale(dpr, dpr);
                    window.ORB.animation.prepareStoryboard(courtView);
                    window.ORB.animationState.startTime = 0;
                    window.ORB.animationState.elapsedOffset = 0;
                    window.ORB.animation.startLoop();
                }
            });
        });

        const playPauseBtn = document.getElementById('anim-play-pause-btn');
        if(playPauseBtn) playPauseBtn.addEventListener('click', () => {
             if (window.ORB.animationState.isFinished) {
                window.ORB.animationState.startTime = 0;
                window.ORB.animationState.elapsedOffset = 0;
                window.ORB.animation.startLoop();
            } else if (window.ORB.animationState.isPlaying) {
                window.ORB.animation.stopLoop();
            } else {
                window.ORB.animation.startLoop();
            }
        });

        const animCloseBtn = document.getElementById('anim-close-btn');
        if(animCloseBtn) animCloseBtn.addEventListener('click', () => {
            window.ORB.animation.stopLoop();
            const player = document.getElementById('animation-player');
            if(player) player.classList.add('hidden');
        });
    },

    updatePropertiesPanel: function() {
        const appState = window.ORB.appState;
        const pbState = window.ORB.playbookState;
        document.querySelectorAll('.prop-group').forEach(g => g.classList.add('hidden'));
        
        const propertiesPanel = document.getElementById('properties-panel');
        const noPropsMessage = document.getElementById('no-props-message');
        if(!propertiesPanel || !noPropsMessage) return;
        
        const hasSelection = appState.selectedElement || appState.selectedScene;
        if (!hasSelection) propertiesPanel.classList.add('hidden');
        else propertiesPanel.classList.remove('hidden');
        
        noPropsMessage.style.display = hasSelection ? 'none' : 'block';

        if (appState.selectedElement) {
            const el = appState.selectedElement;
            const map = {
                'player': 'player-props', 'defender': 'defender-props', 'ball': 'ball-props',
                'cone': 'cone-props', 'hoop': 'hoop-props', 'basket': 'basket-props',
                'zone': 'zone-props', 'text': 'text-props'
            };
            let groupId = map[el.type];
            if (['arrow', 'pass', 'dribble', 'screen', 'pencil'].includes(el.type)) groupId = 'path-props';

            if (groupId) {
                const group = document.getElementById(groupId);
                if(group) {
                    group.classList.remove('hidden');
                    if (el.label && group.querySelector('input[id*="label"]')) group.querySelector('input[id*="label"]').value = el.label;
                    if (el.color && group.querySelector('input[type="color"]')) group.querySelector('input[type="color"]').value = el.color;
                    if (typeof el.rotation !== 'undefined' && group.querySelector('input[id*="rotation"]')) group.querySelector('input[id*="rotation"]').value = el.rotation;
                    if (el.text && document.getElementById('text-content-input')) document.getElementById('text-content-input').value = el.text;
                    if (el.size && document.getElementById('text-size-input')) document.getElementById('text-size-input').value = el.size;
                    if (el.width && document.getElementById('path-width-input')) document.getElementById('path-width-input').value = el.width;
                }
            }
        }
    },

    bindPropertiesPanel: function() {
        const panel = document.getElementById('properties-panel');
        if(!panel) return;
        
        panel.addEventListener('change', e => {
            const appState = window.ORB.appState;
            if (appState.selectedElement) {
                const val = e.target.value;
                const id = e.target.id;
                if (id.startsWith('text-content')) appState.selectedElement.text = val;
                else if (id.includes('color')) appState.selectedElement.color = val;
                else if (id.includes('label')) appState.selectedElement.label = val;
                else if (id.includes('size') || id.includes('width') || id.includes('rotation')) {
                    const key = id.split('-')[1]; 
                    appState.selectedElement[key] = parseFloat(val);
                }
                window.ORB.commitState();
                window.ORB.renderer.redrawCanvas();
            }
        });

        panel.addEventListener('click', e => {
            if (e.target.classList.contains('color-swatch') && window.ORB.appState.selectedElement) {
                const color = e.target.dataset.color;
                window.ORB.appState.selectedElement.color = color;
                const input = e.target.closest('.prop-group').querySelector('input[type="color"]');
                if (input) input.value = color;
                window.ORB.commitState();
                window.ORB.renderer.redrawCanvas();
            }
        });
    },
    
    initColorPalettes: function() {
        const createPalette = (id, colors) => {
            const container = document.querySelector(`#${id} .color-palette`);
            if (!container) return;
            container.innerHTML = '';
            colors.forEach(c => {
                const d = document.createElement('div');
                d.className = 'color-swatch'; d.style.backgroundColor = c; d.dataset.color = c;
                container.appendChild(d);
            });
        };
        createPalette('player-props', ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createPalette('defender-props', ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createPalette('path-props', ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
        createPalette('text-props', ['#d32f2f', '#007bff', '#28a745', '#ffc107', '#343a40', '#f8f9fa']);
    },

    updateUndoRedoButtons: function() {
        const undoBtn = document.getElementById('action-undo');
        const redoBtn = document.getElementById('action-redo');
        if(undoBtn) undoBtn.disabled = window.ORB.history.length <= 1;
        if(redoBtn) redoBtn.disabled = window.ORB.redoStack.length === 0;
    },

    bindExports: function() {
        const saveFileBtn = document.getElementById('save-file-btn');
        if(saveFileBtn) saveFileBtn.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(window.ORB.playbookState, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${window.ORB.playbookState.name.trim() || 'playbook'}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        });
    },

    bindTheme: function() {
        const updateTheme = (theme) => {
            const isDark = theme === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            const sun = document.getElementById('theme-icon-sun');
            const moon = document.getElementById('theme-icon-moon');
            if(sun) sun.classList.toggle('hidden', isDark);
            if(moon) moon.classList.toggle('hidden', !isDark);
        };
        const saved = localStorage.getItem('theme') || 'light';
        updateTheme(saved);
        const themeBtn = document.getElementById('theme-toggle-btn');
        if(themeBtn) themeBtn.addEventListener('click', () => {
            const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            updateTheme(newTheme);
        });
        
        const teamBtn = document.getElementById('team-theme-btn');
        const updateTeamUI = (isCrab) => {
            if (isCrab) {
                document.body.classList.add('crab-mode');
                if(teamBtn) teamBtn.classList.add('active');
                const svg = document.getElementById('court-svg');
                if(svg) {
                    const rect = svg.querySelector('rect[width="280"]');
                    if(rect) rect.setAttribute('fill', window.ORB.CONSTANTS.COLORS.crabPrimary);
                    const circle = svg.querySelector('.center-court-logo circle:first-child');
                    if(circle) circle.setAttribute('fill', window.ORB.CONSTANTS.COLORS.crabPrimary);
                    svg.querySelectorAll('line, path, circle, rect:not([width="280"])').forEach(el => {
                         if(el.getAttribute('stroke')) el.setAttribute('stroke', window.ORB.CONSTANTS.COLORS.crabSecondary);
                    });
                    const txt = svg.querySelector('.center-court-logo text');
                    if(txt) { txt.textContent = "CRAB"; txt.setAttribute('fill', window.ORB.CONSTANTS.COLORS.crabSecondary); }
                }
            } else {
                document.body.classList.remove('crab-mode');
                if(teamBtn) teamBtn.classList.remove('active');
                 const svg = document.getElementById('court-svg');
                 if(svg) {
                    const rect = svg.querySelector('rect[width="280"]');
                    if(rect) rect.setAttribute('fill', window.ORB.CONSTANTS.COLORS.primary);
                    const circle = svg.querySelector('.center-court-logo circle:first-child');
                    if(circle) circle.setAttribute('fill', window.ORB.CONSTANTS.COLORS.primary);
                    svg.querySelectorAll('line, path, circle, rect:not([width="280"])').forEach(el => {
                         if(el.getAttribute('stroke')) el.setAttribute('stroke', window.ORB.CONSTANTS.COLORS.secondary);
                    });
                    const txt = svg.querySelector('.center-court-logo text');
                    if(txt) { txt.textContent = "ORB"; txt.setAttribute('fill', window.ORB.CONSTANTS.COLORS.secondary); }
                 }
            }
            if(window.ORB.renderer) window.ORB.renderer.redrawCanvas();
        };
        if (localStorage.getItem('teamMode') === 'crab') updateTeamUI(true);
        if(teamBtn) teamBtn.addEventListener('click', () => {
            const isCrab = !document.body.classList.contains('crab-mode');
            localStorage.setItem('teamMode', isCrab ? 'crab' : 'orb');
            updateTeamUI(isCrab);
        });
    }
};