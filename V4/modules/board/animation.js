/**
 * modules/board/animation.js
 * Restauration complète du moteur d'interpolation V3 + Export Vidéo V4.
 */

window.ORB = window.ORB || {};

window.ORB.animationState = {
    isPlaying: false,
    isFinished: false,
    isRecording: false,
    startTime: 0,
    elapsedOffset: 0,
    view: 'full',
    storyboard: [],
    totalDuration: 0,
    framesPerSecond: 30,
    lastPositions: new Map() // Indispensable pour la rotation fluide des joueurs
};

window.ORB.animation = {
    
    init: function() {
        this.animCanvas = document.getElementById('animation-canvas');
        if (this.animCanvas) {
            this.animCtx = this.animCanvas.getContext('2d');
            window.ORB.animCanvas = this.animCanvas;
            window.ORB.animCtx = this.animCtx;
        }
        this.capturer = null;

        this.playerModal = document.getElementById('animation-player');
        this.btnPlayPause = document.getElementById('anim-play-pause-btn');
        this.iconPlay = document.getElementById('anim-icon-play');
        this.iconPause = document.getElementById('anim-icon-pause');
        this.timeDisplay = document.getElementById('anim-time-display');

        if(document.getElementById('anim-close-btn')) {
            document.getElementById('anim-close-btn').addEventListener('click', () => {
                this.stopLoop();
                if(this.playerModal) this.playerModal.classList.add('hidden');
            });
        }
        
        if(this.btnPlayPause) {
            this.btnPlayPause.addEventListener('click', () => {
                if (window.ORB.animationState.isFinished) {
                    this.startLoop();
                } else if (window.ORB.animationState.isPlaying) {
                    this.pauseLoop();
                } else {
                    this.resumeLoop();
                }
            });
        }
    },

    updateIcons: function() {
        if (window.ORB.animationState.isPlaying) {
            if(this.iconPlay) this.iconPlay.classList.add('hidden');
            if(this.iconPause) this.iconPause.classList.remove('hidden');
        } else {
            if(this.iconPlay) this.iconPlay.classList.remove('hidden');
            if(this.iconPause) this.iconPause.classList.add('hidden');
        }
    },

    prepareStoryboard: function(courtView) {
        const state = window.ORB.animationState;
        const pbState = window.ORB.playbookState;
        const CONSTANTS = window.ORB.CONSTANTS;
        const utils = window.ORB.utils;

        state.storyboard = [];
        state.totalDuration = 0;
        state.lastPositions.clear();
        
        const MOVEMENT_TOOLS = ['arrow', 'dribble', 'screen'];

        if (courtView === 'half') {
            const firstSceneElements = pbState.scenes[0].elements.filter(e => e.type === 'player' || e.type === 'defender');
            if (firstSceneElements.length > 0) {
                const avgX = firstSceneElements.reduce((sum, el) => sum + el.x, 0) / firstSceneElements.length;
                state.activeHalf = (avgX > CONSTANTS.LOGICAL_WIDTH / 2) ? 'right' : 'left';
            } else {
                state.activeHalf = 'left'; 
            }
        }

        for (let i = 0; i < pbState.scenes.length - 1; i++) {
            const startScene = pbState.scenes[i];
            const endScene = pbState.scenes[i + 1];
            const transition = {
                duration: CONSTANTS.MIN_SCENE_DURATION || 2000,
                passData: [], 
                passPathData: [],
                tweens: []
            };

            const startElementsMap = new Map(startScene.elements.map(e => [e.id, e]));
            const endElementsMap = new Map(endScene.elements.map(e => [e.id, e]));
            
            const startBalls = startScene.elements.filter(e => e.type === 'ball');
            startBalls.forEach(startBall => {
                const endBall = endElementsMap.get(startBall.id);
                if (endBall && startBall.linkedTo && endBall.linkedTo && startBall.linkedTo !== endBall.linkedTo) {
                    const passInfo = {
                        passerId: startBall.linkedTo,
                        receiverId: endBall.linkedTo,
                        ball: endBall
                    };
                    transition.passData.push(passInfo);
                    
                    const passPath = startScene.elements.find(el => 
                        el.type === 'pass' &&
                        Math.hypot(el.points[0].x - startElementsMap.get(startBall.linkedTo)?.x, el.points[0].y - startElementsMap.get(startBall.linkedTo)?.y) < (CONSTANTS.PROXIMITY_THRESHOLD || 20)
                    );

                    if (passPath && utils.subdividePath) {
                        transition.passPathData.push({
                            points: utils.subdividePath(passPath.points),
                            color: passPath.color,
                            width: passPath.width,
                            type: 'pass'
                        });
                    }
                }
            });

            const consumedPathIds = new Set();
            const allIds = new Set([...startElementsMap.keys(), ...endElementsMap.keys()]);
            let maxMovementLength = 0;

            allIds.forEach(id => {
                const startEl = startElementsMap.get(id);
                const endEl = endElementsMap.get(id);

                if (!startEl || !endEl) return;

                const tween = {
                    ...endEl,
                    startX: startEl.x, startY: startEl.y,
                    endX: endEl.x, endY: endEl.y,
                    startRotation: (startEl.rotation || 0) * Math.PI / 180,
                    endRotation: (endEl.rotation || 0) * Math.PI / 180,
                    movementPath: null
                };

                if (startEl.type === 'player' || startEl.type === 'defender') {
                    const movementPaths = startScene.elements.filter(el => MOVEMENT_TOOLS.includes(el.type) && !consumedPathIds.has(el.id));
                    const linkedPath = movementPaths.find(path => Math.hypot(path.points[0].x - startEl.x, path.points[0].y - startEl.y) < (CONSTANTS.PROXIMITY_THRESHOLD || 20));

                    if (linkedPath) {
                        const pathEnd = linkedPath.points[linkedPath.points.length - 1];
                        if (Math.hypot(pathEnd.x - endEl.x, pathEnd.y - endEl.y) < 5) {
                            if (utils.subdividePath) {
                                const fullPath = utils.subdividePath(linkedPath.points);
                                tween.movementPath = fullPath;
                                tween.pathType = linkedPath.type;
                                tween.pathColor = linkedPath.color;
                                tween.pathWidth = linkedPath.width;
                                const pathLength = utils.getPathLength(fullPath);
                                if (pathLength > maxMovementLength) maxMovementLength = pathLength;
                            }
                            consumedPathIds.add(linkedPath.id);
                        }
                    }
                }
                transition.tweens.push(tween);
            });
            
            const animSettings = pbState.animationSettings || {};
            if (startScene.durationOverride > 0) {
                transition.duration = startScene.durationOverride;
            } else {
                const movementDuration = (maxMovementLength / (animSettings.speed || CONSTANTS.DEFAULT_ANIMATION_SPEED || 100)) * 1000;
                const finalDuration = Math.max(CONSTANTS.MIN_SCENE_DURATION || 2000, movementDuration || 2000);
                transition.duration = transition.passData.length > 0 ? Math.max(finalDuration, CONSTANTS.PASS_DURATION || 1000) : finalDuration;
            }

            state.storyboard.push(transition);
            state.totalDuration += transition.duration;
        }
    },

    easeInOutQuad: function(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },

    renderAnimationFrameToContext: function(p_ctx, p_rect, p_elapsed, p_animState) {
        const CONSTANTS = window.ORB.CONSTANTS;
        const utils = window.ORB.utils;
        const renderer = window.ORB.renderer;
        const pbState = window.ORB.playbookState;

        let cumulativeTime = 0;
        let currentSceneIndex = -1;
        let timeInCurrentScene = 0;

        for (let i = 0; i < p_animState.storyboard.length; i++) {
            const sceneDuration = p_animState.storyboard[i].duration;
            if (p_elapsed < cumulativeTime + sceneDuration) {
                currentSceneIndex = i;
                timeInCurrentScene = p_elapsed - cumulativeTime;
                break;
            }
            cumulativeTime += sceneDuration;
        }

        if (currentSceneIndex === -1 && p_animState.storyboard.length > 0) {
            currentSceneIndex = p_animState.storyboard.length - 1;
            timeInCurrentScene = p_animState.storyboard[currentSceneIndex]?.duration || 0;
        }
        
        const transition = p_animState.storyboard[currentSceneIndex];
        if (!transition) return;

        const currentSceneDuration = transition.duration;
        const rawProgress = currentSceneDuration > 0 ? Math.min(timeInCurrentScene / currentSceneDuration, 1.0) : 1;
        
        let pathProgress = 0;
        let movementProgress = 0;
        const animSettings = pbState.animationSettings || {};
        const anticipationRatio = animSettings.ratio || CONSTANTS.DEFAULT_ANTICIPATION_RATIO || 0.2;

        if (rawProgress < anticipationRatio) {
            pathProgress = rawProgress / anticipationRatio;
            movementProgress = 0;
        } else {
            pathProgress = 1;
            movementProgress = (rawProgress - anticipationRatio) / (1 - anticipationRatio);
        }
        const easedMovementProgress = this.easeInOutQuad(movementProgress);
        
        // C'est ce calcul qui était cassé si on forçait le scale du context
        const getCoordsWithRect = (pos) => utils.getAnimPixelCoords(pos, p_rect, p_animState);
        
        p_ctx.save();
        
        const drawAnimatedPath = (pathData) => {
            if (!pathData || !pathData.points) return;
            const alpha = movementProgress > 0 ? 0.8 * (1 - easedMovementProgress) : 0.8;
            if (utils.getPathSlice && utils.hexToRgba) {
                const pathSlice = utils.getPathSlice(pathData.points, pathProgress);
                const pathOptions = {
                    type: pathData.type,
                    color: utils.hexToRgba(pathData.color || '#212121', alpha),
                    width: (pathData.width || 2.5),
                    noHead: pathProgress < 1,
                };
                renderer.drawPath(pathSlice, false, pathOptions, p_ctx, getCoordsWithRect);
            }
        };

        transition.tweens.forEach(tween => drawAnimatedPath({points: tween.movementPath, type: tween.pathType, color: tween.pathColor, width: tween.pathWidth}));
        transition.passPathData.forEach(drawAnimatedPath);

        p_ctx.restore();
        
        const { passData, tweens } = transition;
        tweens.forEach(tween => {
            let currentPos;
            if (tween.movementPath && utils.getPointOnPath) {
                currentPos = utils.getPointOnPath(tween.movementPath, easedMovementProgress);
            } else {
                currentPos = { 
                    x: tween.startX + (tween.endX - tween.startX) * easedMovementProgress, 
                    y: tween.startY + (tween.endY - tween.startY) * easedMovementProgress 
                };
            }
            if (!currentPos) return;

            let rotation;
            const lastPos = p_animState.lastPositions.get(tween.id);
            if (lastPos && (Math.hypot(currentPos.y - lastPos.y, currentPos.x - lastPos.x) > 0.1) ) {
                rotation = Math.atan2(currentPos.y - lastPos.y, currentPos.x - lastPos.x);
            } else if (tween.type === 'defender' && !tween.movementPath) {
                rotation = tween.startRotation + (tween.endRotation - tween.startRotation) * easedMovementProgress;
            } else {
                rotation = tween.startRotation;
            }

            p_animState.lastPositions.set(tween.id, currentPos);
            
            const drawFnName = 'draw' + tween.type.charAt(0).toUpperCase() + tween.type.slice(1);
            if (renderer[drawFnName] && !(tween.type === 'ball' && tween.linkedTo)) {
                const options = { ...tween, rotation };
                renderer[drawFnName](currentPos.x, currentPos.y, false, options, p_ctx, getCoordsWithRect, { isAnimating: true, rawProgress, sceneIndex: currentSceneIndex, passData: transition.passData });
            }
        });

        if (passData && passData.length > 0) {
            const passProgress = Math.min(easedMovementProgress / (CONSTANTS.PASS_RATIO || 0.8), 1.0);
            passData.forEach(pass => {
                const passerTween = tweens.find(t => t.id === pass.passerId);
                const receiverTween = tweens.find(t => t.id === pass.receiverId);
                
                if (passerTween && receiverTween) {
                    const passerPos = (passerTween.movementPath && utils.getPointOnPath) ? utils.getPointOnPath(passerTween.movementPath, easedMovementProgress) : { x: passerTween.startX + (passerTween.endX - passerTween.startX) * easedMovementProgress, y: passerTween.startY + (passerTween.endY - passerTween.startY) * easedMovementProgress };
                    const receiverPos = (receiverTween.movementPath && utils.getPointOnPath) ? utils.getPointOnPath(receiverTween.movementPath, easedMovementProgress) : { x: receiverTween.startX + (receiverTween.endX - receiverTween.startX) * easedMovementProgress, y: receiverTween.startY + (receiverTween.endY - receiverTween.startY) * easedMovementProgress };

                    if (easedMovementProgress < (CONSTANTS.PASS_RATIO || 0.8)) {
                        const ballX = passerPos.x + (receiverPos.x - passerPos.x) * passProgress;
                        const ballY = passerPos.y + (receiverPos.y - passerPos.y) * passProgress;
                        renderer.drawBall(ballX, ballY, false, pass.ball, p_ctx, getCoordsWithRect);
                    }
                }
            });
        }
    },

    // ===============================================
    // LECTURE VISUELLE SUR ECRAN
    // ===============================================
    play: function() {
        if (window.ORB.playbookState.scenes.length <= 1) return alert("Il faut au moins 2 scènes pour animer.");

        window.ORB.animationState.isRecording = false;
        
        if(this.playerModal) this.playerModal.classList.remove('hidden');

        requestAnimationFrame(() => {
            const courtView = document.body.classList.contains('view-half-court') ? 'half' : 'full';
            window.ORB.animationState.view = courtView;

            const animContainer = document.getElementById('animation-container');
            if(animContainer) animContainer.style.aspectRatio = (courtView === 'half') ? '140 / 150' : '280 / 150';
            
            const courtSvg = document.getElementById('court-svg').cloneNode(true);
            if (courtView === 'half') {
                courtSvg.setAttribute('viewBox', '0 0 140 150');
                const logo = courtSvg.querySelector('.center-court-logo');
                if (logo) logo.style.display = 'none';
            } else {
                courtSvg.setAttribute('viewBox', '0 0 280 150');
            }
            
            const bgContainer = document.getElementById('animation-court-background');
            if(bgContainer) bgContainer.innerHTML = courtSvg.outerHTML;

            const animRect = animContainer.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            this.animCanvas.width = animRect.width * dpr;
            this.animCanvas.height = animRect.height * dpr;
            this.animCtx.setTransform(1, 1);
            this.animCtx.scale(dpr, dpr); // Mise à l'échelle Retina pure

            this.prepareStoryboard(courtView);
            this.startLoop();
        });
    },

    // ===============================================
    // EXPORT VIDÉO (.WEBM) AVEC CCAPTURE
    // ===============================================
    exportVideo: function() {
        if (window.ORB.playbookState.scenes.length <= 1) return alert("Il faut au moins 2 scènes pour exporter une vidéo.");
        if (typeof CCapture === 'undefined') return alert("Librairie CCapture non chargée.");

        window.ORB.animationState.isRecording = true;
        
        if(this.playerModal) this.playerModal.classList.remove('hidden');

        requestAnimationFrame(() => {
            const courtView = document.body.classList.contains('view-half-court') ? 'half' : 'full';
            window.ORB.animationState.view = courtView;

            const animContainer = document.getElementById('animation-container');
            if(animContainer) animContainer.style.aspectRatio = (courtView === 'half') ? '140 / 150' : '280 / 150';
            
            const courtSvg = document.getElementById('court-svg').cloneNode(true);
            if (courtView === 'half') {
                courtSvg.setAttribute('viewBox', '0 0 140 150');
                const logo = courtSvg.querySelector('.center-court-logo');
                if (logo) logo.style.display = 'none';
            } else {
                courtSvg.setAttribute('viewBox', '0 0 280 150');
            }
            
            // On cache le fond HTML car on va le dessiner en dur sur le canvas pour la vidéo
            const bgContainer = document.getElementById('animation-court-background');
            if(bgContainer) bgContainer.innerHTML = ''; 

            // Configuration Canvas HD pour la vidéo
            const logicalWidth = courtView === 'half' ? 140 : 280;
            const logicalHeight = 150;
            const scale = 4; // Ratio de zoom vidéo
            
            this.animCanvas.width = logicalWidth * scale;
            this.animCanvas.height = logicalHeight * scale;
            this.animCtx.setTransform(1, 1);
            // PAS DE SCALE ICI ! Le paramètre p_rect dans le render gère déjà la taille.

            this.prepareStoryboard(courtView);
            this.totalFrames = Math.floor((window.ORB.animationState.totalDuration / 1000) * 30); 
            this.currentFrame = 0;

            this.capturer = new CCapture({ 
                format: 'webm', 
                framerate: 30,
                verbose: false,
                display: true
            });

            // Conversion du terrain SVG en Image pour le fond
            const xml = new XMLSerializer().serializeToString(courtSvg);
            const svg64 = btoa(unescape(encodeURIComponent(xml)));
            this.bgImage = new Image();
            this.bgImage.onload = () => {
                this.capturer.start();
                window.ORB.animationState.isPlaying = true;
                this.updateIcons();
                this.loopVideo(); 
            };
            this.bgImage.src = 'data:image/svg+xml;base64,' + svg64;
        });
    },

    startLoop: function() {
        window.ORB.animationState.isPlaying = true;
        window.ORB.animationState.isFinished = false;
        window.ORB.animationState.startTime = performance.now() - window.ORB.animationState.elapsedOffset;
        this.updateIcons();
        this.loopPlayback();
    },

    resumeLoop: function() {
        window.ORB.animationState.isPlaying = true;
        window.ORB.animationState.startTime = performance.now() - window.ORB.animationState.elapsedOffset;
        this.updateIcons();
        this.loopPlayback(); 
    },

    pauseLoop: function() {
        window.ORB.animationState.isPlaying = false;
        if (this.animReq) cancelAnimationFrame(this.animReq);
        this.updateIcons();
    },

    stopLoop: function() {
        window.ORB.animationState.isPlaying = false;
        if (this.animReq) cancelAnimationFrame(this.animReq);
        
        if (window.ORB.animationState.isRecording && this.capturer) {
            this.capturer.stop();
            this.capturer.save();
            window.ORB.animationState.isRecording = false;
            if(this.playerModal) this.playerModal.classList.add('hidden'); 
        }
        this.updateIcons();
    },

    // Boucle d'écran (Fluide)
    loopPlayback: function() {
        if (!window.ORB.animationState.isPlaying) return;

        const now = performance.now();
        window.ORB.animationState.elapsedOffset = now - window.ORB.animationState.startTime;

        if (window.ORB.animationState.elapsedOffset >= window.ORB.animationState.totalDuration) {
            window.ORB.animationState.elapsedOffset = window.ORB.animationState.totalDuration;
            
            const rect = document.getElementById('animation-container').getBoundingClientRect();
            this.animCtx.clearRect(0, 0, this.animCanvas.width, this.animCanvas.height);
            this.renderAnimationFrameToContext(this.animCtx, rect, window.ORB.animationState.totalDuration, window.ORB.animationState);
            
            window.ORB.animationState.isPlaying = false;
            window.ORB.animationState.isFinished = true;
            this.updateIcons();
            return;
        }

        const rect = document.getElementById('animation-container').getBoundingClientRect();
        this.animCtx.clearRect(0, 0, this.animCanvas.width, this.animCanvas.height);
        this.renderAnimationFrameToContext(this.animCtx, rect, window.ORB.animationState.elapsedOffset, window.ORB.animationState);
        
        if (this.timeDisplay) {
            const time = (window.ORB.animationState.elapsedOffset / 1000).toFixed(1);
            const totalTime = (window.ORB.animationState.totalDuration / 1000).toFixed(1);
            this.timeDisplay.textContent = `${time}s / ${totalTime}s`;
        }

        this.animReq = requestAnimationFrame(() => this.loopPlayback());
    },

    // Boucle de Vidéo (Image par image forcée)
    loopVideo: function() {
        if (!window.ORB.animationState.isPlaying) return;

        if (this.currentFrame >= this.totalFrames) {
            this.stopLoop();
            return;
        }
        
        const timeElapsed = (this.currentFrame / 30) * 1000;
        
        // Rect virtuel correspondant à la taille HD
        const hdRect = { width: this.animCanvas.width, height: this.animCanvas.height, left: 0, top: 0 };

        this.animCtx.clearRect(0, 0, this.animCanvas.width, this.animCanvas.height);
        
        // Dessin manuel du fond pour l'enregistrement
        if (this.bgImage) {
            this.animCtx.fillStyle = '#BFA98D';
            this.animCtx.fillRect(0, 0, this.animCanvas.width, this.animCanvas.height);
            this.animCtx.drawImage(this.bgImage, 0, 0, this.animCanvas.width, this.animCanvas.height);
        }

        this.renderAnimationFrameToContext(this.animCtx, hdRect, timeElapsed, window.ORB.animationState);
        
        if (this.capturer) this.capturer.capture(this.animCanvas);
        
        if (this.timeDisplay) {
            const time = (timeElapsed / 1000).toFixed(1);
            const totalTime = (window.ORB.animationState.totalDuration / 1000).toFixed(1);
            this.timeDisplay.textContent = `${time}s / ${totalTime}s [REC]`;
        }

        this.currentFrame++;
        setTimeout(() => this.loopVideo(), 0); 
    }
};