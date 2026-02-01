/**
 * Collectibles Game Module
 * Spawns objects on the trail and detects hand gestures to collect them
 */

class CollectiblesGame {
    constructor(headTracker = null) {
        this.collectibles = [];
        this.collectedCount = 0;
        this.isActive = false;
        this.spawnInterval = null;
        this.animationFrame = null;
        this.handDetector = null;
        this.poseDetector = null;
        this.videoElement = null;
        this.canvas = null;
        this.ctx = null;
        this.debugCanvas = null;
        this.debugCtx = null;
        this.lastHandPosition = null;
        this.lastHandKeypoints = null;
        this.isGrabbing = false;
        this.isPointing = false; // Track if showing pointing gesture (dagger mode)
        this.isOpenHand = false; // Track if hand is open (5 fingers splayed)
        this.inventoryOpen = false; // Track if inventory panel is open
        this.lastMissTime = 0;
        this.missThrottleDelay = 500; // Only show miss feedback every 500ms
        this.headTracker = headTracker; // Reference to head tracker for face position
        
        // Shield gesture tracking
        this.lastShieldGestureTime = 0;
        this.shieldDeactivateTimer = null;
        this.shieldDeactivateDelay = 1000; // 1 second
        
        // Dagger stab tracking
        this.lastDaggerStabTime = 0;
        this.daggerCooldown = 1500; // 1.5 seconds between stabs
        
        // Fireball spell tracking
        this.lastFireballCastTime = 0;
        this.fireballCooldown = 1000; // 1 second between casts
        this.fireballCost = 10; // Magic points cost
        this.fireballProjectiles = []; // Track active fireballs
        
        // Electrified pinch tracking
        this.electrifiedPinchesRemaining = 0;
        
        // Hand tracking persistence (reduce false positives from face detection)
        this.handHistory = []; // Store last N hand detections
        this.handHistoryMaxLength = 5; // Keep last 5 frames
        this.handPersistenceThreshold = 3; // Hand must appear in 3/5 frames to be considered real
        
        // Toad tongue tracking
        this.tongueStrikesRemaining = 0;
        this.lastTongueStrikeTime = 0;
        this.tongueStrikeCooldown = 800; // 800ms between tongue strikes
        
        // Inventory tracking by type
        this.inventory = {
            'acorn': 0,
            'mushroom': 0,
            'crystal': 0,
            'leaf': 0,
            'bolt': 0
        };
        
        // Equipment inventory (unequipped items)
        this.equipment = {
            head: {
                'simple cap': 1  // DEBUG: Start with simple cap
            },
            armor: {
                'cotton overalls': 1,  // DEBUG: Start with cotton overalls
                'buckler': 0  // Buckler shield (legacy)
            },
            feet: {
                'sandals': 1  // DEBUG: Start with sandals
            },
            weapon: {
                'simple knife': 1  // DEBUG: Start with simple knife
            },
            shield: {
                'oak log shield': 1  // DEBUG: Start with oak log shield
            },
            accessory: {
                'Ring of Fireball': 1  // DEBUG: Start with Ring of Fireball
            }
        };
        
        // Armor inventory (legacy - for backwards compatibility)
        this.armor = {
            'buckler': 0
        };
        
        // Track equipped items
        this.equippedItems = {
            head: null,
            armor: null,
            feet: null,
            weapon: null,
            shield: null,
            accessory1: null,
            accessory2: null
        };
        
        // Track equipped shield (buckler = level 1) - legacy
        this.equippedShield = null; // Will be set to 'buckler' when acquired
        
        // Potion inventory
        this.potions = {
            'healing': 0,
            'electricity': 0,
            'mana': 1,  // DEBUG: Start with 1 mana potion
            'toadtongue': 0
        };
        
        // Separate bolt counter for crossbow ammunition
        this.boltCount = 0;
        
        // Crossbow firing tracking
        this.lastFireTime = 0;
        this.fireDelay = 500; // Minimum 500ms between shots
        this.boltProjectiles = []; // Active bolt projectiles on screen
        
        // Enemy system
        this.enemies = []; // Active enemies on screen
        this.collectiblesSpawnedSinceLastEnemy = 0;
        this.enemySpawnInterval = { min: 10, max: 20 }; // Spawn after 10-20 collectibles
        this.nextEnemySpawnAt = 2; // DEBUG: First rat after 2 objects
        this.isFirstEnemySpawn = true; // Track if this is the first spawn
        
        // Boss system
        this.bossSpawned = false;
        this.bossSpawnTriggered = false;
        this.videoPausedForBoss = false;
        
        // Rat video system
        this.ratVideos = {
            approaching: null,
            attack1: null,
            attack2: null,
            leaving: null,
            menacing: null,
            pacing: null
        };
        this.videosLoaded = false;
        this.loadRatVideos();
        
        // Timing
        this.minSpawnTime = 10000; // 10 seconds
        this.maxSpawnTime = 20000; // 20 seconds
        
        // Collectible properties
        this.types = [
            { emoji: '🌰', name: 'acorn', size: 40 },
            { emoji: '🍄', name: 'mushroom', size: 45 },
            { emoji: '💎', name: 'crystal', size: 35 },
            { emoji: '🍂', name: 'leaf', size: 38 },
            { emoji: '➳', name: 'bolt', size: 42 }
        ];
        
        this.init();
    }

    /**
     * Load rat animation videos
     */
    loadRatVideos() {
        const videoNames = ['approaching', 'attack1', 'attack2', 'leaving', 'menacing', 'pacing'];
        let loadedCount = 0;
        
        videoNames.forEach(name => {
            const video = document.createElement('video');
            video.src = `resources/enemies/rat/optimized/${name}.webm`;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto'; // Preload for better mobile performance
            
            video.addEventListener('loadeddata', () => {
                loadedCount++;
                console.log(`📹 Loaded ${name}.webm (${loadedCount}/${videoNames.length})`);
                if (loadedCount === videoNames.length) {
                    this.videosLoaded = true;
                    console.log('✅ All rat videos loaded');
                }
            });
            
            video.addEventListener('error', (e) => {
                console.warn(`⚠️ Failed to load ${name}.webm:`, e);
                loadedCount++;
                if (loadedCount === videoNames.length) {
                    console.warn('⚠️ Some videos failed, will use emoji fallback');
                    this.videosLoaded = true; // Still mark as "loaded" so game continues
                }
            });
            
            // Try to load the video
            video.load();
            
            this.ratVideos[name] = video;
        });
    }

    /**
     * Initialize the collectibles game
     */
    async init() {
        console.log('Initializing collectibles game...');
        
        // Get canvas for drawing collectibles
        this.canvas = document.getElementById('collectiblesCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }
        
        // Get debug canvas for hand tracking visualization
        this.debugCanvas = document.getElementById('handDebugCanvas');
        if (this.debugCanvas) {
            this.debugCtx = this.debugCanvas.getContext('2d');
        }
        
        // Get display debug canvas for debug mode
        this.debugCanvasDisplay = document.getElementById('handDebugCanvasDisplay');
        if (this.debugCanvasDisplay) {
            this.debugCtxDisplay = this.debugCanvasDisplay.getContext('2d');
        }
        
        // Set up inventory panel click handlers
        this.setupInventoryPanel();
        
        // Load hand detection model
        try {
            if (typeof handPoseDetection !== 'undefined') {
                const model = handPoseDetection.SupportedModels.MediaPipeHands;
                const detectorConfig = {
                    runtime: 'mediapipe',
                    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
                    modelType: 'lite', // Use lite model for better performance
                    maxHands: 2 // Detect up to 2 hands for shield gesture
                };
                
                this.handDetector = await handPoseDetection.createDetector(model, detectorConfig);
                console.log('Hand detection model loaded');
            } else {
                console.warn('Hand pose detection not available');
            }
        } catch (error) {
            console.error('Error loading hand detection:', error);
        }
        
        // Pose detection is no longer needed (removed fist+elbow gesture in favor of two-fist gesture)
        // Keeping poseDetector property as null for backward compatibility
        this.poseDetector = null;
    }

    /**
     * Start the collectibles game
     */
    start(videoElement) {
        if (this.isActive) return;
        
        this.isActive = true;
        this.videoElement = videoElement;
        
        // Set up tongue detection callback for crossbow firing / tongue strike
        if (this.headTracker) {
            console.log('🎯 Setting up tongue callback...');
            this.headTracker.onTongue(() => {
                console.log(`👅 Tongue out detected, boltCount=${this.boltCount}`);
                
                const now = Date.now();
                if (now - this.lastTongueStrikeTime < this.tongueStrikeCooldown) {
                    console.log('⏱️ Tongue strike on cooldown');
                    return;
                }
                
                // Use center of screen as striking position
                const centerX = this.canvas ? this.canvas.width / 2 : 320;
                const centerY = this.canvas ? this.canvas.height / 2 : 240;
                console.log(`👅 Firing tongue strike from center (${centerX}, ${centerY})`);
                this.performTongueStrike({ x: centerX, y: centerY });
            });
            console.log('✅ Tongue callback registered');
        } else {
            console.warn('⚠️ No headTracker available for tongue detection!');
        }
        
        // Fallback: Set up tongue detection for crossbow if available
        if (this.headTracker && this.boltCount > 0) {
            // Crossbow firing is handled separately if needed
        }
        
        // Reset canvas sizes to match video (maintain aspect ratio)
        if (this.canvas && this.videoElement) {
            const videoWidth = this.videoElement.videoWidth || 640;
            const videoHeight = this.videoElement.videoHeight || 480;
            
            this.canvas.width = videoWidth;
            this.canvas.height = videoHeight;
            
            // Also set debug canvas
            if (this.debugCanvas) {
                this.debugCanvas.width = videoWidth;
                this.debugCanvas.height = videoHeight;
            }
            
            console.log(`Canvas size set to ${videoWidth}x${videoHeight}`);
            
            // Size display debug canvas to match display video
            if (this.debugCanvasDisplay) {
                const displayVideo = document.getElementById('cameraFeedDisplay');
                if (displayVideo) {
                    const updateDisplayCanvasSize = () => {
                        if (displayVideo.videoWidth > 0) {
                            this.debugCanvasDisplay.width = displayVideo.videoWidth;
                            this.debugCanvasDisplay.height = displayVideo.videoHeight;
                            console.log(`Display debug canvas sized to: ${displayVideo.videoWidth}x${displayVideo.videoHeight}`);
                        }
                    };
                    displayVideo.addEventListener('loadedmetadata', updateDisplayCanvasSize);
                    updateDisplayCanvasSize();
                }
            }
        }
        
        // Start spawning collectibles
        this.scheduleNextSpawn();
        
        // Start game loop
        this.gameLoop();
        
        // Initialize bolt counter display
        this.updateBoltCounter();
        
        // Initialize potion display
        this.updatePotionDisplay();
        
        // Create inventory panel (so XP elements exist for updates)
        if (!document.getElementById('inventoryPanel')) {
            const panel = this.createInventoryPanel();
            panel.style.display = 'none'; // Start hidden
        }
        
        console.log('Collectibles game started');
    }

    /**
     * Stop the collectibles game
     */
    stop() {
        this.isActive = false;
        
        if (this.spawnInterval) {
            clearTimeout(this.spawnInterval);
            this.spawnInterval = null;
        }
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Clear all collectibles
        this.collectibles = [];
        this.clearCanvas();
        
        console.log('Collectibles game stopped');
    }

    /**
     * Schedule the next collectible spawn
     */
    scheduleNextSpawn() {
        if (!this.isActive) return;
        
        const delay = Math.random() * (this.maxSpawnTime - this.minSpawnTime) + this.minSpawnTime;
        
        this.spawnInterval = setTimeout(() => {
            // Don't spawn new collectibles if there are enemies on screen
            if (this.enemies.length === 0) {
                this.spawnCollectible();
            }
            this.scheduleNextSpawn();
        }, delay);
    }

    /**
     * Spawn a new collectible
     */
    spawnCollectible() {
        if (!this.canvas) return;
        
        const type = this.types[Math.floor(Math.random() * this.types.length)];
        
        const collectible = {
            id: Date.now() + Math.random(),
            type: type,
            x: Math.random() * (this.canvas.width - 100) + 50, // Random horizontal position
            y: this.canvas.height * 0.67, // Start at 67% down (1/3 from bottom)
            initialY: this.canvas.height * 0.67,
            size: type.size,
            speed: 0.15 + Math.random() * 0.1, // Reduced to half speed (0.15-0.25)
            scale: 0.3, // Start much smaller (was 0.6)
            maxScale: 1.5, // Grow larger (was 1.2)
            createdAt: Date.now()
        };
        
        this.collectibles.push(collectible);
        console.log(`Spawned ${type.name} at (${collectible.x.toFixed(0)}, ${collectible.y.toFixed(0)})`);
        
        // Track spawns for enemy spawning
        this.collectiblesSpawnedSinceLastEnemy++;
        console.log(`📊 Collectibles since last enemy: ${this.collectiblesSpawnedSinceLastEnemy}/${this.nextEnemySpawnAt}`);
        
        if (this.collectiblesSpawnedSinceLastEnemy >= this.nextEnemySpawnAt) {
            this.spawnEnemy();
            this.collectiblesSpawnedSinceLastEnemy = 0;
            
            // After first spawn, use normal 10-20 range
            if (this.isFirstEnemySpawn) {
                this.isFirstEnemySpawn = false;
                console.log(`✅ First rat spawned. Next rats will spawn after 10-20 collectibles.`);
            }
            this.nextEnemySpawnAt = this.getRandomInt(this.enemySpawnInterval.min, this.enemySpawnInterval.max);
            console.log(`🎲 Next enemy will spawn after ${this.nextEnemySpawnAt} more collectibles`);
        }
    }
    
    /**
     * Get random integer between min and max (inclusive)
     */
    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    /**
     * Spawn an enemy (rat)
     */
    spawnEnemy() {
        if (!this.canvas) return;
        
        // Debug: Check if enemy-sequences.js loaded
        console.log(`🔍 ENEMY_SEQUENCES exists: ${!!window.ENEMY_SEQUENCES}, rat array: ${window.ENEMY_SEQUENCES?.rat?.length || 0} sequences`);
        
        // Select a random sequence from enemy-sequences.js
        let sequence = null;
        if (window.ENEMY_SEQUENCES && window.ENEMY_SEQUENCES.rat && window.ENEMY_SEQUENCES.rat.length > 0) {
            // Find DEFAULT sequence first
            sequence = window.ENEMY_SEQUENCES.rat.find(seq => seq.name.includes('DEFAULT'));
            if (!sequence) {
                // If no DEFAULT, pick random sequence
                const sequences = window.ENEMY_SEQUENCES.rat;
                sequence = sequences[Math.floor(Math.random() * sequences.length)];
            }
            console.log(`🎬 Selected sequence: ${sequence.name} (${sequence.steps.length} steps)`);
        } else {
            console.error(`❌ ENEMY_SEQUENCES not found! Cannot spawn enemy with sequence.`);
        }
        
        // Position rat on the trail (1/3 from bottom, same as collectibles)
        const y = this.canvas.height * 0.67; // 1/3 from bottom
        
        // Get initial position from first step if sequence exists
        let initialPos = 0;
        if (sequence && sequence.steps.length > 0) {
            initialPos = sequence.steps[0].startPos;
            console.log(`📍 Initial position from sequence: ${initialPos}`);
        } else {
            console.warn(`⚠️ No sequence found - enemy will use default position 0`);
        }
        
        const enemy = {
            id: Date.now() + Math.random(),
            type: 'rat',
            emoji: '🐀',
            x: -100, // Will be calculated from enemyX in updateEnemies
            y: y,
            size: 60,
            health: 100,
            maxHealth: 100,
            // Sequence-based animation
            sequence: sequence,
            currentStepIndex: 0,
            stepStartTime: Date.now(),
            // Position animation
            enemyX: initialPos, // Normalized position 0-100, start at first step's startPos
            targetX: initialPos,
            positionStartX: initialPos,
            positionTransitionStart: 0,
            // Video playback
            currentVideo: null,
            videoStartTime: 0,
            // Combat
            lastPinchHitTime: 0,
            createdAt: Date.now()
        };
        
        // Start first step if sequence exists
        if (sequence && sequence.steps.length > 0) {
            console.log(`🚀 Calling startEnemyStep for first step...`);
            this.startEnemyStep(enemy, 0);
        } else {
            console.warn(`⚠️ Cannot start sequence - sequence is null or has no steps`);
        }
        
        this.enemies.push(enemy);
        console.log(`🐀 RAT SPAWNED with sequence: ${sequence ? 'YES' : 'NO'}, enemyX=${enemy.enemyX}, x=${enemy.x}`);
    }
    
    /**
     * Start a specific step in an enemy's sequence
     */
    startEnemyStep(enemy, stepIndex) {
        if (!enemy.sequence || stepIndex >= enemy.sequence.steps.length) {
            console.warn(`⚠️ Cannot start step ${stepIndex} - no sequence or index out of bounds`);
            return;
        }
        
        const step = enemy.sequence.steps[stepIndex];
        enemy.currentStepIndex = stepIndex;
        enemy.stepStartTime = Date.now();
        
        // Set position targets
        // For first step, use step.startPos as current position
        if (stepIndex === 0) {
            enemy.enemyX = step.startPos;
            enemy.positionStartX = step.startPos;
        } else {
            enemy.positionStartX = enemy.enemyX;
        }
        enemy.targetX = step.endPos;
        enemy.positionTransitionStart = Date.now();
        
        console.log(`▶️ Step ${stepIndex + 1}/${enemy.sequence.steps.length}: ${step.animation} (${step.startPos}→${step.endPos}) for ${step.duration}ms, enemyX=${enemy.enemyX}`);
        
        // Start video for this animation
        if (!this.videosLoaded) {
            console.warn(`⚠️ Videos not loaded yet - cannot play ${step.animation}`);
            return;
        }
        
        const video = this.ratVideos[step.animation];
        if (video) {
            enemy.currentVideo = step.animation;
            video.currentTime = 0;
            video.loop = false; // Ensure videos don't loop during sequences
            
            // Mobile browsers need video to be muted for autoplay
            video.muted = true;
            
            video.play().then(() => {
                console.log(`🎬 Playing video: ${step.animation}`);
            }).catch(e => {
                console.warn(`⚠️ Video play failed (using emoji fallback): ${e.message}`);
                enemy.currentVideo = null; // Force emoji fallback
            });
        } else {
            console.warn(`⚠️ Video not found for animation: ${step.animation}`);
        }
    }

    /**
     * Spawn the final boss (giant rat)
     */
    spawnBoss() {
        if (!this.canvas || this.bossSpawned) return;
        
        // Position boss in center of screen
        const startX = -200; // Boss starts further left
        const targetX = this.canvas.width * 0.5;
        const y = this.canvas.height * 0.67; // 1/3 from bottom
        
        // Calculate approach speed based on video duration (3x for faster movement)
        const approachDistance = targetX - startX;
        const approachDuration = this.ratVideos.approaching?.duration || 8;
        const approachSpeed = (approachDistance / approachDuration) * 3;
        
        const boss = {
            id: Date.now() + Math.random(),
            type: 'boss',
            emoji: '🐀',
            x: startX, // Start off-screen left
            y: y,
            targetX: targetX,
            initialX: targetX,
            size: 180, // 3x normal size (60 * 3)
            health: 1000, // 10x normal health (100 * 10)
            maxHealth: 1000,
            state: 'approaching',
            attackCount: 0,
            maxAttacks: 999, // Boss fights until defeated
            lastAttackTime: Date.now(),
            nextAttackDelay: this.getRandomInt(2000, 5000), // Slightly faster attacks
            rearingStartTime: 0,
            rearingDuration: 500,
            paceDirection: 1,
            paceSpeed: 30, // Slower pacing for boss
            paceRange: 100,
            jeerBobSpeed: 1.5,
            lastPinchHitTime: 0,
            createdAt: Date.now(),
            isBoss: true,
            damageMultiplier: 2, // Boss does 2x damage
            // Video playback
            currentVideo: null,
            videoStartTime: 0,
            // Movement
            approachSpeed: approachSpeed,
            leavingSpeed: 0 // Will be calculated when leaving starts
        };
        
        this.enemies.push(boss);
        this.bossSpawned = true;
        console.log('👹 FINAL BOSS SPAWNED! Giant Rat with 10x health and 2x damage!');
        
        // Show boss entrance message
        this.showBossEntrance();
    }

    /**
     * Show boss entrance visual feedback
     */
    showBossEntrance() {
        const feedback = document.createElement('div');
        feedback.className = 'boss-entrance-feedback';
        feedback.innerHTML = '⚠️ FINAL BOSS ⚠️<br>GIANT RAT!';
        feedback.style.position = 'fixed';
        feedback.style.top = '50%';
        feedback.style.left = '50%';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '4rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#FF0000';
        feedback.style.textShadow = '0 0 20px #FFFF00, 0 0 40px #FF0000, 0 0 60px #000000, 4px 4px 8px #000000';
        feedback.style.animation = 'bossEntrancePulse 2s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '10000';
        feedback.style.textAlign = 'center';
        feedback.style.lineHeight = '1.2';
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 2000);
    }

    /**
     * Show boss victory visual feedback
     */
    showBossVictoryFeedback() {
        const feedback = document.createElement('div');
        feedback.className = 'boss-victory-feedback';
        feedback.innerHTML = '🏆 VICTORY! 🏆<br>+70 XP<br>🛡️ Buckler Shield';
        feedback.style.position = 'fixed';
        feedback.style.top = '50%';
        feedback.style.left = '50%';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '3.5rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#FFD700';
        feedback.style.textShadow = '0 0 20px #FFA500, 0 0 40px #FFD700, 0 0 60px #FFF, 4px 4px 8px #000000';
        feedback.style.animation = 'bossVictoryPulse 3s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '10000';
        feedback.style.textAlign = 'center';
        feedback.style.lineHeight = '1.3';
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 3000);
    }

    /**
     * Show enemy defeat visual feedback with XP earned
     */
    showEnemyDefeatFeedback(xpAmount) {
        const feedback = document.createElement('div');
        feedback.className = 'enemy-defeat-feedback';
        feedback.innerHTML = `💪 NICE! 💪<br>+${xpAmount} XP`;
        feedback.style.position = 'fixed';
        feedback.style.top = '50%';
        feedback.style.left = '50%';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '2.5rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#FFA500';
        feedback.style.textShadow = '0 0 15px #FFD700, 0 0 30px #FFA500, 0 0 45px #FF8C00, 3px 3px 6px #000000';
        feedback.style.animation = 'enemyDefeatPulse 1.5s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '10000';
        feedback.style.textAlign = 'center';
        feedback.style.lineHeight = '1.3';
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 1500);
    }

    /**
     * Spawn a collectible at a specific position (for bolt drops)
     */
    spawnCollectibleAt(x, y, type) {
        if (!this.canvas) return;
        
        const collectible = {
            id: Date.now() + Math.random(),
            type: type,
            x: x,
            y: y,
            initialY: y,
            size: type.size,
            speed: 0.15,
            scale: 1.0, // Start at full size since it's a dropped item
            maxScale: 1.0,
            createdAt: Date.now()
        };
        
        this.collectibles.push(collectible);
        console.log(`Spawned ${type.name} at (${x.toFixed(0)}, ${y.toFixed(0)}) from bolt drop`);
    }

    /**
     * Main game loop
     */
    async gameLoop() {
        if (!this.isActive) return;
        
        // Check for boss spawn timing (5 seconds before video ends)
        this.checkBossSpawnTiming();
        
        // Update collectibles
        this.updateCollectibles();
        
        // Detect hand gestures
        if (this.handDetector && this.videoElement) {
            await this.detectGesture();
        }
        
        // Draw everything
        this.draw();
        
        // Continue loop
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    /**
     * Check if it's time to spawn the boss (5 seconds before video ends)
     */
    checkBossSpawnTiming() {
        if (this.bossSpawnTriggered || this.bossSpawned) return;
        
        const app = window.app;
        if (!app || !app.videoPlayer) return;
        
        const currentTime = app.videoPlayer.getCurrentTime();
        const duration = app.videoPlayer.getDuration();
        
        // Check if we're within 2 minutes (120 seconds) of the end
        if (duration > 0 && currentTime > 0) {
            const timeRemaining = duration - currentTime;
            
            if (timeRemaining <= 120 && timeRemaining > 0) {
                // Trigger boss spawn
                this.bossSpawnTriggered = true;
                
                console.log(`👹 Boss spawning at ${currentTime.toFixed(1)}s (${timeRemaining.toFixed(1)}s remaining)`);
                
                // Spawn the boss (video continues playing)
                this.spawnBoss();
            }
        }
    }

    /**
     * Update all collectibles positions
     */
    updateCollectibles() {
        const now = Date.now();
        
        // Update regular collectibles
        this.collectibles = this.collectibles.filter(collectible => {
            // Move collectible forward (down and grow)
            const age = (now - collectible.createdAt) / 1000; // seconds
            collectible.y = collectible.initialY + (age * 50); // Move down 50px per second
            
            // Scale grows from 0.3 to 1.5 over the lifetime for perspective effect
            collectible.scale = Math.min(
                collectible.maxScale,
                0.3 + (age * 0.3) // Grow faster (was 0.6 + age * 0.15)
            );
            
            // Remove if past bottom of screen
            return collectible.y < this.canvas.height + 50;
        });
        
        // Update bolt projectiles
        this.boltProjectiles = this.boltProjectiles.filter(bolt => {
            const deltaTime = (now - bolt.createdAt) / 1000; // seconds since creation
            
            // Move bolt
            bolt.x += bolt.vx * (1/60); // Assuming ~60fps
            bolt.y += bolt.vy * (1/60);
            
            // Check collision with enemies
            if (this.enemies.length > 0) {
                const enemy = this.enemies[0]; // Target first enemy
                
                // Calculate distance to enemy
                const distance = Math.sqrt(
                    Math.pow(bolt.x - enemy.x, 2) + 
                    Math.pow(bolt.y - enemy.y, 2)
                );
                
                // Hit if within 40 pixels of enemy
                if (distance < 40) {
                    const damage = enemy.maxHealth * 0.5;
                    enemy.health = Math.max(0, enemy.health - damage);
                    console.log(`🎯 Bolt hit rat! Damage: ${damage.toFixed(1)}, Remaining health: ${enemy.health.toFixed(1)}`);
                    
                    // Show impact animation
                    this.showBoltImpactFeedback(enemy.x, enemy.y);
                    
                    return false; // Remove bolt after hitting
                }
            }
            
            // Check if bolt is still on screen and within lifetime
            const onScreen = bolt.x < this.canvas.width + 50 && bolt.x > -50 &&
                           bolt.y < this.canvas.height + 50 && bolt.y > -50;
            const withinLifetime = (now - bolt.createdAt) < bolt.lifetime;
            
            // If bolt goes off screen or expires, convert it to a collectible
            if (!onScreen || !withinLifetime) {
                // Create a new collectible at bolt's final position (if on screen)
                if (bolt.x >= 0 && bolt.x <= this.canvas.width && 
                    bolt.y >= 0 && bolt.y <= this.canvas.height) {
                    this.spawnCollectibleAt(bolt.x, bolt.y, bolt.type);
                }
                return false; // Remove bolt projectile
            }
            
            return true; // Keep bolt
        });
        
        // Update fireball projectiles
        this.fireballProjectiles = this.fireballProjectiles.filter(fireball => {
            // Move fireball
            fireball.x += fireball.vx * (1/60); // Assuming ~60fps
            fireball.y += fireball.vy * (1/60);
            
            // Check collision with enemies
            for (let i = 0; i < this.enemies.length; i++) {
                const enemy = this.enemies[i];
                
                // Calculate distance to enemy
                const distance = Math.sqrt(
                    Math.pow(fireball.x - enemy.x, 2) + 
                    Math.pow(fireball.y - enemy.y, 2)
                );
                
                // Hit if within 50 pixels of enemy
                if (distance < 50) {
                    enemy.health = Math.max(0, enemy.health - fireball.damage);
                    console.log(`🔥 Fireball hit rat! Damage: ${fireball.damage.toFixed(1)}, Remaining health: ${enemy.health.toFixed(1)}`);
                    
                    // Show impact animation
                    this.showFireballImpactFeedback(enemy.x, enemy.y, fireball.damage);
                    
                    return false; // Remove fireball after hitting
                }
            }
            
            // Check if fireball is still on screen and within lifetime
            const onScreen = fireball.x < this.canvas.width + 50 && fireball.x > -50 &&
                           fireball.y < this.canvas.height + 50 && fireball.y > -50;
            const withinLifetime = (now - fireball.createdAt) < fireball.lifetime;
            
            return onScreen && withinLifetime; // Keep fireball
        });
        
        // Update enemies
        this.updateEnemies();
    }
    
    /**
     * Update enemy states and behaviors
     */
    updateEnemies() {
        const now = Date.now();
        
        this.enemies = this.enemies.filter(enemy => {
            // Debug: Log enemy state occasionally
            if (!enemy.updateDebugCounter) enemy.updateDebugCounter = 0;
            enemy.updateDebugCounter++;
            if (enemy.updateDebugCounter % 120 === 0) { // Every 2 seconds
                console.log(`🐀 Enemy update: sequence=${!!enemy.sequence}, x=${enemy.x}, enemyX=${enemy.enemyX}, health=${enemy.health}`);
            }
            
            // Check if enemy is dead - remove immediately and award XP
            if (enemy.health <= 0 && !enemy.isDead) {
                enemy.isDead = true;
                console.log(`💀 Enemy defeated - removing immediately`);
                const app = window.app;
                if (app && app.addXP) {
                    app.addXP(10);
                    this.showEnemyDefeatFeedback(10);
                }
                return false; // Remove enemy
            }
            
            // Sequence-based animation
            if (enemy.sequence) {
                const step = enemy.sequence.steps[enemy.currentStepIndex];
                if (!step) return false; // No more steps, remove enemy
                
                const stepElapsed = now - enemy.stepStartTime;
                const stepProgress = Math.min(stepElapsed / step.duration, 1);
                
                // Update position with ease-in-out
                const easeProgress = this.easeInOutCubic(stepProgress);
                enemy.enemyX = enemy.positionStartX + (enemy.targetX - enemy.positionStartX) * easeProgress;
                
                // Convert normalized position (0-100) to canvas coordinates
                // 0 = off-screen left (center of video off-left), 50 = center of screen, 100 = off-screen right
                const video = this.ratVideos[step.animation];
                const videoWidth = video ? video.videoWidth || 800 : 800;
                const canvasWidth = this.canvas.width;
                
                // Map 0-100 to actual screen positions (enemy.x is the CENTER of the video)
                // 0 = fully off-left (center at -videoWidth/2)
                // 50 = center of screen (center at canvasWidth/2)
                // 100 = fully off-right (center at canvasWidth + videoWidth/2)
                const leftEdge = -videoWidth / 2;
                const center = canvasWidth / 2;
                const rightEdge = canvasWidth + videoWidth / 2;
                
                if (enemy.enemyX <= 50) {
                    // Moving from left to center
                    const t = enemy.enemyX / 50;
                    enemy.x = leftEdge + (center - leftEdge) * t;
                } else {
                    // Moving from center to right
                    const t = (enemy.enemyX - 50) / 50;
                    enemy.x = center + (rightEdge - center) * t;
                }
                
                // Debug logging every 60 frames (~1 second)
                if (!enemy.debugFrameCount) enemy.debugFrameCount = 0;
                enemy.debugFrameCount++;
                if (enemy.debugFrameCount % 60 === 0) {
                    console.log(`🐀 Enemy position: enemyX=${enemy.enemyX.toFixed(1)}, x=${enemy.x.toFixed(1)}, step=${enemy.currentStepIndex + 1}/${enemy.sequence.steps.length}, progress=${(stepProgress * 100).toFixed(0)}%`);
                }
                
                // Check if step is complete
                if (stepProgress >= 1) {
                    const nextStepIndex = enemy.currentStepIndex + 1;
                    if (nextStepIndex < enemy.sequence.steps.length) {
                        // Start next step
                        this.startEnemyStep(enemy, nextStepIndex);
                    } else {
                        // Sequence complete - remove enemy
                        console.log(`✅ Enemy sequence complete - removing`);
                        return false;
                    }
                }
                
                // Handle attacks - if step animation is attack1 or attack2, deal damage (but not if dead)
                if (!enemy.isDead && (step.animation === 'attack1' || step.animation === 'attack2') && !enemy.hasAttackedThisStep) {
                    enemy.hasAttackedThisStep = true;
                    this.enemyAttack(enemy);
                } else if (step.animation !== 'attack1' && step.animation !== 'attack2') {
                    enemy.hasAttackedThisStep = false; // Reset for next attack step
                }
            }
            
            return true; // Keep enemy
        });
    }
    
    /**
     * Easing function for smooth animation
     */
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    /**
     * Enemy performs attack on player
     */
    enemyAttack(enemy) {
        const isBoss = enemy.isBoss || false;
        const attackLabel = isBoss ? '👹 BOSS ATTACKS!' : `⚔️ RAT ATTACKS! (${enemy.attackCount + 1}/${enemy.maxAttacks})`;
        console.log(attackLabel);
        
        // Base damage is 10% of max health
        const app = window.app;
        console.log(`🔍 Checking for app reference:`, !!app);
        
        if (app && app.health !== undefined && app.maxHealth !== undefined) {
            const baseDamage = app.maxHealth * 0.1;
            const damageMultiplier = enemy.damageMultiplier || 1;
            const damage = baseDamage * damageMultiplier;
            
            const oldHealth = app.health;
            app.health = Math.max(0, app.health - damage);
            app.updateStatBars();
            
            const damageLabel = isBoss ? `💀 Player took ${damage.toFixed(1)} BOSS DAMAGE (2x)!` : `💔 Player took ${damage.toFixed(1)} damage!`;
            console.log(`${damageLabel} Health: ${oldHealth.toFixed(1)} → ${app.health.toFixed(1)}/${app.maxHealth}`);
        } else {
            console.error(`❌ Cannot damage player - app not found or health undefined. app=${!!app}, health=${app?.health}, maxHealth=${app?.maxHealth}`);
        }
    }

    /**
     * Detect hand gesture for grabbing
     */
    async detectGesture() {
        if (!this.videoElement || this.videoElement.readyState !== 4) return;
        
        // Clear debug canvas
        if (this.debugCtx && this.debugCanvas) {
            this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        }
        
        // Clear display debug canvas
        if (this.debugCtxDisplay && this.debugCanvasDisplay) {
            this.debugCtxDisplay.clearRect(0, 0, this.debugCanvasDisplay.width, this.debugCanvasDisplay.height);
        }
        
        try {
            const hands = await this.handDetector.estimateHands(this.videoElement, {
                flipHorizontal: true
            });
            
            // Debug: log hand count every 30 frames
            if (!this.handCountDebugCounter) this.handCountDebugCounter = 0;
            this.handCountDebugCounter++;
            if (this.handCountDebugCounter >= 30) {
                console.log(`👋 Hand detection loop - Video ready: ${this.videoElement ? this.videoElement.readyState === 4 : 'no video'}, Hands detected: ${hands ? hands.length : 0}, Canvas size: ${this.debugCanvas ? this.debugCanvas.width + 'x' + this.debugCanvas.height : 'no canvas'}`);
                this.handCountDebugCounter = 0;
            }
            
            if (hands && hands.length > 0) {
                // Check for two-hand gestures first (requires 2 hands)
                if (hands.length >= 2) {
                    // Always force debug for two-hand mode
                    console.log(`🖐️ Two hands detected - checking for shield gesture...`);
                    
                    // Disable pinch interactions when two hands detected
                    this.isGrabbing = false;
                    this.lastHandPosition = null;
                    
                    // Check for shield gesture
                    this.checkTwoFistShieldGesture(hands, true);
                    
                    // Draw the hands for debugging - explicitly pass false for isGrabbing
                    hands.forEach(h => this.drawHandDebug(h, false));
                    return;
                }
                
                // Use the first hand for game interactions (only when single hand detected)
                const hand = hands[0];
                
                // Track hand in history for persistence checking
                this.addHandToHistory(hand);
                
                // Filter out hands that are likely the face
                if (this.isHandWithinFace(hand)) {
                    // Ignore this detection - it's likely the user's face
                    this.lastHandPosition = null;
                    this.lastHandKeypoints = null;
                    this.isGrabbing = false;
                    return;
                }
                
                // Check if hand has sufficient persistence (reduces false positives)
                if (!this.isHandPersistent()) {
                    // Hand hasn't been detected consistently enough - might be a false positive
                    this.lastHandPosition = null;
                    this.lastHandKeypoints = null;
                    this.isGrabbing = false;
                    return;
                }
                
                // Store keypoints for drawing on video overlay
                this.lastHandKeypoints = hand.keypoints;
                
                // Draw hand keypoints for debugging (draw all hands)
                hands.forEach(h => this.drawHandDebug(h));
                
                // Check for splayed hand gesture (fireball casting) first
                const isSplayed = this.isSplayedHandGesture(hand);
                
                if (isSplayed) {
                    console.log('🔥👋 SPLAYED HAND DETECTED! Ready to cast fireball');
                    // Show visual indicator on the hand
                    if (this.debugCtx && this.debugCanvas) {
                        const palmX = hand.keypoints[0].x;
                        const palmY = hand.keypoints[0].y;
                        
                        this.debugCtx.save();
                        this.debugCtx.fillStyle = 'rgba(255, 69, 0, 0.3)';
                        this.debugCtx.strokeStyle = '#FF4500';
                        this.debugCtx.lineWidth = 4;
                        this.debugCtx.beginPath();
                        this.debugCtx.arc(palmX, palmY, 80, 0, 2 * Math.PI);
                        this.debugCtx.fill();
                        this.debugCtx.stroke();
                        
                        // Draw text
                        this.debugCtx.font = 'bold 20px Arial';
                        this.debugCtx.fillStyle = '#FF4500';
                        this.debugCtx.strokeStyle = '#000000';
                        this.debugCtx.lineWidth = 3;
                        this.debugCtx.strokeText('FIREBALL!', palmX + 20, palmY - 90);
                        this.debugCtx.fillText('FIREBALL!', palmX + 20, palmY - 90);
                        this.debugCtx.restore();
                    }
                }
                
                // Check if hand is making a pinch gesture
                this.isGrabbing = this.isGrabbingGesture(hand);
                
                if (isSplayed && !this.isGrabbing) {
                    // Splayed hand = cast fireball
                    const palmX = hand.keypoints[0].x;
                    const palmY = hand.keypoints[0].y;
                    
                    this.castFireball(palmX, palmY);
                } else if (this.isGrabbing) {
                    // Get hand position (use pinch point - midpoint between thumb and index)
                    const thumbTip = hand.keypoints[4];
                    const indexTip = hand.keypoints[8];
                    const handX = (thumbTip.x + indexTip.x) / 2;
                    const handY = (thumbTip.y + indexTip.y) / 2;
                    
                    this.lastHandPosition = { x: handX, y: handY };
                    
                    // Determine which hand (Left or Right)
                    // MediaPipe returns handedness in hand.handedness as an array with score
                    // hand.handedness is typically "Left" or "Right" string
                    let handedness = 'Right'; // Default to right
                    
                    // Debug: log the full hand object structure (only once per session)
                    if (!this.handStructureLogged) {
                        console.log('🔍 Hand object structure:', hand);
                        console.log('🔍 Hand.handedness:', hand.handedness);
                        this.handStructureLogged = true;
                    }
                    
                    // Try different ways to access handedness
                    if (hand.handedness) {
                        if (typeof hand.handedness === 'string') {
                            handedness = hand.handedness;
                        } else if (Array.isArray(hand.handedness) && hand.handedness.length > 0) {
                            handedness = hand.handedness[0].categoryName || hand.handedness[0].displayName || 'Right';
                        } else if (hand.handedness.categoryName) {
                            handedness = hand.handedness.categoryName;
                        } else if (hand.handedness.displayName) {
                            handedness = hand.handedness.displayName;
                        }
                    }
                    
                    const isLeftHand = handedness === 'Left';
                    
                    console.log(`👋 Hand pinch detected: ${handedness} (isLeftHand=${isLeftHand})`);
                    
                    if (isLeftHand) {
                        // Left hand pinch = dagger stab (2x damage) with 1.5s cooldown
                        const now = Date.now();
                        const timeSinceLastStab = now - this.lastDaggerStabTime;
                        
                        if (timeSinceLastStab >= this.daggerCooldown) {
                            console.log('🔪 Left hand - showing dagger!');
                            this.lastDaggerStabTime = now;
                            
                            const app = window.app;
                            if (app && app.showDaggerStab) {
                                app.showDaggerStab();
                            }
                            
                            // Check for enemy collision with dagger - does 2x damage
                            this.checkEnemyCollision(handX, handY, 2.0, 'dagger'); // 2x damage multiplier
                        } else {
                            const remainingCooldown = (this.daggerCooldown - timeSinceLastStab) / 1000;
                            console.log(`⏰ Dagger cooldown: ${remainingCooldown.toFixed(1)}s remaining`);
                        }
                    } else {
                        // Right hand pinch = grab collectibles (existing behavior)
                        console.log('✋ Right hand - grabbing collectibles');
                        // Check for collision with enemies first
                        const hitEnemy = this.checkEnemyCollision(handX, handY, 1.0, 'punch');
                        
                        // Then check for collision with any collectible
                        const grabbed = this.checkCollision(handX, handY);
                        
                        // Only show miss feedback if nothing was grabbed/hit AND there are collectibles on screen
                        if (!grabbed && !hitEnemy && this.collectibles.length > 0) {
                            this.showMissFeedback(handX, handY);
                        }
                    }
                } else {
                    // Still track hand position even when not grabbing
                    const handX = hand.keypoints[0].x;
                    const handY = hand.keypoints[0].y;
                    this.lastHandPosition = { x: handX, y: handY };
                }
            } else {
                this.lastHandPosition = null;
                this.lastHandKeypoints = null;
                this.isGrabbing = false;
                this.handHistory = []; // Clear history when no hands detected
                
                // Deactivate shield when hands disappear
                this.scheduleShieldDeactivation();
            }
        } catch (error) {
            // Silently handle detection errors
            this.lastHandPosition = null;
            this.lastHandKeypoints = null;
            this.lastHandPosition = null;
            this.isGrabbing = false;
            this.handHistory = []; // Clear history on error
        }
    }

    /**
     * Draw hand keypoints for debugging
     */
    drawHandDebug(hand, isGrabbingOverride = null) {
        // Draw to both canvases
        const canvases = [];
        if (this.debugCtx && this.debugCanvas) {
            canvases.push({ ctx: this.debugCtx, canvas: this.debugCanvas });
        }
        if (this.debugCtxDisplay && this.debugCanvasDisplay) {
            canvases.push({ ctx: this.debugCtxDisplay, canvas: this.debugCanvasDisplay });
        }
        
        if (canvases.length === 0) return;
        
        for (const { ctx } of canvases) {
            this.drawHandOnCanvas(hand, ctx, isGrabbingOverride);
        }
    }
    
    /**
     * Draw hand keypoints on a specific canvas
     */
    drawHandOnCanvas(hand, ctx, isGrabbingOverride = null) {
        const keypoints = hand.keypoints;
        
        // Draw connections between keypoints
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],        // Index
            [0, 9], [9, 10], [10, 11], [11, 12],   // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17]              // Palm
        ];
        
        // Determine if currently grabbing for color - use override if provided
        const isGrabbing = isGrabbingOverride !== null ? isGrabbingOverride : this.isGrabbingGesture(hand);
        const lineColor = isGrabbing ? '#00FF00' : '#00BFFF';
        const pointColor = isGrabbing ? '#00FF00' : '#FFFFFF';
        
        // Draw lines (no manual mirroring - CSS handles it)
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        connections.forEach(([start, end]) => {
            const startPoint = keypoints[start];
            const endPoint = keypoints[end];
            
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(endPoint.x, endPoint.y);
            ctx.stroke();
        });
        
        // Draw keypoints (no manual mirroring - CSS handles it)
        keypoints.forEach((point, index) => {
            const x = point.x;
            const y = point.y;
            
            // Highlight thumb tip (4) and index tip (8) with larger circles
            const isThumbTip = index === 4;
            const isIndexTip = index === 8;
            const isPinchPoint = isThumbTip || isIndexTip;
            const radius = isPinchPoint ? 8 : (index === 0 ? 8 : 4);
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = pointColor;
            ctx.fill();
            
            // Special styling for pinch points
            if (isPinchPoint) {
                ctx.strokeStyle = isGrabbing ? '#00FF00' : '#FFD700'; // Gold when not pinching
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            // Draw palm center larger
            else if (index === 0) {
                ctx.strokeStyle = isGrabbing ? '#00FF00' : '#FF6B35';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        });
        
        // Draw line between thumb and index tip when pinching
        if (isGrabbing) {
            const thumbTip = keypoints[4];
            const indexTip = keypoints[8];
            
            ctx.beginPath();
            ctx.moveTo(thumbTip.x, thumbTip.y);
            ctx.lineTo(indexTip.x, indexTip.y);
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        
        // Draw pinching indicator
        if (isGrabbing) {
            const thumbTip = keypoints[4];
            const indexTip = keypoints[8];
            // Position text near the pinch point
            const x = (thumbTip.x + indexTip.x) / 2;
            const y = (thumbTip.y + indexTip.y) / 2;
            
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#00FF00';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText('PINCHING! 🤏', x + 20, y - 20);
            ctx.fillText('PINCHING! 🤏', x + 20, y - 20);
        }
    }

    /**
     * Check if a hand is within the face area
     * Returns true if the hand center is within an expanded face bounding box
     */
    isHandWithinFace(hand) {
        // If no head tracker or not tracking, allow all hand detections
        if (!this.headTracker || !this.headTracker.detector) {
            return false;
        }

        try {
            // Get the palm center (keypoint 0)
            const palmCenter = hand.keypoints[0];
            
            // Get current face detection from head tracker
            // The head tracker stores the last face detection internally
            const video = this.videoElement;
            if (!video || video.readyState !== 4) return false;
            
            // We need to check if hand is near where a face would be
            // Use a simple heuristic: check if palm is in the upper 40% of the frame
            // and relatively centered (middle 60% horizontally)
            const videoWidth = video.videoWidth || video.width;
            const videoHeight = video.videoHeight || video.height;
            
            const palmX = palmCenter.x;
            const palmY = palmCenter.y;
            
            // Face is typically in upper portion and centered
            const isInUpperPortion = palmY < videoHeight * 0.4;
            const isHorizontallyCentered = palmX > videoWidth * 0.2 && palmX < videoWidth * 0.8;
            
            // If hand is in typical face area, consider it suspicious
            const isInFaceZone = isInUpperPortion && isHorizontallyCentered;
            
            // Additional check: if hand keypoints are very close together (face features)
            // Calculate average distance between keypoints
            let totalDistance = 0;
            let count = 0;
            for (let i = 0; i < hand.keypoints.length - 1; i++) {
                const dist = this.distance(hand.keypoints[i], hand.keypoints[i + 1]);
                totalDistance += dist;
                count++;
            }
            const avgDistance = totalDistance / count;
            
            // Real hands have larger keypoint spread (>15px avg), faces detect as hands have smaller spread
            const isLikelyFace = avgDistance < 15;
            
            if (isInFaceZone && isLikelyFace) {
                // Debug log occasionally
                if (Math.random() < 0.05) {
                    console.log(`Hand filtered (likely face): avgKeyDist=${avgDistance.toFixed(1)}px, zone=${isInFaceZone}`);
                }
                return true;
            }
            
            return false;
        } catch (error) {
            // On error, allow the hand detection
            return false;
        }
    }

    /**
     * Add hand detection to history for persistence tracking
     */
    addHandToHistory(hand) {
        const palmCenter = hand.keypoints[0];
        this.handHistory.push({
            x: palmCenter.x,
            y: palmCenter.y,
            timestamp: Date.now()
        });
        
        // Keep only last N frames
        if (this.handHistory.length > this.handHistoryMaxLength) {
            this.handHistory.shift();
        }
    }

    /**
     * Check if hand has been detected consistently enough to be considered real
     * Reduces false positives from momentary face detections
     */
    isHandPersistent() {
        // Not enough history yet - be permissive initially
        if (this.handHistory.length < this.handPersistenceThreshold) {
            return true;
        }
        
        // Check if recent detections are consistent (hands exist in multiple frames)
        // Simple approach: we have enough frames if we're here
        return this.handHistory.length >= this.handPersistenceThreshold;
    }

    /**
     * Determine if hand is making a grabbing gesture
     * Returns true if thumb and index finger are pinched together
     */
    isGrabbingGesture(hand) {
        const keypoints = hand.keypoints;
        
        // Get thumb and index finger tips
        const thumbTip = keypoints[4];
        const indexTip = keypoints[8];
        
        // Get thumb and index finger mid joints for reference
        const thumbMid = keypoints[3];
        const indexMid = keypoints[6];
        
        // Calculate distance between thumb tip and index tip
        const pinchDistance = this.distance(thumbTip, indexTip);
        
        // Calculate the "reach" distance (how far apart they could be)
        // This is roughly the distance from thumb mid to index mid
        const reachDistance = this.distance(thumbMid, indexMid);
        
        // Consider it a pinch if the tips are close together
        // Threshold: tips should be within 60 pixels or within 50% of reach distance (more forgiving)
        const pinchThreshold = Math.min(60, reachDistance * 0.5);
        const isPinching = pinchDistance < pinchThreshold;
        
        // Debug logging occasionally
        if (Math.random() < 0.02) { // Log 2% of the time
            console.log(`Pinch detection: distance=${pinchDistance.toFixed(1)}, threshold=${pinchThreshold.toFixed(1)}, isPinching=${isPinching}`);
        }
        
        return isPinching;
    }

    /**
     * Detect crossbow firing gesture - DEPRECATED: Now using wink detection
     * Left here for reference in case we want to add alternative firing methods
     */
    /*
    detectCrossbowGesture(hand) {
        const keypoints = hand.keypoints;
        
        // Get fingertips and their bases
        const indexTip = keypoints[8];
        const middleTip = keypoints[12];
        const ringTip = keypoints[16];
        const pinkyTip = keypoints[20];
        const thumbTip = keypoints[4];
        const palm = keypoints[0];
        
        const indexBase = keypoints[5];
        const thumbBase = keypoints[2];
        
        // Check if index finger is extended
        const indexDist = this.distance(indexTip, indexBase);
        const indexExtended = indexDist > 50;
        
        // Check if thumb is extended (gun gesture)
        const thumbDist = this.distance(thumbTip, thumbBase);
        const thumbExtended = thumbDist > 40;
        
        // Check if middle, ring, and pinky are close to palm (curled)
        const middleToPalm = this.distance(middleTip, palm);
        const ringToPalm = this.distance(ringTip, palm);
        const pinkyToPalm = this.distance(pinkyTip, palm);
        
        const middleClose = middleToPalm < 90;
        const ringClose = ringToPalm < 90;
        const pinkyClose = pinkyToPalm < 90;
        
        // Gun/shooting gesture: index and thumb extended, others closed
        const isShooting = indexExtended && thumbExtended && middleClose && ringClose && pinkyClose;
        
        // Store state for visual indicator
        this.isPointing = isShooting;
        
        // Debug logging
        console.log(`🎯 Crossbow check: idx=${indexDist.toFixed(0)}(${indexExtended}), thumb=${thumbDist.toFixed(0)}(${thumbExtended}), ` +
                   `mid=${middleToPalm.toFixed(0)}(${middleClose}), ring=${ringToPalm.toFixed(0)}(${ringClose}), ` +
                   `pinky=${pinkyToPalm.toFixed(0)}(${pinkyClose}), 🎯=${isShooting}`);
        
        // If shooting gesture detected and enough time has passed, fire!
        if (isShooting) {
            const now = Date.now();
            if (now - this.lastFireTime > this.fireDelay) {
                this.fireBolt(indexTip);
                this.lastFireTime = now;
            }
        }
    }
    */

    /**
     * Detect open hand gesture - all 5 fingers splayed
     */
    isOpenHandGesture(hand) {
        const keypoints = hand.keypoints;
        
        // Get all fingertips and their bases
        const thumbTip = keypoints[4];
        const indexTip = keypoints[8];
        const middleTip = keypoints[12];
        const ringTip = keypoints[16];
        const pinkyTip = keypoints[20];
        
        const thumbBase = keypoints[2];
        const indexBase = keypoints[5];
        const middleBase = keypoints[9];
        const ringBase = keypoints[13];
        const pinkyBase = keypoints[17];
        
        // Check if all fingers are extended
        const thumbExtended = this.distance(thumbTip, thumbBase) > 50;
        const indexExtended = this.distance(indexTip, indexBase) > 60;
        const middleExtended = this.distance(middleTip, middleBase) > 60;
        const ringExtended = this.distance(ringTip, ringBase) > 60;
        const pinkyExtended = this.distance(pinkyTip, pinkyBase) > 50;
        
        const allExtended = thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended;
        
        // Check if fingers are widely spread (not together or pinching)
        const fingerSpread = this.distance(indexTip, pinkyTip) > 100;
        const thumbIndexSpread = this.distance(thumbTip, indexTip) > 60; // Not pinching
        
        return allExtended && fingerSpread && thumbIndexSpread;
    }

    /**
     * Detect closed fist gesture
     */
    isClosedFistGesture(hand, forceDebug = false, handLabel = "Hand") {
        const keypoints = hand.keypoints;
        
        // Get all fingertips and palm
        const thumbTip = keypoints[4];
        const indexTip = keypoints[8];
        const middleTip = keypoints[12];
        const ringTip = keypoints[16];
        const pinkyTip = keypoints[20];
        const palm = keypoints[0];
        
        // Calculate distances
        const thumbDist = this.distance(thumbTip, palm);
        const indexDist = this.distance(indexTip, palm);
        const middleDist = this.distance(middleTip, palm);
        const ringDist = this.distance(ringTip, palm);
        const pinkyDist = this.distance(pinkyTip, palm);
        
        // VERY relaxed detection - if at least 3 out of 5 fingers are somewhat close, call it a fist
        // Much more generous thresholds
        const thumbClose = thumbDist < 120;
        const indexClose = indexDist < 130;
        const middleClose = middleDist < 130;
        const ringClose = ringDist < 130;
        const pinkyClose = pinkyDist < 130;
        
        const closeCount = [thumbClose, indexClose, middleClose, ringClose, pinkyClose].filter(x => x).length;
        const isFist = closeCount >= 3; // At least 3 fingers close = fist
        
        // Debug logging - either forced or throttled
        if (forceDebug) {
            const resultStyle = isFist ? 'color: #00ff00; font-weight: bold; font-size: 14px' : 'color: #ff6666';
            console.log(`👊 ${handLabel}: thumb=${thumbDist.toFixed(0)} (${thumbClose ? '✓' : '✗'}), index=${indexDist.toFixed(0)} (${indexClose ? '✓' : '✗'}), middle=${middleDist.toFixed(0)} (${middleClose ? '✓' : '✗'}), ring=${ringDist.toFixed(0)} (${ringClose ? '✓' : '✗'}), pinky=${pinkyDist.toFixed(0)} (${pinkyClose ? '✓' : '✗'}) => %c${isFist}`, resultStyle);
        } else {
            // Throttled debug logging every 60 frames (about once per second at 60fps)
            if (!this.fistDebugCounter) this.fistDebugCounter = 0;
            this.fistDebugCounter++;
            if (this.fistDebugCounter >= 60) {
                const resultStyle = isFist ? 'color: #00ff00; font-weight: bold; font-size: 14px' : 'color: #ff6666';
                console.log(`👊 Fist check: thumb=${thumbDist.toFixed(0)} (<120), index=${indexDist.toFixed(0)} (<130), middle=${middleDist.toFixed(0)} (<130), ring=${ringDist.toFixed(0)} (<130), pinky=${pinkyDist.toFixed(0)} (<130) => ${closeCount}/5 close => %c${isFist}`, resultStyle);
                this.fistDebugCounter = 0;
            }
        }
        
        return isFist;
    }

    /**
     * Calculate distance between two points
     */
    distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    /**
     * Detect splayed hand gesture (all fingers extended and spread apart)
     */
    isSplayedHandGesture(hand) {
        const keypoints = hand.keypoints;
        
        // Get fingertips and palm
        const thumbTip = keypoints[4];
        const indexTip = keypoints[8];
        const middleTip = keypoints[12];
        const ringTip = keypoints[16];
        const pinkyTip = keypoints[20];
        const palm = keypoints[0];
        
        // Check if all fingers are extended (far from palm)
        const thumbDist = this.distance(thumbTip, palm);
        const indexDist = this.distance(indexTip, palm);
        const middleDist = this.distance(middleTip, palm);
        const ringDist = this.distance(ringTip, palm);
        const pinkyDist = this.distance(pinkyTip, palm);
        
        // All fingers should be extended (far from palm) - lowered thresholds for easier detection
        const thumbExtended = thumbDist > 60;  // Was 80
        const indexExtended = indexDist > 100; // Was 120
        const middleExtended = middleDist > 110; // Was 130
        const ringExtended = ringDist > 100;  // Was 120
        const pinkyExtended = pinkyDist > 80;  // Was 100
        
        const extendedCount = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended].filter(x => x).length;
        
        // Also check that fingers are spread apart (not just extended) - lowered thresholds
        const indexMiddleDist = this.distance(indexTip, middleTip);
        const middleRingDist = this.distance(middleTip, ringTip);
        const ringPinkyDist = this.distance(ringTip, pinkyTip);
        
        const fingersSpread = indexMiddleDist > 30 && middleRingDist > 20 && ringPinkyDist > 20; // Was 40, 30, 30
        
        const isSplayed = extendedCount >= 4 && fingersSpread;
        
        // Throttled debug logging
        if (!this.splayedDebugCounter) this.splayedDebugCounter = 0;
        this.splayedDebugCounter++;
        if (this.splayedDebugCounter >= 30 || isSplayed) {
            const resultStyle = isSplayed ? 'color: #FF4500; font-weight: bold; font-size: 14px' : 'color: #cccccc';
            console.log(`🔥 Splayed check: thumb=${thumbDist.toFixed(0)} (${thumbExtended ? '✓' : '✗'}), index=${indexDist.toFixed(0)} (${indexExtended ? '✓' : '✗'}), middle=${middleDist.toFixed(0)} (${middleExtended ? '✓' : '✗'}), ring=${ringDist.toFixed(0)} (${ringExtended ? '✓' : '✗'}), pinky=${pinkyDist.toFixed(0)} (${pinkyExtended ? '✓' : '✗'}) | Spread: I-M=${indexMiddleDist.toFixed(0)}, M-R=${middleRingDist.toFixed(0)}, R-P=${ringPinkyDist.toFixed(0)} => %c${isSplayed}`, resultStyle);
            if (isSplayed || this.splayedDebugCounter >= 30) {
                this.splayedDebugCounter = 0;
            }
        }
        
        return isSplayed;
    }

    /**
     * Check for shield gesture (closed fist + elbow visible)
     */
    checkTwoFistShieldGesture(hands, forceDebug = false) {
        // Need at least 2 hands detected
        if (!hands || hands.length < 2) {
            // No two-fist gesture detected
            this.scheduleShieldDeactivation();
            return false;
        }
        
        // Check if both hands are making closed fists with detailed debug
        const hand1IsFist = this.isClosedFistGesture(hands[0], forceDebug || true, "Hand 1");
        const hand2IsFist = this.isClosedFistGesture(hands[1], forceDebug || true, "Hand 2");
        
        if (forceDebug) {
            const bothFists = hand1IsFist && hand2IsFist;
            const summaryStyle = bothFists ? 'color: #00ff00; font-weight: bold; font-size: 16px' : 'color: #ff9900';
            console.log(`%c🛡️ Shield check: hand1 fist=${hand1IsFist}, hand2 fist=${hand2IsFist}`, summaryStyle);
        }
        
        if (hand1IsFist && hand2IsFist) {
            // Both hands are fist-like - activate shield immediately!
            if (forceDebug) {
                console.log(`%c🛡️ Both hands are fist-like - ACTIVATING SHIELD!`, 'color: #00ff00; font-weight: bold; font-size: 18px; background: #004400; padding: 4px');
            }
            
            // Update last gesture time and cancel any pending deactivation
            this.lastShieldGestureTime = Date.now();
            if (this.shieldDeactivateTimer) {
                clearTimeout(this.shieldDeactivateTimer);
                this.shieldDeactivateTimer = null;
            }
            
            // Activate shield with level based on equipped shield
            const app = window.app;
            if (app && app.activateShield) {
                // Get shield level (buckler = 1, future shields can be higher)
                const shieldLevel = this.equippedShield === 'buckler' ? 1 : 0;
                app.activateShield(shieldLevel);
            }
            return true;
        }
        
        // Gesture not detected or fists not close enough
        this.scheduleShieldDeactivation();
        return false;
    }
    
    /**
     * Schedule shield deactivation after gesture stops
     */
    scheduleShieldDeactivation() {
        // If shield is not active, nothing to do
        const app = window.app;
        if (!app || !app.shieldActive) return;
        
        // If timer already scheduled, don't reschedule
        if (this.shieldDeactivateTimer) return;
        
        // Schedule deactivation
        this.shieldDeactivateTimer = setTimeout(() => {
            console.log('🛡️ Shield gesture timeout - deactivating shield');
            if (app && app.deactivateShield) {
                app.deactivateShield();
            }
            this.shieldDeactivateTimer = null;
        }, this.shieldDeactivateDelay);
    }

    /**
     * Check for collision between hand and collectibles
     * Returns true if a collectible was grabbed
     */
    checkCollision(handX, handY) {
        // Use half the screen width as the grab radius
        const halfScreenDistance = this.canvas ? this.canvas.width / 2 : 320;
        
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            const distance = Math.sqrt(
                Math.pow(handX - collectible.x, 2) + 
                Math.pow(handY - collectible.y, 2)
            );
            
            // Collision detection with half screen distance
            if (distance < halfScreenDistance) {
                this.collectCollectible(collectible, i);
                return true; // Successfully grabbed
            }
        }
        return false; // Missed
    }
    
    /**
     * Check for collision between pinch and enemies
     * Returns true if an enemy was hit
     */
    checkEnemyCollision(handX, handY, additionalMultiplier = 1.0) {
        const now = Date.now();
        for (let enemy of this.enemies) {
            const distance = Math.sqrt(
                Math.pow(handX - enemy.x, 2) + 
                Math.pow(handY - enemy.y, 2)
            );
            
            // Hit detection with enemy size
            if (distance < enemy.size) {
                // Check cooldown - can only hit once per second
                if (now - enemy.lastPinchHitTime < 1000) {
                    console.log(`⏰ Pinch cooldown active! Wait ${((1000 - (now - enemy.lastPinchHitTime)) / 1000).toFixed(1)}s`);
                    return false; // On cooldown
                }
                
                // Check if electrified and apply 4x damage
                let damageMultiplier = 1 * additionalMultiplier; // Apply additional multiplier (e.g., 2x for dagger)
                let damageType = additionalMultiplier > 1 ? '🗡️' : '👊';
                
                if (this.electrifiedPinchesRemaining > 0) {
                    damageMultiplier = 4 * additionalMultiplier; // Combine electrified and dagger multipliers
                    damageType = additionalMultiplier > 1 ? '⚡🗡️' : '⚡👊';
                    this.electrifiedPinchesRemaining--;
                    console.log(`⚡ ELECTRIFIED ${additionalMultiplier > 1 ? 'DAGGER' : 'PINCH'}! ${this.electrifiedPinchesRemaining} remaining`);
                }
                
                // Pinch damages enemy by 10% of health (with multipliers)
                const baseDamage = enemy.maxHealth * 0.1;
                const damage = baseDamage * damageMultiplier;
                enemy.health = Math.max(0, enemy.health - damage);
                enemy.lastPinchHitTime = now; // Update cooldown timer
                console.log(`${damageType} ${additionalMultiplier > 1 ? 'Dagger' : 'Pinch'} hit rat! Damage: ${damage.toFixed(1)} (${damageMultiplier}x), Remaining health: ${enemy.health.toFixed(1)}`);
                
                // Determine attack type for display
                const attackType = additionalMultiplier > 1 ? 'dagger' : 'pinch';
                
                // Show appropriate animation
                if (damageMultiplier > 1) {
                    this.showElectricPinchHitFeedback(enemy.x, enemy.y, damage, attackType);
                } else {
                    this.showPinchHitFeedback(enemy.x, enemy.y, damage, attackType);
                }
                
                return true; // Hit enemy
            }
        }
        return false; // Missed
    }

    /**
     * Collect a collectible
     */
    collectCollectible(collectible, index) {
        // Remove from array
        this.collectibles.splice(index, 1);
        
        // Add to inventory by type
        this.inventory[collectible.type.name]++;
        
        console.log(`📦 Collected ${collectible.type.emoji} ${collectible.type.name}`);
        
        // If it's a bolt, also increment the bolt counter
        console.log(`🔍 Checking if '${collectible.type.name}' === 'bolt': ${collectible.type.name === 'bolt'}`);
        if (collectible.type.name === 'bolt') {
            this.boltCount++;
            console.log(`🏹 Collected bolt! Total bolts BEFORE update: ${this.boltCount}`);
            this.updateBoltCounter();
            console.log(`🏹 Bolt counter updated. New value: ${this.boltCount}`);
            // Don't increment collectedCount for bolts - they're tracked separately
            this.updateInventoryDisplay(); // Update inventory display immediately
            this.showCollectFeedback(collectible);
        } else {
            // For non-bolt collectibles, show pending animation and increment counter
            // Don't increment immediately - show pending animation first
            // this.collectedCount++; // Will increment after delay
            
            // Show pending increment
            this.showPendingIncrement();
            
            // Update counter after 2 seconds
            setTimeout(() => {
                this.collectedCount++;
                this.updateCounter();
                this.updateInventoryDisplay(); // Update inventory display
            }, 2000);
            
            // Show feedback
            this.showCollectFeedback(collectible);
        }
        
        console.log(`Collected ${collectible.type.name}! Inventory: ${this.inventory[collectible.type.name]}`);
    }

    /**
     * Update the collectibles counter in the UI
     */
    updateCounter() {
        const counter = document.getElementById('collectiblesCount');
        if (counter) {
            counter.textContent = this.collectedCount;
            
            // Add bounce animation
            counter.style.animation = 'none';
            setTimeout(() => {
                counter.style.animation = 'collectBounce 0.5s ease-out';
            }, 10);
        }
    }

    /**
     * Update the bolt counter in the UI
     */
    updateBoltCounter() {
        const boltCounter = document.getElementById('boltCount');
        console.log(`🎯 updateBoltCounter called. boltCount=${this.boltCount}, element found=${!!boltCounter}`);
        if (boltCounter) {
            boltCounter.textContent = this.boltCount;
            console.log(`✅ Bolt counter UI updated to: ${this.boltCount}`);
            
            // Add bounce animation
            boltCounter.style.animation = 'none';
            setTimeout(() => {
                boltCounter.style.animation = 'collectBounce 0.5s ease-out';
            }, 10);
        } else {
            console.error('❌ Could not find boltCount element in DOM!');
        }
    }

    /**
     * Show pending increment next to counter
     */
    showPendingIncrement() {
        const counterContainer = document.querySelector('.collectibles-counter');
        if (!counterContainer) return;
        
        // Create glowing +1 element
        const pending = document.createElement('div');
        pending.className = 'pending-increment';
        pending.textContent = '+1';
        
        // Add to counter container (CSS handles positioning)
        counterContainer.appendChild(pending);
        
        // Remove after animation (2 seconds)
        setTimeout(() => {
            if (pending.parentNode) {
                pending.remove();
            }
        }, 2000);
    }

    /**
     * Show visual feedback when collecting
     */
    showCollectFeedback(collectible) {
        // Convert from video coordinates to display coordinates
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = collectible.x * scaleX;
        const displayY = collectible.y * scaleY;
        
        // Create floating text
        const feedback = document.createElement('div');
        feedback.className = 'collect-feedback';
        feedback.textContent = `+1 ${collectible.type.emoji}`;
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            
            // Remove after animation
            setTimeout(() => {
                feedback.remove();
            }, 1000);
        }
    }

    /**
     * Show visual feedback when pinch hits an enemy
     */
    showPinchHitFeedback(x, y, damage = 0, attackType = 'punch') {
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = x * scaleX;
        const displayY = y * scaleY;
        
        // Create attack feedback text
        const feedback = document.createElement('div');
        feedback.className = 'pinch-hit-feedback';
        const attackText = attackType === 'dagger' ? 'STAB!' : 'PUNCH!';
        const damageText = Math.round(damage);
        feedback.textContent = `💥${damageText}💥 ${attackText}`;
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        feedback.style.position = 'absolute';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '2rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#ff0000';
        feedback.style.textShadow = '0 0 10px #ffff00, 0 0 20px #ff0000';
        feedback.style.animation = 'punchImpact 0.5s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '1000';
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            
            // Remove after animation
            setTimeout(() => {
                feedback.remove();
            }, 500);
        }
    }

    /**
     * Show visual feedback when bolt hits an enemy
     */
    showBoltImpactFeedback(x, y) {
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = x * scaleX;
        const displayY = y * scaleY;
        
        // Create "THWAAK!" text
        const feedback = document.createElement('div');
        feedback.className = 'bolt-impact-feedback';
        feedback.textContent = '🎯 THWAAK!';
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        feedback.style.position = 'absolute';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '2.5rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#8B4513';
        feedback.style.textShadow = '0 0 10px #FFD700, 0 0 20px #FF8C00, 2px 2px 4px #000000';
        feedback.style.animation = 'boltImpact 0.6s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '1000';
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            
            // Remove after animation
            setTimeout(() => {
                feedback.remove();
            }, 600);
        }
    }

    /**
     * Show visual feedback when electrified pinch hits an enemy
     */
    showElectricPinchHitFeedback(x, y, damage = 0, attackType = 'punch') {
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = x * scaleX;
        const displayY = y * scaleY;
        
        // Create electrified attack feedback with damage
        const feedback = document.createElement('div');
        feedback.className = 'electric-pinch-feedback';
        const attackText = attackType === 'dagger' ? 'STAB!' : 'PUNCH!';
        const damageText = Math.round(damage);
        feedback.textContent = `⚡${damageText}⚡ ${attackText}`;
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        feedback.style.position = 'absolute';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '2.5rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#00FFFF';
        feedback.style.textShadow = '0 0 10px #FFFF00, 0 0 20px #00FFFF, 0 0 30px #0088FF';
        feedback.style.animation = 'electricPinchImpact 0.5s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '1000';
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            
            // Remove after animation
            setTimeout(() => {
                feedback.remove();
            }, 500);
        }
    }

    /**
     * Show visual feedback when electrified buff is activated
     */
    showElectrifiedBuffFeedback() {
        // Create buff notification
        const feedback = document.createElement('div');
        feedback.className = 'electrified-buff-feedback';
        feedback.textContent = '⚡ ELECTRIFIED! 5 Hits ⚡';
        feedback.style.position = 'fixed';
        feedback.style.top = '50%';
        feedback.style.left = '50%';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '3rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#FFFF00';
        feedback.style.textShadow = '0 0 20px #00FFFF, 0 0 40px #FFFF00, 0 0 60px #0088FF, 3px 3px 6px #000000';
        feedback.style.animation = 'electrifiedBuffPulse 1.5s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '10000';
        
        document.body.appendChild(feedback);
        
        // Remove after animation
        setTimeout(() => {
            feedback.remove();
        }, 1500);
    }

    /**
     * Show visual feedback when toad tongue buff is activated
     */
    showToadTongueBuffFeedback() {
        // Create buff notification
        const feedback = document.createElement('div');
        feedback.className = 'toadtongue-buff-feedback';
        feedback.textContent = '👅 TOAD TONGUE! 20 Strikes 👅';
        feedback.style.position = 'fixed';
        feedback.style.top = '50%';
        feedback.style.left = '50%';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '3rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#10B981';
        feedback.style.textShadow = '0 0 20px #34D399, 0 0 40px #10B981, 0 0 60px #6EE7B7, 3px 3px 6px #000000';
        feedback.style.animation = 'electrifiedBuffPulse 1.5s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '10000';
        
        document.body.appendChild(feedback);
        
        // Remove after animation
        setTimeout(() => {
            feedback.remove();
        }, 1500);
    }

    /**
     * Show visual feedback when a potion is successfully brewed
     */
    showBrewSuccessFeedback(potionType) {
        const feedback = document.createElement('div');
        feedback.className = 'brew-success-feedback';
        
        if (potionType === 'healing') {
            feedback.innerHTML = '✨ SUCCESS! ✨<br>🧪 Healing Potion';
            feedback.style.color = '#22C55E';
            feedback.style.textShadow = '0 0 20px #4ADE80, 0 0 40px #22C55E, 0 0 60px #86EFAC, 3px 3px 6px #000000';
        } else if (potionType === 'electricity') {
            feedback.innerHTML = '✨ SUCCESS! ✨<br>⚡ Electricity Potion';
            feedback.style.color = '#00FFFF';
            feedback.style.textShadow = '0 0 20px #FFFF00, 0 0 40px #00FFFF, 0 0 60px #0088FF, 3px 3px 6px #000000';
        } else if (potionType === 'mana') {
            feedback.innerHTML = '✨ SUCCESS! ✨<br>🔮 Mana Potion';
            feedback.style.color = '#3B82F6';
            feedback.style.textShadow = '0 0 20px #60A5FA, 0 0 40px #3B82F6, 0 0 60px #93C5FD, 3px 3px 6px #000000';
        } else if (potionType === 'toadtongue') {
            feedback.innerHTML = '✨ SUCCESS! ✨<br>👅 Toad Tongue Potion';
            feedback.style.color = '#10B981';
            feedback.style.textShadow = '0 0 20px #34D399, 0 0 40px #10B981, 0 0 60px #6EE7B7, 3px 3px 6px #000000';
        }
        
        feedback.style.position = 'fixed';
        feedback.style.top = '50%';
        feedback.style.left = '50%';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '3rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.animation = 'brewSuccessPulse 2s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '10000';
        feedback.style.textAlign = 'center';
        feedback.style.lineHeight = '1.3';
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 2000);
    }

    /**
     * Show visual feedback when missing a grab attempt
     */
    showMissFeedback(handX, handY) {
        // Throttle miss feedback to avoid spam
        const now = Date.now();
        if (now - this.lastMissTime < this.missThrottleDelay) {
            return;
        }
        this.lastMissTime = now;
        
        // Convert from video coordinates to display coordinates
        // The canvas element has internal dimensions (canvas.width/height)
        // but displays at CSS dimensions (offsetWidth/offsetHeight)
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = handX * scaleX;
        const displayY = handY * scaleY;
        
        // Create miss indicator
        const feedback = document.createElement('div');
        feedback.className = 'miss-feedback';
        feedback.textContent = '✗';
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            
            // Remove after animation
            setTimeout(() => {
                feedback.remove();
            }, 800);
        }
    }

    /**
     * Cast a fireball spell
     */
    castFireball(startX, startY) {
        const now = Date.now();
        const app = window.app;
        
        // Check cooldown
        if (now - this.lastFireballCastTime < this.fireballCooldown) {
            const remainingCooldown = (this.fireballCooldown - (now - this.lastFireballCastTime)) / 1000;
            console.log(`⏰ Fireball cooldown: ${remainingCooldown.toFixed(1)}s remaining`);
            return;
        }
        
        // Check if player has enough magic
        if (!app || app.magic < this.fireballCost) {
            console.log(`❌ Not enough magic! Need ${this.fireballCost}, have ${app ? app.magic : 0}`);
            this.showInsufficientMagicFeedback(startX, startY);
            return;
        }
        
        // Consume magic
        app.magic = Math.max(0, app.magic - this.fireballCost);
        app.updateStatBars();
        this.lastFireballCastTime = now;
        
        console.log(`🔥 Casting fireball! Magic: ${app.magic}/${app.maxMagic}`);
        
        // If there's an enemy on screen, instantly hit them (like tongue strike)
        if (this.enemies.length > 0) {
            const enemy = this.enemies[0];
            const damage = enemy.maxHealth * 0.4; // 40% damage
            
            enemy.health = Math.max(0, enemy.health - damage);
            console.log(`🔥 Fireball hit ${enemy.type}! Damage: ${damage.toFixed(1)}, Remaining health: ${enemy.health.toFixed(1)}`);
            
            // Show impact animation at enemy location
            this.showFireballImpactFeedback(enemy.x, enemy.y, damage);
            
            // Remove enemy if dead and award XP
            if (enemy.health <= 0) {
                console.log(`💀 ${enemy.type} defeated by fireball!`);
                this.enemies.splice(0, 1);
                const app = window.app;
                if (app && app.addXP) {
                    app.addXP(10);
                    this.showEnemyDefeatFeedback(10);
                }
            }
        } else {
            console.log('🔥 No enemies on screen - fireball cast but no target');
        }
        
        this.showFireballCastFeedback(startX, startY);
        console.log(`✅ Fireball cast complete`);
    }

    /**
     * Show visual feedback when casting fireball
     */
    showFireballCastFeedback(x, y) {
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = x * scaleX;
        const displayY = y * scaleY;
        
        const feedback = document.createElement('div');
        feedback.className = 'fireball-cast-feedback';
        feedback.textContent = '🔥 FIREBALL! 🔥';
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        feedback.style.position = 'absolute';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '2rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#FF4500';
        feedback.style.textShadow = '0 0 10px #FFD700, 0 0 20px #FF4500, 0 0 30px #FF0000';
        feedback.style.animation = 'fireballCast 0.6s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '1000';
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            setTimeout(() => feedback.remove(), 600);
        }
    }

    /**
     * Show insufficient magic feedback
     */
    showInsufficientMagicFeedback(x, y) {
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = x * scaleX;
        const displayY = y * scaleY;
        
        const feedback = document.createElement('div');
        feedback.textContent = '✨ No Magic! ✨';
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        feedback.style.position = 'absolute';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '1.5rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#00BFFF';
        feedback.style.textShadow = '0 0 10px #FFFFFF';
        feedback.style.animation = 'fadeOut 0.5s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '1000';
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            setTimeout(() => feedback.remove(), 500);
        }
    }

    /**
     * Show visual feedback when fireball hits an enemy
     */
    showFireballImpactFeedback(x, y, damage) {
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = x * scaleX;
        const displayY = y * scaleY;
        
        const feedback = document.createElement('div');
        const damageText = Math.round(damage);
        feedback.textContent = `🔥${damageText}🔥 BURN!`;
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        feedback.style.position = 'absolute';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '2rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#FF4500';
        feedback.style.textShadow = '0 0 10px #FFD700, 0 0 20px #FF4500, 0 0 30px #FF0000';
        feedback.style.animation = 'punchImpact 0.5s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '1000';
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            setTimeout(() => feedback.remove(), 500);
        }
    }

    /**
     * Create slash animation
     */
    /**
     * Fire a bolt projectile from the crossbow
     */
    fireBolt(startPosition) {
        // Check if we have bolts to fire
        if (this.boltCount <= 0) {
            console.log('❌ No bolts! Cannot fire crossbow.');
            // TODO: Show "Out of Ammo" feedback to user
            return;
        }
        
        // Consume one bolt
        this.boltCount--;
        this.updateBoltCounter();
        console.log(`🏹 Fired bolt! Remaining: ${this.boltCount}`);
        
        // Calculate trajectory towards first enemy if one exists
        let vx = 400; // Default: travels right
        let vy = 0;
        
        if (this.enemies.length > 0) {
            const enemy = this.enemies[0];
            // Calculate direction to enemy
            const dx = enemy.x - startPosition.x;
            const dy = enemy.y - startPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Normalize and scale to speed of 400 px/s
            const speed = 400;
            vx = (dx / distance) * speed;
            vy = (dy / distance) * speed;
            
            console.log(`🎯 Bolt aimed at rat: (${enemy.x.toFixed(0)}, ${enemy.y.toFixed(0)})`);
        }
        
        // Create a bolt projectile that travels across screen
        const bolt = {
            x: startPosition.x,
            y: startPosition.y,
            vx: vx,
            vy: vy,
            size: 30,
            createdAt: Date.now(),
            lifetime: 3000, // Exists for 3 seconds before disappearing
            type: this.types.find(t => t.name === 'bolt')
        };
        
        this.boltProjectiles.push(bolt);
        console.log(`✅ Bolt projectile created! Position: (${startPosition.x.toFixed(0)}, ${startPosition.y.toFixed(0)})`);
    }

    /**
     * Perform a tongue strike (collects items OR damages enemies)
     */
    performTongueStrike(position) {
        const now = Date.now();
        this.lastTongueStrikeTime = now;
        
        console.log(`👅 Tongue strike!`);
        
        // Check for collectibles first - grab any item on screen
        let itemCollected = false;
        
        if (this.collectibles.length > 0) {
            // Grab the first collectible
            const item = this.collectibles[0];
            
            // Collect the item
            this.collectCollectible(item, 0);
            itemCollected = true;
            console.log(`👅✨ Tongue grabbed ${item.type.name}!`);
            
            // Show tongue strike feedback at item position
            this.showTongueStrikeFeedback(item, true);
        }
        
        // If no item was collected, check for enemies
        if (!itemCollected && this.enemies.length > 0) {
            // Hit the first enemy
            const enemy = this.enemies[0];
            
            // Calculate damage (works like an electrified pinch if shock touch is active)
            const isElectrified = this.electrifiedPinchesRemaining > 0;
            let damage = 5; // Base tongue strike damage
            let multiplier = 1;
            
            if (isElectrified) {
                multiplier = 4; // Electrified multiplier
                damage *= multiplier;
                this.electrifiedPinchesRemaining--;
                console.log(`⚡👅 ELECTRIFIED TONGUE STRIKE! ${this.electrifiedPinchesRemaining} remaining`);
            }
            
            // Apply damage
            enemy.health -= damage;
            console.log(`👅 Tongue strike hit ${enemy.type}! Damage: ${damage} (${isElectrified ? 'ELECTRIFIED x4' : 'normal'}), HP: ${enemy.health}/${enemy.maxHealth}`);
            
            // Remove enemy if dead and award XP
            if (enemy.health <= 0) {
                console.log(`💀 ${enemy.type} defeated by tongue strike!`);
                this.enemies.splice(0, 1);
                const app = window.app;
                if (app && app.addXP) {
                    app.addXP(10);
                    this.showEnemyDefeatFeedback(10);
                }
            }
            
            // Show tongue strike feedback at enemy position
            this.showTongueStrikeFeedback(enemy, false, isElectrified, damage);
        }
    }

    /**
     * Show visual feedback for tongue strike
     */
    showTongueStrikeFeedback(position, isCollect, isElectrified = false, damage = 0) {
        const feedback = document.createElement('div');
        feedback.className = 'tongue-strike-feedback';
        
        if (isCollect) {
            feedback.textContent = '👅✨';
            feedback.style.color = '#10B981';
        } else if (isElectrified) {
            feedback.textContent = `⚡👅⚡ ${Math.round(damage)}`;
            feedback.style.color = '#FFFF00';
            feedback.style.textShadow = '0 0 20px #00FFFF, 0 0 40px #FFFF00';
        } else {
            feedback.textContent = `👅💥 ${Math.round(damage)}`;
            feedback.style.color = '#EF4444';
        }
        
        feedback.style.position = 'fixed';
        feedback.style.left = `${position.x}px`;
        feedback.style.top = `${position.y}px`;
        feedback.style.fontSize = '3rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '9999';
        feedback.style.animation = 'tongueStrikeFloat 1s ease-out forwards';
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 1000);
    }

    /**
     * Draw all collectibles
     */
    draw() {
        if (!this.ctx || !this.canvas) return;
        
        // Clear canvas
        this.clearCanvas();
        
        // Draw bolt projectiles
        this.drawBoltProjectiles();
        
        // Draw fireball projectiles
        this.drawFireballProjectiles();
        
        // Draw enemies
        this.drawEnemies();
        
        // Draw fingertip indicators if hand is detected
        if (this.lastHandKeypoints) {
            this.drawFingertipIndicators(this.lastHandKeypoints);
        }
        
        // Draw each collectible
        this.collectibles.forEach(collectible => {
            const size = collectible.size * collectible.scale;
            
            // Draw emoji
            this.ctx.font = `${size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add shadow for depth
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.ctx.shadowBlur = 10 * collectible.scale;
            this.ctx.shadowOffsetY = 5 * collectible.scale;
            
            this.ctx.fillText(collectible.type.emoji, collectible.x, collectible.y);
            
            // Reset shadow
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetY = 0;
        });
    }

    /**
     * Draw bolt projectiles
     */
    drawBoltProjectiles() {
        if (!this.ctx || !this.canvas) return;
        
        // Draw each bolt
        this.boltProjectiles.forEach(bolt => {
            // Draw bolt emoji with rotation
            this.ctx.save();
            this.ctx.translate(bolt.x, bolt.y);
            this.ctx.rotate(0); // Bolt points right (0 radians)
            
            this.ctx.font = `${bolt.size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add motion blur effect
            this.ctx.shadowColor = 'rgba(139, 69, 19, 0.5)';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowOffsetX = -10; // Trail effect
            
            this.ctx.fillText(bolt.type.emoji, 0, 0);
            
            this.ctx.restore();
        });
    }

    /**
     * Draw fireball projectiles
     */
    drawFireballProjectiles() {
        if (!this.ctx || !this.canvas) return;
        
        // Draw each fireball
        this.fireballProjectiles.forEach(fireball => {
            this.ctx.save();
            this.ctx.translate(fireball.x, fireball.y);
            
            this.ctx.font = `${fireball.size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add glow effect
            this.ctx.shadowColor = 'rgba(255, 69, 0, 0.8)';
            this.ctx.shadowBlur = 20;
            
            this.ctx.fillText('🔥', 0, 0);
            
            this.ctx.restore();
        });
    }

    /**
     * Draw enemies on screen
     */
    drawEnemies() {
        if (!this.ctx || !this.canvas) return;
        
        const now = Date.now();
        
        this.enemies.forEach(enemy => {
            // For sequence-based enemies, currentVideo is already set by startEnemyStep
            // For legacy state-based enemies, use old logic
            let videoName = null;
            if (enemy.sequence) {
                // Sequence-based: use the currentVideo that was set by startEnemyStep
                videoName = enemy.currentVideo;
            } else {
                // Legacy state machine (for backward compatibility)
                if (enemy.state === 'approaching') {
                    videoName = 'approaching';
                } else if (enemy.state === 'leaving') {
                    videoName = 'leaving';
                } else if (enemy.state === 'idle') {
                    // During idle, randomly cycle between pacing and menacing
                    if (!enemy.currentVideo || !['pacing', 'menacing'].includes(enemy.currentVideo)) {
                        videoName = Math.random() > 0.5 ? 'pacing' : 'menacing';
                    } else {
                        // Keep current video unless it's time to change (every 3-5 seconds)
                        if (!enemy.lastIdleVideoChange || now - enemy.lastIdleVideoChange > this.getRandomInt(3000, 5000)) {
                            videoName = enemy.currentVideo === 'pacing' ? 'menacing' : 'pacing';
                            enemy.lastIdleVideoChange = now;
                        }
                    }
                } else if (enemy.state === 'rearing') {
                    videoName = 'menacing';
                } else if (enemy.state === 'attacking') {
                    videoName = Math.random() > 0.5 ? 'attack1' : 'attack2';
                }
            }
            
            // Start video if changed or not started (only for legacy enemies)
            if (!enemy.sequence && videoName && this.videosLoaded && this.ratVideos[videoName]) {
                if (enemy.currentVideo !== videoName) {
                    enemy.currentVideo = videoName;
                    enemy.videoStartTime = now;
                    const video = this.ratVideos[videoName];
                    video.currentTime = 0;
                    video.play().catch(e => console.warn('Video play failed:', e));
                }
            }
            
            // Determine animation transforms (simplified for sequence-based)
            let scale = 1;
            let rotation = 0;
            let yOffset = 0;
            
            if (enemy.sequence) {
                // For sequence-based enemies, just use current animation
                // No special transforms needed - animations are in the videos
            } else {
                // Legacy transforms
                if (enemy.state === 'idle') {
                    const timeSinceCreated = (now - enemy.createdAt) / 1000;
                    yOffset = Math.sin(timeSinceCreated * enemy.jeerBobSpeed) * 8;
                } else if (enemy.state === 'rearing') {
                    const rearingProgress = (now - enemy.rearingStartTime) / enemy.rearingDuration;
                    scale = 1 + (rearingProgress * 0.3);
                } else if (enemy.state === 'attacking') {
                    scale = 1.3;
                    rotation = 0.3;
                }
            }
            
            this.ctx.save();
            this.ctx.translate(enemy.x, enemy.y + yOffset);
            this.ctx.rotate(rotation);
            
            const size = enemy.size * scale;
            
            // Try to draw video, fall back to emoji
            if (this.videosLoaded && enemy.currentVideo && this.ratVideos[enemy.currentVideo]) {
                const video = this.ratVideos[enemy.currentVideo];
                
                // Maintain video's natural aspect ratio (videos are ~16:9, 213x120px)
                const videoAspectRatio = video.videoWidth / video.videoHeight;
                const videoHeight = size * 2;
                const videoWidth = videoHeight * videoAspectRatio;
                
                // Add red glow when attacking
                const isAttacking = enemy.currentVideo === 'attack1' || enemy.currentVideo === 'attack2';
                if (isAttacking) {
                    this.ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
                    this.ctx.shadowBlur = 20;
                }
                
                this.ctx.drawImage(video, -videoWidth/2, -videoHeight/2, videoWidth, videoHeight);
            } else {
                // Fallback to emoji
                this.ctx.font = `${size}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                const isAttacking = enemy.currentVideo === 'attack1' || enemy.currentVideo === 'attack2';
                if (isAttacking) {
                    this.ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
                    this.ctx.shadowBlur = 20;
                }
                
                this.ctx.fillText(enemy.emoji, 0, 0);
            }
            
            this.ctx.restore();
            
            // Draw health bar above enemy
            this.drawEnemyHealthBar(enemy);
        });
    }
    
    /**
     * Draw health bar above enemy
     */
    drawEnemyHealthBar(enemy) {
        const isBoss = enemy.isBoss || false;
        const barWidth = isBoss ? 200 : 80; // Boss gets wider health bar
        const barHeight = isBoss ? 12 : 8; // Boss gets taller health bar
        const barX = enemy.x - barWidth / 2;
        const barY = enemy.y - enemy.size * 0.8;
        
        // Background bar (dark)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Health bar (red to yellow gradient based on health)
        const healthPercent = enemy.health / enemy.maxHealth;
        const healthWidth = barWidth * healthPercent;
        
        // Color gradient: red when low, yellow when medium, green when high
        if (healthPercent > 0.5) {
            this.ctx.fillStyle = '#4ade80'; // Green
        } else if (healthPercent > 0.25) {
            this.ctx.fillStyle = '#fbbf24'; // Yellow
        } else {
            this.ctx.fillStyle = '#ef4444'; // Red
        }
        
        this.ctx.fillRect(barX, barY, healthWidth, barHeight);
        
        // Border - make it gold for boss
        this.ctx.strokeStyle = isBoss ? 'rgba(255, 215, 0, 1)' : 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = isBoss ? 2 : 1;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Add boss label above health bar
        if (isBoss) {
            this.ctx.save();
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillStyle = '#FFD700';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText('BOSS', enemy.x, barY - 5);
            this.ctx.fillText('BOSS', enemy.x, barY - 5);
            this.ctx.restore();
        }
    }

    /**
     * Draw fingertip indicators on the video overlay
     */
    drawFingertipIndicators(keypoints) {
        if (!this.ctx || !this.canvas) return;
        
        // If in crossbow mode (shooting gesture), show crossbow indicator
        if (this.isPointing) {
            const wrist = keypoints[0];
            const indexTip = keypoints[8];
            
            // Calculate angle of hand orientation
            const dx = indexTip.x - wrist.x;
            const dy = indexTip.y - wrist.y;
            const angle = Math.atan2(dy, dx);
            
            // Draw crossbow emoji
            this.ctx.save();
            
            // Position at center of hand
            const centerX = (wrist.x + indexTip.x) / 2;
            const centerY = (wrist.y + indexTip.y) / 2;
            
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(angle);
            
            // Draw crossbow emoji
            this.ctx.font = 'bold 80px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add glow effect
            this.ctx.shadowColor = 'rgba(139, 69, 19, 0.8)';
            this.ctx.shadowBlur = 15;
            
            this.ctx.fillText('🏹', 0, 0);
            
            this.ctx.restore();
            
            // Add text indicator at top of screen
            this.ctx.save();
            this.ctx.font = 'bold 40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#8B4513';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText('🏹 CROSSBOW READY', this.canvas.width / 2, 60);
            this.ctx.fillText('🏹 CROSSBOW READY', this.canvas.width / 2, 60);
            this.ctx.restore();
            
            return;
        }
        
        // Get thumb and index finger tips for pinch visualization
        const thumbTip = keypoints[4];
        const indexTip = keypoints[8];
        
        // Check if electricity is active
        const isElectrified = this.electrifiedPinchesRemaining > 0;
        
        // Determine color based on grabbing state and electricity
        const color = this.isGrabbing ? '#00FF00' : (isElectrified ? '#00FFFF' : '#FFD700');
        const radius = this.isGrabbing ? 4 : (isElectrified ? 4 : 3);
        
        // Draw thumb tip
        this.ctx.beginPath();
        this.ctx.arc(thumbTip.x, thumbTip.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = this.isGrabbing ? '#FFFFFF' : (isElectrified ? '#FFFF00' : '#FFA500');
        this.ctx.lineWidth = isElectrified ? 2 : 1;
        this.ctx.stroke();
        
        // Add electric glow for electrified mode
        if (isElectrified && !this.isGrabbing) {
            this.ctx.shadowColor = '#00FFFF';
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(thumbTip.x, thumbTip.y, radius + 2, 0, 2 * Math.PI);
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        // Draw index tip
        this.ctx.beginPath();
        this.ctx.arc(indexTip.x, indexTip.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = this.isGrabbing ? '#FFFFFF' : (isElectrified ? '#FFFF00' : '#FFA500');
        this.ctx.lineWidth = isElectrified ? 2 : 1;
        this.ctx.stroke();
        
        // Add electric glow for electrified mode
        if (isElectrified && !this.isGrabbing) {
            this.ctx.shadowColor = '#00FFFF';
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(indexTip.x, indexTip.y, radius + 2, 0, 2 * Math.PI);
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        // Draw animated electricity between fingers when electrified and not grabbing
        if (isElectrified && !this.isGrabbing) {
            const distance = Math.sqrt(
                Math.pow(indexTip.x - thumbTip.x, 2) + 
                Math.pow(indexTip.y - thumbTip.y, 2)
            );
            
            // Only show electricity if fingers are close but not touching (pinching range)
            if (distance < 100 && distance > 10) {
                this.drawElectricArc(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);
            }
        }
        
        // Draw line between them when grabbing
        if (this.isGrabbing) {
            this.ctx.beginPath();
            this.ctx.moveTo(thumbTip.x, thumbTip.y);
            this.ctx.lineTo(indexTip.x, indexTip.y);
            this.ctx.strokeStyle = isElectrified ? '#00FFFF' : '#00FF00';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }

    /**
     * Draw animated electric arc between two points
     */
    drawElectricArc(x1, y1, x2, y2) {
        if (!this.ctx) return;
        
        const segments = 8; // Number of segments for the lightning bolt
        const jitter = 15; // Maximum offset from straight line
        
        // Create array of points along the path with random offsets
        const points = [{x: x1, y: y1}];
        
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const midX = x1 + (x2 - x1) * t;
            const midY = y1 + (y2 - y1) * t;
            
            // Add random perpendicular offset
            const dx = x2 - x1;
            const dy = y2 - y1;
            const perpX = -dy;
            const perpY = dx;
            const length = Math.sqrt(perpX * perpX + perpY * perpY);
            
            const offset = (Math.random() - 0.5) * jitter;
            const offsetX = (perpX / length) * offset;
            const offsetY = (perpY / length) * offset;
            
            points.push({
                x: midX + offsetX,
                y: midY + offsetY
            });
        }
        
        points.push({x: x2, y: y2});
        
        // Draw main lightning bolt
        this.ctx.save();
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 10;
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.stroke();
        
        // Draw brighter inner bolt
        this.ctx.strokeStyle = '#FFFF00';
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 5;
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    /**
     * Clear the canvas
     */
    clearCanvas() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * Reset the game
     */
    reset() {
        this.collectedCount = 0;
        this.boltCount = 0;
        this.collectibles = [];
        this.inventory = {
            'acorn': 0,
            'mushroom': 0,
            'pinecone': 0,
            'leaf': 0,
            'bolt': 0
        };
        this.updateCounter();
        this.updateBoltCounter();
        this.updateInventoryDisplay();
        this.clearCanvas();
    }

    /**
     * Get current score
     */
    getScore() {
        return this.collectedCount;
    }

    /**
     * Set up inventory panel and event listeners
     */
    setupInventoryPanel() {
        // Add click handler to collectibles counter to open inventory
        const counter = document.querySelector('.collectibles-counter');
        if (counter) {
            counter.style.cursor = 'pointer';
            counter.addEventListener('click', () => this.openInventory());
        }
        
        // Add click handler to bolt counter to open inventory on weapons tab
        const boltCounter = document.querySelector('.bolt-counter');
        if (boltCounter) {
            boltCounter.style.cursor = 'pointer';
            boltCounter.addEventListener('click', () => {
                this.openInventory();
                // Switch to weapons tab after a brief delay to ensure panel is open
                setTimeout(() => this.switchTab('weapons'), 50);
            });
        }
    }

    /**
     * Open the inventory panel
     */
    openInventory() {
        if (this.inventoryOpen) return;
        
        this.inventoryOpen = true;
        
        // Create inventory panel if it doesn't exist
        let panel = document.getElementById('inventoryPanel');
        if (!panel) {
            panel = this.createInventoryPanel();
        }
        
        panel.style.display = 'flex';
        this.updateInventoryDisplay();
        
        console.log('Inventory opened');
    }

    /**
     * Close the inventory panel
     */
    closeInventory() {
        if (!this.inventoryOpen) return;
        
        this.inventoryOpen = false;
        
        const panel = document.getElementById('inventoryPanel');
        if (panel) {
            panel.style.display = 'none';
        }
        
        console.log('Inventory closed');
    }

    /**
     * Create the inventory panel HTML with tabbed interface
     */
    createInventoryPanel() {
        const panel = document.createElement('div');
        panel.id = 'inventoryPanel';
        panel.className = 'inventory-panel';
        
        panel.innerHTML = `
            <div class="inventory-header">
                <h2>🎒 Inventory</h2>
                <button class="inventory-close" id="inventoryClose">✕</button>
            </div>
            <div class="inventory-xp-section">
                <div class="stat-bar">
                    <div class="stat-label">
                        Level <span id="levelDisplay">0</span>
                        <span class="xp-text" id="xpText">0/100 XP</span>
                    </div>
                    <div class="stat-bar-container">
                        <div class="stat-bar-fill xp-bar" id="xpBar"></div>
                    </div>
                </div>
            </div>
            <div class="inventory-body">
                <div class="inventory-left-panel">
                    <div class="inventory-tabs">
                        <button class="inventory-tab active" data-tab="collectibles">🌰 Objects</button>
                        <button class="inventory-tab" data-tab="weapons">⚔️ Weapons</button>
                        <button class="inventory-tab" data-tab="armor">🛡️ Armor</button>
                        <button class="inventory-tab" data-tab="magic">✨ Magic</button>
                    </div>
                    <div class="inventory-content">
                        <div class="inventory-tab-content active" id="collectibles-tab">
                            <div class="inventory-list" id="collectiblesList"></div>
                        </div>
                        <div class="inventory-tab-content" id="weapons-tab">
                            <div class="inventory-list" id="weaponsList">
                                <div class="inventory-empty">No weapons yet</div>
                            </div>
                        </div>
                        <div class="inventory-tab-content" id="armor-tab">
                            <div class="inventory-list" id="armorList">
                                <div class="inventory-empty">No armor yet</div>
                            </div>
                        </div>
                        <div class="inventory-tab-content" id="magic-tab">
                            <div class="inventory-list" id="magicList">
                                <div class="inventory-empty">No magic items yet</div>
                            </div>
                        </div>
                    </div>
                    <div class="inventory-equip-section">
                        <button class="inventory-equip-btn" id="inventoryEquipBtn">
                            ⚔️ Equip Items
                        </button>
                    </div>
                </div>
                <div class="inventory-right-panel">
                    <div class="brew-panel-header">
                        <h3>🧪 Brew Potions</h3>
                    </div>
                    <div class="brew-panel-content" id="brewPanelContent">
                        <!-- Brew recipes will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Add close button handler
        const closeBtn = panel.querySelector('#inventoryClose');
        closeBtn.addEventListener('click', () => this.closeInventory());
        
        // Add tab switching handlers
        const tabs = panel.querySelectorAll('.inventory-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Add equip button handler
        const equipBtn = panel.querySelector('#inventoryEquipBtn');
        if (equipBtn) {
            equipBtn.addEventListener('click', () => this.showEquipMenu());
        }
        
        // Populate brew panel
        this.updateBrewPanel();
        
        return panel;
    }

    /**
     * Switch between inventory tabs
     */
    switchTab(tabName) {
        // Update active tab button
        const tabs = document.querySelectorAll('.inventory-tab');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Update active tab content
        const tabContents = document.querySelectorAll('.inventory-tab-content');
        tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
        
        // Update magic tab with potions when switched to
        if (tabName === 'magic') {
            this.updateMagicList();
        }
    }

    /**
     * Update the brew panel in the inventory with current recipes
     */
    updateBrewPanel() {
        const brewPanelContent = document.getElementById('brewPanelContent');
        if (!brewPanelContent) return;
        
        const app = window.app;
        if (!app) return;
        
        // Check healing potion ingredients
        const hasAcornHealing = this.inventory.acorn >= 1;
        const hasMushroom = this.inventory.mushroom >= 1;
        const hasLeafHealing = this.inventory.leaf >= 1;
        const hasMagicHealing = app.magic >= 33;
        const canBrewHealing = hasAcornHealing && hasMushroom && hasLeafHealing && hasMagicHealing;
        
        // Check electricity potion ingredients
        const hasCrystals = this.inventory.crystal >= 3;
        const hasMagicElectricity = app.magic >= 33;
        const canBrewElectricity = hasCrystals && hasMagicElectricity;
        
        // Check mana potion ingredients
        const hasAcornMana = this.inventory.acorn >= 1;
        const hasLeafMana = this.inventory.leaf >= 1;
        const hasMagicMana = app.magic >= 50;
        const canBrewMana = hasAcornMana && hasLeafMana && hasMagicMana;
        
        // Check toad tongue potion ingredients
        const hasMushrooms = this.inventory.mushroom >= 2;
        const hasAcornToad = this.inventory.acorn >= 1;
        const hasMagicToad = app.magic >= 33;
        const canBrewToadTongue = hasMushrooms && hasAcornToad && hasMagicToad;
        
        brewPanelContent.innerHTML = `
            <div class="brew-recipe-compact">
                <div class="brew-recipe-line">
                    <h4>🧪 Healing</h4>
                    <div class="brew-ingredients-compact">
                        <span class="${hasAcornHealing ? 'ingredient-available' : 'ingredient-missing'}">1 🌰</span>
                        <span class="${hasMushroom ? 'ingredient-available' : 'ingredient-missing'}">1 🍄</span>
                        <span class="${hasLeafHealing ? 'ingredient-available' : 'ingredient-missing'}">1 🍂</span>
                        <span class="${hasMagicHealing ? 'ingredient-available' : 'ingredient-missing'}">33 ✨</span>
                    </div>
                    <button class="brew-btn-compact" data-recipe="healing" ${canBrewHealing ? '' : 'disabled'}>Brew</button>
                </div>
            </div>
            <div class="brew-recipe-compact">
                <div class="brew-recipe-line">
                    <h4>⚡ Electricity</h4>
                    <div class="brew-ingredients-compact">
                        <span class="${hasCrystals ? 'ingredient-available' : 'ingredient-missing'}">3 🔶</span>
                        <span class="${hasMagicElectricity ? 'ingredient-available' : 'ingredient-missing'}">33 ✨</span>
                    </div>
                    <button class="brew-btn-compact" data-recipe="electricity" ${canBrewElectricity ? '' : 'disabled'}>Brew</button>
                </div>
            </div>
            <div class="brew-recipe-compact">
                <div class="brew-recipe-line">
                    <h4>🔮 Mana</h4>
                    <div class="brew-ingredients-compact">
                        <span class="${hasAcornMana ? 'ingredient-available' : 'ingredient-missing'}">1 🌰</span>
                        <span class="${hasLeafMana ? 'ingredient-available' : 'ingredient-missing'}">1 🍂</span>
                        <span class="${hasMagicMana ? 'ingredient-available' : 'ingredient-missing'}">50 ✨</span>
                    </div>
                    <button class="brew-btn-compact" data-recipe="mana" ${canBrewMana ? '' : 'disabled'}>Brew</button>
                </div>
            </div>
            <!--
            <div class="brew-recipe-compact">
                <div class="brew-recipe-line">
                    <h4>👅 Toad Tongue</h4>
                    <div class="brew-ingredients-compact">
                        <span class="${hasMushrooms ? 'ingredient-available' : 'ingredient-missing'}">2 🍄</span>
                        <span class="${hasAcornToad ? 'ingredient-available' : 'ingredient-missing'}">1 🌰</span>
                        <span class="${hasMagicToad ? 'ingredient-available' : 'ingredient-missing'}">33 ✨</span>
                    </div>
                    <button class="brew-btn-compact" data-recipe="toadtongue" ${canBrewToadTongue ? '' : 'disabled'}>Brew</button>
                </div>
            </div>
            -->
        `;
        
        // Add brew button handlers
        const brewButtons = brewPanelContent.querySelectorAll('.brew-btn-compact');
        brewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recipe = e.target.dataset.recipe;
                this.brewPotion(recipe);
            });
        });
    }

    /**
     * Show equipment management menu
     */
    showEquipMenu() {
        // Create equipment modal
        const equipModal = document.createElement('div');
        equipModal.className = 'equip-modal';
        equipModal.innerHTML = `
            <div class="equip-modal-content">
                <button class="equip-close-x" aria-label="Close">&times;</button>
                <h2>⚔️ Equipment Manager</h2>
                <p class="equip-subtitle">Equip weapons, armor, and magic items</p>
                
                <div class="equip-layout">
                    <svg class="equip-connections" width="100%" height="100%">
                        <line class="equip-line" x1="0" y1="0" x2="0" y2="0" data-slot="head" />
                        <line class="equip-line" x1="0" y1="0" x2="0" y2="0" data-slot="armor" />
                        <line class="equip-line" x1="0" y1="0" x2="0" y2="0" data-slot="feet" />
                        <line class="equip-line" x1="0" y1="0" x2="0" y2="0" data-slot="weapon" />
                        <line class="equip-line" x1="0" y1="0" x2="0" y2="0" data-slot="shield" />
                        <line class="equip-line" x1="0" y1="0" x2="0" y2="0" data-slot="accessory1" />
                        <line class="equip-line" x1="0" y1="0" x2="0" y2="0" data-slot="accessory2" />
                    </svg>
                    
                    <!-- Human Figure -->
                    <div class="equip-figure">
                        <svg viewBox="0 0 200 400" class="human-svg">
                            <!-- Head -->
                            <circle cx="100" cy="50" r="35" fill="none" stroke="#fbbf24" stroke-width="3" data-part="head"/>
                            <!-- Neck -->
                            <line x1="100" y1="85" x2="100" y2="110" stroke="#fbbf24" stroke-width="3"/>
                            <!-- Torso -->
                            <rect x="65" y="110" width="70" height="100" rx="10" fill="none" stroke="#fbbf24" stroke-width="3" data-part="armor"/>
                            <!-- Left Arm (weapon side) -->
                            <line x1="65" y1="120" x2="30" y2="140" stroke="#fbbf24" stroke-width="3" data-part="weapon"/>
                            <line x1="30" y1="140" x2="20" y2="180" stroke="#fbbf24" stroke-width="3"/>
                            <circle cx="20" cy="185" r="8" fill="none" stroke="#fbbf24" stroke-width="2" data-part="accessory1"/>
                            <!-- Right Arm (shield side) -->
                            <line x1="135" y1="120" x2="170" y2="140" stroke="#fbbf24" stroke-width="3" data-part="shield"/>
                            <line x1="170" y1="140" x2="180" y2="180" stroke="#fbbf24" stroke-width="3"/>
                            <circle cx="180" cy="185" r="8" fill="none" stroke="#fbbf24" stroke-width="2" data-part="accessory2"/>
                            <!-- Left Leg -->
                            <line x1="80" y1="210" x2="70" y2="310" stroke="#fbbf24" stroke-width="3"/>
                            <ellipse cx="70" cy="320" rx="15" ry="8" fill="none" stroke="#fbbf24" stroke-width="2" data-part="feet"/>
                            <!-- Right Leg -->
                            <line x1="120" y1="210" x2="130" y2="310" stroke="#fbbf24" stroke-width="3"/>
                            <ellipse cx="130" cy="320" rx="15" ry="8" fill="none" stroke="#fbbf24" stroke-width="2" data-part="feet"/>
                        </svg>
                    </div>
                    
                    <!-- Head Dropdown (top) -->
                    <div class="equip-section equip-pos-head" data-slot="head">
                        <h3>👤 Head</h3>
                        <select class="equip-dropdown" id="headDropdown">
                            <option value="">None</option>
                            ${this.getEquipmentOptions('head', 'head')}
                        </select>
                    </div>
                    
                    <!-- Armor Dropdown (left middle) -->
                    <div class="equip-section equip-pos-armor" data-slot="armor">
                        <h3>🎽 Armor</h3>
                        <select class="equip-dropdown" id="armorDropdown">
                            <option value="">None</option>
                            ${this.getEquipmentOptions('armor', 'armor')}
                        </select>
                    </div>
                    
                    <!-- Feet Dropdown (bottom) -->
                    <div class="equip-section equip-pos-feet" data-slot="feet">
                        <h3>👟 Feet</h3>
                        <select class="equip-dropdown" id="feetDropdown">
                            <option value="">None</option>
                            ${this.getEquipmentOptions('feet', 'feet')}
                        </select>
                    </div>
                    
                    <!-- Weapon Dropdown (left) -->
                    <div class="equip-section equip-pos-weapon" data-slot="weapon">
                        <h3>🗡️ Weapon</h3>
                        <select class="equip-dropdown" id="weaponDropdown">
                            <option value="">None</option>
                            ${this.getEquipmentOptions('weapon', 'weapon')}
                        </select>
                    </div>
                    
                    <!-- Shield Dropdown (right) -->
                    <div class="equip-section equip-pos-shield" data-slot="shield">
                        <h3>🛡️ Shield</h3>
                        <select class="equip-dropdown" id="shieldDropdown">
                            <option value="">None</option>
                            ${this.getEquipmentOptions('shield', 'shield')}
                        </select>
                    </div>
                    
                    <!-- Accessory 1 Dropdown (left hand) -->
                    <div class="equip-section equip-pos-accessory1" data-slot="accessory1">
                        <h3>💍 Accessory 1</h3>
                        <select class="equip-dropdown" id="accessory1Dropdown">
                            <option value="">None</option>
                            ${this.getEquipmentOptions('accessory', 'accessory1')}
                        </select>
                    </div>
                    
                    <!-- Accessory 2 Dropdown (right hand) -->
                    <div class="equip-section equip-pos-accessory2" data-slot="accessory2">
                        <h3>💍 Accessory 2</h3>
                        <select class="equip-dropdown" id="accessory2Dropdown">
                            <option value="">None</option>
                            ${this.getEquipmentOptions('accessory', 'accessory2')}
                        </select>
                    </div>
                </div>
                
                <button class="equip-close-btn">Close</button>
            </div>
        `;
        
        document.body.appendChild(equipModal);
        
        // Update connection lines after render
        setTimeout(() => this.updateEquipmentLines(equipModal), 10);
        
        // Add dropdown change handlers
        ['weapon', 'head', 'armor', 'feet', 'shield', 'accessory1', 'accessory2'].forEach(slot => {
            const dropdown = equipModal.querySelector(`#${slot}Dropdown`);
            if (dropdown) {
                dropdown.value = this.equippedItems[slot] || '';
                dropdown.addEventListener('change', (e) => {
                    this.equipItem(slot, e.target.value);
                });
            }
        });
        
        // Add close button handlers
        const closeBtn = equipModal.querySelector('.equip-close-btn');
        closeBtn.addEventListener('click', () => {
            equipModal.remove();
        });
        
        const closeX = equipModal.querySelector('.equip-close-x');
        closeX.addEventListener('click', () => {
            equipModal.remove();
        });
    }
    
    /**
     * Update connection lines between dropdowns and body parts
     */
    updateEquipmentLines(modal) {
        const figure = modal.querySelector('.equip-figure');
        if (!figure) return;
        
        const figureRect = figure.getBoundingClientRect();
        const layout = modal.querySelector('.equip-layout');
        const layoutRect = layout.getBoundingClientRect();
        
        // Body part positions (relative to figure, normalized 0-1)
        const bodyParts = {
            head: { x: 0.5, y: 0.125 },      // Top of head
            armor: { x: 0.5, y: 0.4 },       // Center of torso
            feet: { x: 0.5, y: 0.8 },        // Bottom feet
            weapon: { x: 0.15, y: 0.45 },    // Left hand weapon
            shield: { x: 0.85, y: 0.45 },    // Right hand shield
            accessory1: { x: 0.1, y: 0.46 }, // Left hand
            accessory2: { x: 0.9, y: 0.46 }  // Right hand
        };
        
        Object.keys(bodyParts).forEach(slot => {
            const dropdown = modal.querySelector(`[data-slot="${slot}"]`);
            const line = modal.querySelector(`line[data-slot="${slot}"]`);
            
            if (dropdown && line) {
                const dropdownRect = dropdown.getBoundingClientRect();
                const part = bodyParts[slot];
                
                // Calculate body part position in layout coordinates
                const bodyX = (figureRect.left - layoutRect.left) + (figureRect.width * part.x);
                const bodyY = (figureRect.top - layoutRect.top) + (figureRect.height * part.y);
                
                // Calculate dropdown center position
                const dropX = (dropdownRect.left - layoutRect.left) + (dropdownRect.width / 2);
                const dropY = (dropdownRect.top - layoutRect.top) + (dropdownRect.height / 2);
                
                // Update line
                line.setAttribute('x1', dropX);
                line.setAttribute('y1', dropY);
                line.setAttribute('x2', bodyX);
                line.setAttribute('y2', bodyY);
            }
        });
    }
    
    /**
     * Get equipment options for dropdown
     */
    getEquipmentOptions(category, currentSlot = null) {
        const items = this.equipment[category] || {};
        return Object.entries(items)
            .filter(([name, count]) => {
                // Only show items that are available (count > 0)
                if (count <= 0) return false;
                
                // Don't show items that are already equipped elsewhere
                // But allow the item if it's equipped in the current slot we're viewing
                for (const [slot, equippedItem] of Object.entries(this.equippedItems)) {
                    if (equippedItem === name && slot !== currentSlot) {
                        return false;
                    }
                }
                return true;
            })
            .map(([name, count]) => `<option value="${name}">${name} (${count})</option>`)
            .join('');
    }
    
    /**
     * Equip an item
     */
    equipItem(slot, itemName) {
        if (!itemName) {
            // Unequip
            if (this.equippedItems[slot]) {
                const oldItem = this.equippedItems[slot];
                this.equippedItems[slot] = null;
                console.log(`Unequipped ${oldItem} from ${slot}`);
                this.refreshEquipmentDropdowns();
                this.updateInventoryDisplay();
            }
            return;
        }
        
        const category = this.getItemCategory(slot);
        
        // Check if item is available
        if (!this.equipment[category][itemName] || this.equipment[category][itemName] <= 0) {
            console.warn(`Cannot equip ${itemName} - not in inventory`);
            return;
        }
        
        // Check if item is already equipped elsewhere
        for (const [equippedSlot, equippedItem] of Object.entries(this.equippedItems)) {
            if (equippedItem === itemName && equippedSlot !== slot) {
                console.warn(`Cannot equip ${itemName} - already equipped in ${equippedSlot}`);
                // Reset dropdown to current value
                const dropdown = document.getElementById(`${slot}Dropdown`);
                if (dropdown) {
                    dropdown.value = this.equippedItems[slot] || '';
                }
                return;
            }
        }
        
        // Just swap equipped items without changing inventory counts
        this.equippedItems[slot] = itemName;
        console.log(`Equipped ${itemName} to ${slot}`);
        
        // Refresh all dropdowns to update availability
        this.refreshEquipmentDropdowns();
        this.updateInventoryDisplay();
    }
    
    /**
     * Refresh all equipment dropdowns to reflect current availability
     */
    refreshEquipmentDropdowns() {
        const slots = ['weapon', 'head', 'armor', 'feet', 'shield', 'accessory1', 'accessory2'];
        
        slots.forEach(slot => {
            const dropdown = document.getElementById(`${slot}Dropdown`);
            if (dropdown) {
                const currentValue = this.equippedItems[slot] || '';
                const category = this.getItemCategory(slot);
                
                // Rebuild options with current slot passed so equipped item appears
                dropdown.innerHTML = `
                    <option value="">None</option>
                    ${this.getEquipmentOptions(category, slot)}
                `;
                
                // Set value to currently equipped item
                dropdown.value = currentValue;
            }
        });
    }
    
    /**
     * Get item category from slot name
     */
    getItemCategory(slot) {
        if (slot === 'accessory1' || slot === 'accessory2') return 'accessory';
        return slot;
    }

    /**
     * Update the inventory display with current counts (sorted by quantity)
     */
    updateInventoryDisplay() {
        // Update collectibles tab (Objects)
        const listContainer = document.getElementById('collectiblesList');
        if (listContainer) {
            // Create array of items with their counts for sorting
            // Filter out bolts - they're displayed only in Weapons section
            const items = this.types
                .filter(type => type.name !== 'bolt')
                .map(type => ({
                    type: type,
                    count: this.inventory[type.name] || 0
                }));
            
            // Sort by count (descending) so items with most quantity appear first
            items.sort((a, b) => b.count - a.count);
            
            // Generate HTML for sorted items
            listContainer.innerHTML = items.map(item => `
                <div class="inventory-list-item" data-type="${item.type.name}">
                    <div class="inventory-list-emoji">${item.type.emoji}</div>
                    <div class="inventory-list-info">
                        <div class="inventory-list-name">${item.type.name} <span class="inventory-list-count" id="inventory-${item.type.name}">(${item.count})</span></div>
                    </div>
                    <button class="inventory-list-use" data-type="${item.type.name}" ${item.count === 0 ? 'disabled' : ''}>
                        Use
                    </button>
                </div>
            `).join('');
            
            // Add use button handlers
            const useButtons = listContainer.querySelectorAll('.inventory-list-use');
            useButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const itemType = e.target.dataset.type;
                    this.useItem(itemType);
                });
            });
        }
        
        // Update weapons tab (Bolts + Equipment Weapons)
        const weaponsList = document.getElementById('weaponsList');
        if (weaponsList) {
            let html = '';
            
            // Add bolts if any
            const boltType = this.types.find(type => type.name === 'bolt');
            if (boltType && this.boltCount > 0) {
                html += `
                    <div class="inventory-list-item" data-type="bolt">
                        <div class="inventory-list-emoji">${boltType.emoji}</div>
                        <div class="inventory-list-info">
                            <div class="inventory-list-name">Crossbow Bolt</div>
                            <div class="inventory-list-count" id="inventory-bolt">
                                Quantity: <span class="count-value">${this.boltCount}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Add equipment weapons
            if (this.equipment.weapon) {
                Object.entries(this.equipment.weapon).forEach(([name, count]) => {
                    const isEquipped = this.equippedItems.weapon === name;
                    if (count > 0 || isEquipped) {
                        html += `
                            <div class="inventory-list-item" data-type="${name}">
                                <div class="inventory-list-emoji">🗡️</div>
                                <div class="inventory-list-info">
                                    <div class="inventory-list-name">${name}${isEquipped ? ' ✓ Equipped' : ''}</div>
                                    <div class="inventory-list-count">
                                        Quantity: <span class="count-value">${count}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                });
            }
            
            weaponsList.innerHTML = html || '<div class="inventory-empty">No weapons yet</div>';
        }
        
        // Update armor tab
        this.updateArmorList();
        
        // Update brew panel
        this.updateBrewPanel();
    }

    /**
     * Update armor tab list
     */
    updateArmorList() {
        const armorList = document.getElementById('armorList');
        if (!armorList) return;
        
        const armorItems = [];
        
        // Add equipment head items
        if (this.equipment.head) {
            Object.entries(this.equipment.head).forEach(([name, count]) => {
                const isEquipped = this.equippedItems.head === name;
                if (count > 0 || isEquipped) {
                    armorItems.push({
                        name: name + (isEquipped ? ' ✓ Equipped' : ''),
                        emoji: '🧢',
                        count: count,
                        category: 'Head'
                    });
                }
            });
        }
        
        // Add equipment armor items
        if (this.equipment.armor) {
            Object.entries(this.equipment.armor).forEach(([name, count]) => {
                const isEquipped = this.equippedItems.armor === name;
                if ((count > 0 || isEquipped) && name !== 'buckler') {
                    armorItems.push({
                        name: name + (isEquipped ? ' ✓ Equipped' : ''),
                        emoji: '🎽',
                        count: count,
                        category: 'Armor'
                    });
                }
            });
        }
        
        // Add equipment feet items
        if (this.equipment.feet) {
            Object.entries(this.equipment.feet).forEach(([name, count]) => {
                const isEquipped = this.equippedItems.feet === name;
                if (count > 0 || isEquipped) {
                    armorItems.push({
                        name: name + (isEquipped ? ' ✓ Equipped' : ''),
                        emoji: '👟',
                        count: count,
                        category: 'Feet'
                    });
                }
            });
        }
        
        // Add equipment shield items
        if (this.equipment.shield) {
            Object.entries(this.equipment.shield).forEach(([name, count]) => {
                const isEquipped = this.equippedItems.shield === name;
                if (count > 0 || isEquipped) {
                    armorItems.push({
                        name: name + (isEquipped ? ' ✓ Equipped' : ''),
                        emoji: '🛡️',
                        count: count,
                        category: 'Shield'
                    });
                }
            });
        }
        
        // Legacy buckler
        if (this.armor.buckler > 0) {
            armorItems.push({
                name: 'Buckler Shield',
                emoji: '🛡️',
                count: this.armor.buckler,
                category: 'Shield (Legacy)'
            });
        }
        
        if (armorItems.length === 0) {
            armorList.innerHTML = '<div class="inventory-empty">No armor yet</div>';
            return;
        }
        
        armorList.innerHTML = armorItems.map(item => `
            <div class="inventory-list-item armor-item">
                <div class="inventory-list-emoji">${item.emoji}</div>
                <div class="inventory-list-info">
                    <div class="inventory-list-name">${item.name}</div>
                    <div class="inventory-list-description">${item.category}</div>
                    <div class="inventory-list-count">
                        Quantity: <span class="count-value">${item.count}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Use an item from inventory
     */
    useItem(itemType) {
        if (this.inventory[itemType] > 0) {
            this.inventory[itemType]--;
            this.collectedCount--;
            this.updateCounter();
            this.updateInventoryDisplay();
            console.log(`Used ${itemType}. Remaining: ${this.inventory[itemType]}`);
            // TODO: Add item effect
        }
    }

    /**
     * Update magic tab list with potions
     */
    updateMagicList() {
        const magicList = document.getElementById('magicList');
        if (!magicList) return;
        
        let html = '';
        
        // Add equipment accessories
        if (this.equipment.accessory) {
            Object.entries(this.equipment.accessory).forEach(([name, count]) => {
                const isEquipped = this.equippedItems.accessory1 === name || this.equippedItems.accessory2 === name;
                if (count > 0 || isEquipped) {
                    html += `
                        <div class="inventory-list-item magic-item">
                            <div class="inventory-list-emoji">💍</div>
                            <div class="inventory-list-info">
                                <div class="inventory-list-name">${name}${isEquipped ? ' ✓ Equipped' : ''}</div>
                                <div class="inventory-list-description">Magic Accessory</div>
                                <div class="inventory-list-count">
                                    Quantity: <span class="count-value">${count}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });
        }
        
        if (this.potions.healing === 0 && this.potions.electricity === 0 && this.potions.mana === 0 && !html) {
            magicList.innerHTML = '<div class="inventory-empty">No magic items yet</div>';
            return;
        }
        if (this.potions.healing > 0) {
            html += `
                <div class="inventory-list-item" data-type="healing">
                    <div class="inventory-list-emoji">🧪</div>
                    <div class="inventory-list-info">
                        <div class="inventory-list-name">Healing Potion</div>
                        <div class="inventory-list-count">
                            Quantity: <span class="count-value">${this.potions.healing}</span>
                        </div>
                    </div>
                    <button class="inventory-list-use" data-potion="healing">Use</button>
                </div>
            `;
        }
        
        if (this.potions.electricity > 0) {
            html += `
                <div class="inventory-list-item" data-type="electricity">
                    <div class="inventory-list-emoji">⚡</div>
                    <div class="inventory-list-info">
                        <div class="inventory-list-name">Electricity Potion</div>
                        <div class="inventory-list-count">
                            Quantity: <span class="count-value">${this.potions.electricity}</span>
                        </div>
                    </div>
                    <button class="inventory-list-use" data-potion="electricity">Use</button>
                </div>
            `;
        }
        
        if (this.potions.mana > 0) {
            html += `
                <div class="inventory-list-item" data-type="mana">
                    <div class="inventory-list-emoji">🔮</div>
                    <div class="inventory-list-info">
                        <div class="inventory-list-name">Mana Potion</div>
                        <div class="inventory-list-count">
                            Quantity: <span class="count-value">${this.potions.mana}</span>
                        </div>
                    </div>
                    <button class="inventory-list-use" data-potion="mana">Use</button>
                </div>
            `;
        }
        
        magicList.innerHTML = html;
        
        // Add use button handlers
        const useButtons = magicList.querySelectorAll('.inventory-list-use');
        useButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const potionType = e.target.dataset.potion;
                this.usePotion(potionType);
            });
        });
        
        // Update potion display on screen
        this.updatePotionDisplay();
    }

    /**
     * Update the on-screen potion display (left side of video)
     */
    updatePotionDisplay() {
        const potionDisplay = document.getElementById('potionDisplay');
        if (!potionDisplay) return;
        
        let html = '';
        
        // Healing potion (pink/red)
        if (this.potions.healing > 0) {
            html += `
                <div class="potion-display-item" data-potion="healing">
                    <span class="potion-display-icon">🧪</span>
                    <span class="potion-display-count">${this.potions.healing}</span>
                </div>
            `;
        }
        
        // Electricity/Shock potion (yellow/black)
        if (this.potions.electricity > 0) {
            html += `
                <div class="potion-display-item" data-potion="electricity">
                    <span class="potion-display-icon">⚡</span>
                    <span class="potion-display-count">${this.potions.electricity}</span>
                </div>
            `;
        }
        
        // Mana potion (blue)
        if (this.potions.mana > 0) {
            html += `
                <div class="potion-display-item" data-potion="mana">
                    <span class="potion-display-icon">🔮</span>
                    <span class="potion-display-count">${this.potions.mana}</span>
                </div>
            `;
        }
        
        // Toad Tongue potion (green)
        if (this.potions.toadtongue > 0) {
            html += `
                <div class="potion-display-item" data-potion="toadtongue">
                    <span class="potion-display-icon">👅</span>
                    <span class="potion-display-count">${this.potions.toadtongue}</span>
                </div>
            `;
        }
        
        // Future: Freeze potion (white/light blue)
        // if (this.potions.freeze > 0) { ... }
        
        // Future: Fire potion (orange/red)
        // if (this.potions.fire > 0) { ... }
        
        potionDisplay.innerHTML = html;
        
        // Add click handlers to potion items
        const potionItems = potionDisplay.querySelectorAll('.potion-display-item');
        potionItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const potionType = e.currentTarget.dataset.potion;
                if (potionType) {
                    this.usePotion(potionType);
                }
            });
        });
    }

    /**
     * Show brew potion menu with recipes
     */
    showBrewMenu() {
        const app = window.app;
        if (!app) return;
        
        // Check healing potion ingredients
        const hasAcornHealing = this.inventory.acorn >= 1;
        const hasMushroom = this.inventory.mushroom >= 1;
        const hasLeafHealing = this.inventory.leaf >= 1;
        const hasMagicHealing = app.magic >= 33;
        const canBrewHealing = hasAcornHealing && hasMushroom && hasLeafHealing && hasMagicHealing;
        
        const healingRecipe = `
            <div class="brew-recipe">
                <h4>🧪 Healing Potion</h4>
                <p>Restores 30 health</p>
                <div class="brew-ingredients">
                    <span class="${hasAcornHealing ? 'ingredient-available' : 'ingredient-missing'}">1 🌰 Acorn</span>
                    <span class="${hasMushroom ? 'ingredient-available' : 'ingredient-missing'}">1 🍄 Mushroom</span>
                    <span class="${hasLeafHealing ? 'ingredient-available' : 'ingredient-missing'}">1 🍂 Leaf</span>
                    <span class="${hasMagicHealing ? 'ingredient-available' : 'ingredient-missing'}">33 ✨ Magic</span>
                </div>
                <button class="brew-btn" data-recipe="healing" ${canBrewHealing ? '' : 'disabled'}>Brew</button>
            </div>
        `;
        
        // Check electricity potion ingredients
        const hasCrystals = this.inventory.crystal >= 3;
        const hasMagicElectricity = app.magic >= 33;
        const canBrewElectricity = hasCrystals && hasMagicElectricity;
        
        const electricityRecipe = `
            <div class="brew-recipe">
                <h4>⚡ Electricity Potion</h4>
                <p>Damages all enemies on screen</p>
                <div class="brew-ingredients">
                    <span class="${hasCrystals ? 'ingredient-available' : 'ingredient-missing'}" >3  Crystals</span>
                    <span class="${hasMagicElectricity ? 'ingredient-available' : 'ingredient-missing'}" >33  Magic</span>
                </div>
                <button class="brew-btn" data-recipe="electricity" ${canBrewElectricity ? '' : 'disabled'}>Brew</button>
            </div>
        `;
        
        // Check mana potion ingredients
        const hasAcornMana = this.inventory.acorn >= 1;
        const hasLeafMana = this.inventory.leaf >= 1;
        const hasMagicMana = app.magic >= 50;
        const canBrewMana = hasAcornMana && hasLeafMana && hasMagicMana;
        
        const manaRecipe = `
            <div class="brew-recipe">
                <h4>🔮 Mana Potion</h4>
                <p>Refills your magic bar</p>
                <div class="brew-ingredients">
                    <span class="${hasAcornMana ? 'ingredient-available' : 'ingredient-missing'}">1 🌰 Acorn</span>
                    <span class="${hasLeafMana ? 'ingredient-available' : 'ingredient-missing'}">1 🍂 Leaf</span>
                    <span class="${hasMagicMana ? 'ingredient-available' : 'ingredient-missing'}">50 ✨ Magic</span>
                </div>
                <button class="brew-btn" data-recipe="mana" ${canBrewMana ? '' : 'disabled'}>Brew</button>
            </div>
        `;
        
        // Create brew menu modal
        const brewModal = document.createElement('div');
        brewModal.className = 'brew-modal';
        brewModal.innerHTML = `
            <div class="brew-modal-content">
                <button class="brew-close-x" aria-label="Close">&times;</button>
                <h3>🧪 Brew Potions</h3>
                ${healingRecipe}
                ${electricityRecipe}
                ${manaRecipe}
                <button class="brew-close-btn">Close</button>
            </div>
        `;
        
        document.body.appendChild(brewModal);
        
        // Add brew button handlers
        const brewButtons = brewModal.querySelectorAll('.brew-btn');
        brewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recipe = e.target.dataset.recipe;
                this.brewPotion(recipe);
            });
        });
        
        // Add close button handler
        const closeBtn = brewModal.querySelector('.brew-close-btn');
        closeBtn.addEventListener('click', () => {
            brewModal.remove();
        });
        
        // Add X button handler
        const closeX = brewModal.querySelector('.brew-close-x');
        closeX.addEventListener('click', () => {
            brewModal.remove();
        });
    }

    /**
     * Refresh the brew menu to update ingredient availability
     */
    refreshBrewMenu() {
        const brewModal = document.querySelector('.brew-modal');
        if (!brewModal) return;
        
        const app = window.app;
        if (!app) return;
        
        // Check healing potion ingredients
        const hasAcornHealing = this.inventory.acorn >= 1;
        const hasMushroom = this.inventory.mushroom >= 1;
        const hasLeafHealing = this.inventory.leaf >= 1;
        const hasMagicHealing = app.magic >= 33;
        const canBrewHealing = hasAcornHealing && hasMushroom && hasLeafHealing && hasMagicHealing;
        
        const healingRecipe = `
            <div class="brew-recipe">
                <h4>🧪 Healing Potion</h4>
                <p>Restores 30 health</p>
                <div class="brew-ingredients">
                    <span class="${hasAcornHealing ? 'ingredient-available' : 'ingredient-missing'}">1 🌰 Acorn</span>
                    <span class="${hasMushroom ? 'ingredient-available' : 'ingredient-missing'}">1 🍄 Mushroom</span>
                    <span class="${hasLeafHealing ? 'ingredient-available' : 'ingredient-missing'}">1 🍂 Leaf</span>
                    <span class="${hasMagicHealing ? 'ingredient-available' : 'ingredient-missing'}">33 ✨ Magic</span>
                </div>
                <button class="brew-btn" data-recipe="healing" ${canBrewHealing ? '' : 'disabled'}>Brew</button>
            </div>
        `;
        
        // Check electricity potion ingredients
        const hasCrystals = this.inventory.crystal >= 3;
        const hasMagicElectricity = app.magic >= 33;
        const canBrewElectricity = hasCrystals && hasMagicElectricity;
        
        const electricityRecipe = `
            <div class="brew-recipe">
                <h4>⚡ Electricity Potion</h4>
                <p>Damages all enemies on screen</p>
                <div class="brew-ingredients">
                    <span class="${hasCrystals ? 'ingredient-available' : 'ingredient-missing'}">3 🔶 Crystals</span>
                    <span class="${hasMagicElectricity ? 'ingredient-available' : 'ingredient-missing'}">33 ✨ Magic</span>
                </div>
                <button class="brew-btn" data-recipe="electricity" ${canBrewElectricity ? '' : 'disabled'}>Brew</button>
            </div>
        `;
        
        // Check mana potion ingredients
        const hasAcornMana = this.inventory.acorn >= 1;
        const hasLeafMana = this.inventory.leaf >= 1;
        const hasMagicMana = app.magic >= 50;
        const canBrewMana = hasAcornMana && hasLeafMana && hasMagicMana;
        
        const manaRecipe = `
            <div class="brew-recipe">
                <h4>🔮 Mana Potion</h4>
                <p>Refills your magic bar</p>
                <div class="brew-ingredients">
                    <span class="${hasAcornMana ? 'ingredient-available' : 'ingredient-missing'}">1 🌰 Acorn</span>
                    <span class="${hasLeafMana ? 'ingredient-available' : 'ingredient-missing'}">1 🍂 Leaf</span>
                    <span class="${hasMagicMana ? 'ingredient-available' : 'ingredient-missing'}">50 ✨ Magic</span>
                </div>
                <button class="brew-btn" data-recipe="mana" ${canBrewMana ? '' : 'disabled'}>Brew</button>
            </div>
        `;
        
        // Update the modal content (preserving close buttons)
        const modalContent = brewModal.querySelector('.brew-modal-content');
        if (modalContent) {
            modalContent.innerHTML = `
                <button class="brew-close-x" aria-label="Close">&times;</button>
                <h3>🧪 Brew Potions</h3>
                ${healingRecipe}
                ${electricityRecipe}
                ${manaRecipe}
                <button class="brew-close-btn">Close</button>
            `;
            
            // Re-attach event handlers
            const brewButtons = modalContent.querySelectorAll('.brew-btn');
            brewButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const recipe = e.target.dataset.recipe;
                    this.brewPotion(recipe);
                });
            });
            
            const closeBtn = modalContent.querySelector('.brew-close-btn');
            closeBtn.addEventListener('click', () => {
                brewModal.remove();
            });
            
            const closeX = modalContent.querySelector('.brew-close-x');
            closeX.addEventListener('click', () => {
                brewModal.remove();
            });
        }
    }

    /**
     * Brew a potion based on recipe
     */
    brewPotion(recipe) {
        const app = window.app;
        if (!app) return;
        
        if (recipe === 'healing') {
            // Check ingredients
            if (this.inventory.acorn >= 1 && this.inventory.mushroom >= 1 && 
                this.inventory.leaf >= 1 && app.magic >= 33) {
                // Consume ingredients
                this.inventory.acorn--;
                this.inventory.mushroom--;
                this.inventory.leaf--;
                app.magic -= 33;
                
                // Reduce total collected count
                this.collectedCount -= 3; // 1 acorn + 1 mushroom + 1 leaf
                this.updateCounter();
                
                // Create potion
                this.potions.healing++;
                
                console.log('🧪 Brewed Healing Potion!');
                this.showBrewSuccessFeedback('healing');
                this.updateInventoryDisplay();
                this.updateMagicList();
                app.updateStatBars();
                this.refreshBrewMenu();
            } else {
                console.log('❌ Not enough ingredients for Healing Potion');
                alert('Not enough ingredients! Need: 1 Acorn, 1 Mushroom, 1 Leaf, 33 Magic');
            }
        } else if (recipe === 'electricity') {
            // Check ingredients
            if (this.inventory.crystal >= 3 && app.magic >= 33) {
                // Consume ingredients
                this.inventory.crystal -= 3;
                app.magic -= 33;
                
                // Reduce total collected count
                this.collectedCount -= 3; // 3 crystals
                this.updateCounter();
                
                // Create potion
                this.potions.electricity++;
                
                console.log('⚡ Brewed Electricity Potion!');
                this.showBrewSuccessFeedback('electricity');
                this.updateInventoryDisplay();
                this.updateMagicList();
                app.updateStatBars();
                this.refreshBrewMenu();
            } else {
                console.log('❌ Not enough ingredients for Electricity Potion');
                alert('Not enough ingredients! Need: 3 Crystals, 33 Magic');
            }
        } else if (recipe === 'mana') {
            // Check ingredients
            if (this.inventory.acorn >= 1 && this.inventory.leaf >= 1 && app.magic >= 50) {
                // Consume ingredients
                this.inventory.acorn--;
                this.inventory.leaf--;
                app.magic -= 50;
                
                // Reduce total collected count
                this.collectedCount -= 2; // 1 acorn + 1 leaf
                this.updateCounter();
                
                // Create potion
                this.potions.mana++;
                
                console.log('🔮 Brewed Mana Potion!');
                this.showBrewSuccessFeedback('mana');
                this.updateInventoryDisplay();
                this.updateMagicList();
                app.updateStatBars();
                this.refreshBrewMenu();
            } else {
                console.log('❌ Not enough ingredients for Mana Potion');
                alert('Not enough ingredients! Need: 1 Acorn, 1 Leaf, 50 Magic');
            }
        }
    }

    /**
     * Use a potion
     */
    usePotion(potionType) {
        const app = window.app;
        if (!app) return;
        
        if (potionType === 'healing' && this.potions.healing > 0) {
            this.potions.healing--;
            const oldHealth = app.health;
            app.health = Math.min(app.maxHealth, app.health + 30);
            const actualHealing = app.health - oldHealth;
            app.updateStatBars();
            console.log(`🧪 Used Healing Potion! Health: ${oldHealth.toFixed(1)} → ${app.health.toFixed(1)} (+${actualHealing.toFixed(1)})`);
            this.updateMagicList();
            this.updatePotionDisplay();
        } else if (potionType === 'electricity' && this.potions.electricity > 0) {
            this.potions.electricity--;
            // Activate electrified pinches
            this.electrifiedPinchesRemaining = 5;
            console.log('⚡ Used Electricity Potion! Next 5 pinches will be ELECTRIFIED (4x damage)!');
            this.updateMagicList();
            this.updatePotionDisplay();
            this.showElectrifiedBuffFeedback();
        } else if (potionType === 'mana' && this.potions.mana > 0) {
            this.potions.mana--;
            const oldMagic = app.magic;
            app.magic = app.maxMagic;
            const magicRestored = app.magic - oldMagic;
            app.updateStatBars();
            console.log(`🔮 Used Mana Potion! Magic: ${oldMagic.toFixed(1)} → ${app.magic.toFixed(1)} (+${magicRestored.toFixed(1)})`);
            this.updateMagicList();
            this.updatePotionDisplay();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollectiblesGame;
}
