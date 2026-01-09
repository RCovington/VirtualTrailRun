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
        
        // Inventory tracking by type
        this.inventory = {
            'acorn': 0,
            'mushroom': 0,
            'crystal': 0,
            'leaf': 0,
            'bolt': 0
        };
        
        // Armor inventory
        this.armor = {
            'buckler': 0
        };
        
        // Potion inventory
        this.potions = {
            'healing': 0,
            'electricity': 0,
            'mana': 1  // DEBUG: Start with 1 mana potion
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
        
        // Timing
        this.minSpawnTime = 10000; // 10 seconds
        this.maxSpawnTime = 20000; // 20 seconds
        
        // Collectible properties
        this.types = [
            { emoji: '🌰', name: 'acorn', size: 40 },
            { emoji: '🍄', name: 'mushroom', size: 45 },
            { emoji: '�', name: 'crystal', size: 35 },
            { emoji: '🍂', name: 'leaf', size: 38 },
            { emoji: '➳', name: 'bolt', size: 42 }
        ];
        
        this.init();
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
        
        // Set up tongue detection callback for crossbow firing
        if (this.headTracker) {
            console.log('🎯 Setting up tongue callback...');
            this.headTracker.onTongue(() => {
                console.log(`👅 Tongue out detected, boltCount=${this.boltCount}`);
                // Fire bolt on tongue out
                if (this.boltCount > 0) {
                    // Use center of screen as firing position
                    const centerX = this.canvas ? this.canvas.width / 2 : 320;
                    const centerY = this.canvas ? this.canvas.height / 2 : 240;
                    console.log(`🏹 Firing bolt from center (${centerX}, ${centerY})`);
                    this.fireBolt({ x: centerX, y: centerY });
                } else {
                    console.log('⚠️ No bolts to fire!');
                }
            });
            console.log('✅ Tongue callback registered');
        } else {
            console.warn('⚠️ No headTracker available for tongue detection!');
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
            this.spawnCollectible();
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
        
        // Position rat on the trail (1/3 from bottom, same as collectibles)
        const x = this.canvas.width * 0.5 + (Math.random() - 0.5) * 100;
        const y = this.canvas.height * 0.67; // 1/3 from bottom
        
        const enemy = {
            id: Date.now() + Math.random(),
            type: 'rat',
            emoji: '🐀',
            x: x,
            y: y,
            initialX: x, // Store initial position
            size: 60,
            health: 100,
            maxHealth: 100,
            state: 'idle', // idle, rearing, attacking
            attackCount: 0,
            maxAttacks: this.getRandomInt(3, 6),
            lastAttackTime: Date.now(),
            nextAttackDelay: this.getRandomInt(2000, 7000),
            rearingStartTime: 0,
            rearingDuration: 500, // 0.5 second warning
            // Pacing animation
            paceDirection: 1, // 1 for right, -1 for left
            paceSpeed: 50, // pixels per second
            paceRange: 150, // Total distance to pace (75px each direction)
            jeerBobSpeed: 2, // Speed of up/down bobbing
            lastPinchHitTime: 0, // Track when last pinch hit occurred
            createdAt: Date.now()
        };
        
        this.enemies.push(enemy);
        console.log(`🐀 RAT SPAWNED! Will make ${enemy.maxAttacks} attacks`);
    }

    /**
     * Spawn the final boss (giant rat)
     */
    spawnBoss() {
        if (!this.canvas || this.bossSpawned) return;
        
        // Position boss in center of screen
        const x = this.canvas.width * 0.5;
        const y = this.canvas.height * 0.67; // 1/3 from bottom
        
        const boss = {
            id: Date.now() + Math.random(),
            type: 'boss',
            emoji: '🐀',
            x: x,
            y: y,
            initialX: x,
            size: 180, // 3x normal size (60 * 3)
            health: 1000, // 10x normal health (100 * 10)
            maxHealth: 1000,
            state: 'idle',
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
            damageMultiplier: 2 // Boss does 2x damage
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
            // Check if enemy is dead
            if (enemy.health <= 0) {
                const isBoss = enemy.isBoss || false;
                
                if (isBoss) {
                    console.log(`👹💀 FINAL BOSS DEFEATED!`);
                    
                    // Award 7x XP for boss
                    const app = window.app;
                    if (app && app.addXP) {
                        app.addXP(70); // 7 times normal 10 XP
                        console.log(`⭐ BOSS BONUS: +70 XP!`);
                    }
                    
                    // Award buckler shield armor
                    this.armor.buckler++;
                    console.log(`🛡️ LEGENDARY REWARD: Buckler Shield acquired!`);
                    this.updateInventoryDisplay();
                    
                    // Show victory message
                    this.showBossVictoryFeedback();
                } else {
                    console.log(`💀 Rat defeated!`);
                    
                    // Award normal XP to player
                    const app = window.app;
                    if (app && app.addXP) {
                        app.addXP(10);
                        // Show defeat feedback
                        this.showEnemyDefeatFeedback(10);
                    } else {
                        console.warn('⚠️ Cannot award XP - app not found or addXP undefined');
                    }
                }
                
                return false; // Remove enemy
            }
            
            // Check if enemy has made all attacks
            if (enemy.attackCount >= enemy.maxAttacks) {
                console.log(`🏃 Rat fleeing after ${enemy.attackCount} attacks`);
                return false; // Remove enemy
            }
            
            // Handle attack state machine
            if (enemy.state === 'idle') {
                // Animate pacing back and forth
                const deltaTime = 1/60; // Assuming ~60fps
                const oldX = enemy.x;
                enemy.x += enemy.paceDirection * enemy.paceSpeed * deltaTime;
                
                // Debug logging occasionally
                if (Math.random() < 0.01) { // 1% chance per frame
                    console.log(`🐾 Rat pacing: x=${enemy.x.toFixed(1)}, moved ${(enemy.x - oldX).toFixed(2)}px, direction=${enemy.paceDirection}`);
                }
                
                // Check if reached edge of pace range
                const distanceFromCenter = enemy.x - enemy.initialX;
                if (Math.abs(distanceFromCenter) >= enemy.paceRange / 2) {
                    // Reverse direction
                    enemy.paceDirection *= -1;
                    // Clamp to range
                    enemy.x = enemy.initialX + (enemy.paceRange / 2) * Math.sign(distanceFromCenter);
                    console.log(`🔄 Rat reversed direction at x=${enemy.x.toFixed(1)}`);
                }
                
                // Check if it's time to attack
                if (now - enemy.lastAttackTime >= enemy.nextAttackDelay) {
                    enemy.state = 'rearing';
                    enemy.rearingStartTime = now;
                    console.log(`⚠️ Rat rearing back!`);
                }
            } else if (enemy.state === 'rearing') {
                // Check if rearing animation is complete
                if (now - enemy.rearingStartTime >= enemy.rearingDuration) {
                    enemy.state = 'attacking';
                    this.enemyAttack(enemy);
                }
            } else if (enemy.state === 'attacking') {
                // Return to idle after attack
                enemy.state = 'idle';
                enemy.attackCount++;
                enemy.lastAttackTime = now;
                enemy.nextAttackDelay = this.getRandomInt(2000, 7000);
            }
            
            return true; // Keep enemy
        });
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
                
                // Filter out hands that are likely the face
                if (this.isHandWithinFace(hand)) {
                    // Ignore this detection - it's likely the user's face
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
                
                // Deactivate shield when hands disappear
                this.scheduleShieldDeactivation();
            }
        } catch (error) {
            // Silently handle detection errors
            this.lastHandPosition = null;
            this.lastHandKeypoints = null;
            this.lastHandPosition = null;
            this.isGrabbing = false;
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
            
            // Activate shield
            const app = window.app;
            if (app && app.activateShield) {
                app.activateShield();
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
        feedback.textContent = '⚡ ELECTRIFIED! 5 Pinches ⚡';
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
        
        // Calculate trajectory
        let vx = 400; // Default: travels right
        let vy = 0;
        let damage = 50; // Default damage if no enemy
        
        if (this.enemies.length > 0) {
            // Target first enemy
            const enemy = this.enemies[0];
            const dx = enemy.x - startX;
            const dy = enemy.y - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Normalize and scale to speed
            const speed = 500;
            vx = (dx / distance) * speed;
            vy = (dy / distance) * speed;
            damage = enemy.maxHealth * 0.4; // 40% damage
            
            console.log(`🎯 Fireball aimed at enemy: (${enemy.x.toFixed(0)}, ${enemy.y.toFixed(0)})`);
        } else {
            console.log('🔥 No enemies - fireball travels straight right');
        }
        
        // Create fireball projectile
        const fireball = {
            x: startX,
            y: startY,
            vx: vx,
            vy: vy,
            size: 40,
            createdAt: now,
            lifetime: 2000, // 2 seconds
            damage: damage
        };
        
        this.fireballProjectiles.push(fireball);
        this.showFireballCastFeedback(startX, startY);
        console.log(`✅ Fireball projectile created at (${startX.toFixed(0)}, ${startY.toFixed(0)})`);
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
            // Determine visual state
            let displayEmoji = enemy.emoji;
            let scale = 1;
            let rotation = 0;
            let yOffset = 0;
            
            if (enemy.state === 'idle') {
                // Jeering animation - bob up and down with slight rotation
                const timeSinceCreated = (now - enemy.createdAt) / 1000;
                yOffset = Math.sin(timeSinceCreated * enemy.jeerBobSpeed) * 8; // Bob up/down 8px
                rotation = Math.sin(timeSinceCreated * enemy.jeerBobSpeed * 1.5) * 0.15; // Slight wobble
                scale = 1 + Math.sin(timeSinceCreated * enemy.jeerBobSpeed * 0.8) * 0.05; // Slight size change
            } else if (enemy.state === 'rearing') {
                // Rearing animation - scale up and rotate slightly
                const rearingProgress = (now - enemy.rearingStartTime) / enemy.rearingDuration;
                scale = 1 + (rearingProgress * 0.3); // Grow 30% larger
                rotation = Math.sin(rearingProgress * Math.PI) * 0.2; // Slight tilt
            } else if (enemy.state === 'attacking') {
                // Attack animation - lunge forward
                scale = 1.3;
                rotation = 0.3;
            }
            
            // Draw enemy emoji
            this.ctx.save();
            this.ctx.translate(enemy.x, enemy.y + yOffset);
            this.ctx.rotate(rotation);
            
            const size = enemy.size * scale;
            this.ctx.font = `${size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add red glow when attacking/rearing
            if (enemy.state !== 'idle') {
                this.ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
                this.ctx.shadowBlur = 20;
            }
            
            this.ctx.fillText(displayEmoji, 0, 0);
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
            <div class="inventory-footer">
                <div class="potion-area">
                    <h3>🧪 Mix Potion</h3>
                    <p>Select items to combine into potions</p>
                    <button class="potion-brew-btn">Brew Potion</button>
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
        
        // Add potion brewing button handler
        const brewBtn = panel.querySelector('.potion-brew-btn');
        if (brewBtn) {
            brewBtn.addEventListener('click', () => this.showBrewMenu());
        }
        
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
                        <div class="inventory-list-name">${item.type.name}</div>
                        <div class="inventory-list-count" id="inventory-${item.type.name}">
                            Quantity: <span class="count-value">${item.count}</span>
                        </div>
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
        
        // Update weapons tab (Bolts)
        const weaponsList = document.getElementById('weaponsList');
        if (weaponsList) {
            const boltType = this.types.find(type => type.name === 'bolt');
            if (boltType && this.boltCount > 0) {
                weaponsList.innerHTML = `
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
            } else {
                weaponsList.innerHTML = '<div class="inventory-empty">No weapons yet</div>';
            }
        }
        
        // Update armor tab
        this.updateArmorList();
    }

    /**
     * Update armor tab list
     */
    updateArmorList() {
        const armorList = document.getElementById('armorList');
        if (!armorList) return;
        
        if (this.armor.buckler === 0) {
            armorList.innerHTML = '<div class="inventory-empty">No armor yet</div>';
            return;
        }
        
        const armorItems = [];
        
        if (this.armor.buckler > 0) {
            armorItems.push({
                name: 'Buckler Shield',
                emoji: '🛡️',
                count: this.armor.buckler,
                description: 'Blocks enemy attacks with closed fist + elbow gesture'
            });
        }
        
        armorList.innerHTML = armorItems.map(item => `
            <div class="inventory-list-item armor-item">
                <div class="inventory-list-emoji">${item.emoji}</div>
                <div class="inventory-list-info">
                    <div class="inventory-list-name">${item.name}</div>
                    <div class="inventory-list-description">${item.description}</div>
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
        
        if (this.potions.healing === 0 && this.potions.electricity === 0 && this.potions.mana === 0) {
            magicList.innerHTML = '<div class="inventory-empty">No magic items yet</div>';
            return;
        }
        
        let html = '';
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
                    <span>3 � Crystals</span>
                    <span>33 ✨ Magic</span>
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
