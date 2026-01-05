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
        this.isClosedFist = false; // Track if hand is closed fist
        this.inventoryOpen = false; // Track if inventory panel is open
        this.lastMissTime = 0;
        this.missThrottleDelay = 500; // Only show miss feedback every 500ms
        this.headTracker = headTracker; // Reference to head tracker for face position
        
        // Inventory tracking by type
        this.inventory = {
            'acorn': 0,
            'mushroom': 0,
            'pinecone': 0,
            'leaf': 0,
            'bolt': 0
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
        
        // Timing
        this.minSpawnTime = 10000; // 10 seconds
        this.maxSpawnTime = 20000; // 20 seconds
        
        // Collectible properties
        this.types = [
            { emoji: '🌰', name: 'acorn', size: 40 },
            { emoji: '🍄', name: 'mushroom', size: 45 },
            { emoji: '🥜', name: 'pinecone', size: 35 },
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
                    maxHands: 1 // Only detect one hand
                };
                
                this.handDetector = await handPoseDetection.createDetector(model, detectorConfig);
                console.log('Hand detection model loaded');
            } else {
                console.warn('Hand pose detection not available');
            }
        } catch (error) {
            console.error('Error loading hand detection:', error);
        }
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
        }
        
        // Start spawning collectibles
        this.scheduleNextSpawn();
        
        // Start game loop
        this.gameLoop();
        
        // Initialize bolt counter display
        this.updateBoltCounter();
        
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
            
            // Auto-hit: every bolt automatically hits the first enemy
            if (this.enemies.length > 0) {
                const enemy = this.enemies[0]; // Always hit first enemy
                const damage = enemy.maxHealth * 0.5;
                enemy.health = Math.max(0, enemy.health - damage);
                console.log(`🎯 Bolt auto-hit rat! Damage: ${damage.toFixed(1)}, Remaining health: ${enemy.health.toFixed(1)}`);
                return false; // Remove bolt after hitting
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
                console.log(`💀 Rat defeated!`);
                
                // Award XP to player
                const app = window.app;
                if (app && app.addXP) {
                    app.addXP(10);
                } else {
                    console.warn('⚠️ Cannot award XP - app not found or addXP undefined');
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
        console.log(`⚔️ RAT ATTACKS! (${enemy.attackCount + 1}/${enemy.maxAttacks})`);
        
        // Damage player health by 10%
        const app = window.app;
        console.log(`🔍 Checking for app reference:`, !!app);
        
        if (app && app.health !== undefined && app.maxHealth !== undefined) {
            const damage = app.maxHealth * 0.1;
            const oldHealth = app.health;
            app.health = Math.max(0, app.health - damage);
            app.updateStatBars();
            console.log(`💔 Player took ${damage.toFixed(1)} damage! Health: ${oldHealth.toFixed(1)} → ${app.health.toFixed(1)}/${app.maxHealth}`);
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
        
        try {
            const hands = await this.handDetector.estimateHands(this.videoElement, {
                flipHorizontal: true
            });
            
            if (hands && hands.length > 0) {
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
                
                // Draw hand keypoints for debugging
                this.drawHandDebug(hand);
                
                // Check for closed fist gesture (to close inventory)
                this.isClosedFist = this.isClosedFistGesture(hand);
                
                // Check if hand is making a pinch gesture for grabbing
                this.isGrabbing = this.isGrabbingGesture(hand);
                
                if (this.isGrabbing) {
                    // Get hand position (use pinch point - midpoint between thumb and index)
                    const thumbTip = hand.keypoints[4];
                    const indexTip = hand.keypoints[8];
                    const handX = (thumbTip.x + indexTip.x) / 2;
                    const handY = (thumbTip.y + indexTip.y) / 2;
                    
                    this.lastHandPosition = { x: handX, y: handY };
                    
                    // Check for collision with enemies first
                    const hitEnemy = this.checkEnemyCollision(handX, handY);
                    
                    // Then check for collision with any collectible
                    const grabbed = this.checkCollision(handX, handY);
                    
                    // Only show miss feedback if nothing was grabbed/hit AND there are collectibles on screen
                    if (!grabbed && !hitEnemy && this.collectibles.length > 0) {
                        this.showMissFeedback(handX, handY);
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
    drawHandDebug(hand) {
        if (!this.debugCtx || !this.debugCanvas) return;
        
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
        
        // Determine if currently grabbing for color
        const isGrabbing = this.isGrabbingGesture(hand);
        const lineColor = isGrabbing ? '#00FF00' : '#00BFFF';
        const pointColor = isGrabbing ? '#00FF00' : '#FFFFFF';
        
        // Draw lines (no manual mirroring - CSS handles it)
        this.debugCtx.strokeStyle = lineColor;
        this.debugCtx.lineWidth = 2;
        connections.forEach(([start, end]) => {
            const startPoint = keypoints[start];
            const endPoint = keypoints[end];
            
            this.debugCtx.beginPath();
            this.debugCtx.moveTo(startPoint.x, startPoint.y);
            this.debugCtx.lineTo(endPoint.x, endPoint.y);
            this.debugCtx.stroke();
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
            
            this.debugCtx.beginPath();
            this.debugCtx.arc(x, y, radius, 0, 2 * Math.PI);
            this.debugCtx.fillStyle = pointColor;
            this.debugCtx.fill();
            
            // Special styling for pinch points
            if (isPinchPoint) {
                this.debugCtx.strokeStyle = isGrabbing ? '#00FF00' : '#FFD700'; // Gold when not pinching
                this.debugCtx.lineWidth = 3;
                this.debugCtx.stroke();
            }
            // Draw palm center larger
            else if (index === 0) {
                this.debugCtx.strokeStyle = isGrabbing ? '#00FF00' : '#FF6B35';
                this.debugCtx.lineWidth = 3;
                this.debugCtx.stroke();
            }
        });
        
        // Draw line between thumb and index tip when pinching
        if (isGrabbing) {
            const thumbTip = keypoints[4];
            const indexTip = keypoints[8];
            
            this.debugCtx.beginPath();
            this.debugCtx.moveTo(thumbTip.x, thumbTip.y);
            this.debugCtx.lineTo(indexTip.x, indexTip.y);
            this.debugCtx.strokeStyle = '#00FF00';
            this.debugCtx.lineWidth = 4;
            this.debugCtx.stroke();
        }
        
        // Draw pinching indicator
        if (isGrabbing) {
            const thumbTip = keypoints[4];
            const indexTip = keypoints[8];
            // Position text near the pinch point
            const x = (thumbTip.x + indexTip.x) / 2;
            const y = (thumbTip.y + indexTip.y) / 2;
            
            this.debugCtx.font = 'bold 24px Arial';
            this.debugCtx.fillStyle = '#00FF00';
            this.debugCtx.strokeStyle = '#000000';
            this.debugCtx.lineWidth = 3;
            this.debugCtx.strokeText('PINCHING! 🤏', x + 20, y - 20);
            this.debugCtx.fillText('PINCHING! 🤏', x + 20, y - 20);
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
    isClosedFistGesture(hand) {
        const keypoints = hand.keypoints;
        
        // Get all fingertips and palm
        const thumbTip = keypoints[4];
        const indexTip = keypoints[8];
        const middleTip = keypoints[12];
        const ringTip = keypoints[16];
        const pinkyTip = keypoints[20];
        const palm = keypoints[0];
        
        // In a fist, all fingertips should be close to the palm
        const thumbClose = this.distance(thumbTip, palm) < 60;
        const indexClose = this.distance(indexTip, palm) < 70;
        const middleClose = this.distance(middleTip, palm) < 70;
        const ringClose = this.distance(ringTip, palm) < 70;
        const pinkyClose = this.distance(pinkyTip, palm) < 70;
        
        return thumbClose && indexClose && middleClose && ringClose && pinkyClose;
    }

    /**
     * Calculate distance between two points
     */
    distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
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
    checkEnemyCollision(handX, handY) {
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
                
                // Pinch damages enemy by 10% of health
                const damage = enemy.maxHealth * 0.1;
                enemy.health = Math.max(0, enemy.health - damage);
                enemy.lastPinchHitTime = now; // Update cooldown timer
                console.log(`👊 Pinch hit rat! Damage: ${damage.toFixed(1)}, Remaining health: ${enemy.health.toFixed(1)}`);
                
                // Show "POW!" animation
                this.showPinchHitFeedback(enemy.x, enemy.y);
                
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
    showPinchHitFeedback(x, y) {
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = x * scaleX;
        const displayY = y * scaleY;
        
        // Create "POW!" text
        const feedback = document.createElement('div');
        feedback.className = 'pinch-hit-feedback';
        feedback.textContent = '💥 POW!';
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
        
        // Create a bolt projectile that travels across screen
        const bolt = {
            x: startPosition.x,
            y: startPosition.y,
            vx: 400, // pixels per second - travels right
            vy: 0,
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
        const barWidth = 80;
        const barHeight = 8;
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
        
        // Border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
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
        
        // Determine color based on grabbing state
        const color = this.isGrabbing ? '#00FF00' : '#FFD700';
        const radius = this.isGrabbing ? 4 : 3;
        
        // Draw thumb tip
        this.ctx.beginPath();
        this.ctx.arc(thumbTip.x, thumbTip.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = this.isGrabbing ? '#FFFFFF' : '#FFA500';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // Draw index tip
        this.ctx.beginPath();
        this.ctx.arc(indexTip.x, indexTip.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = this.isGrabbing ? '#FFFFFF' : '#FFA500';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // Draw line between them when grabbing
        if (this.isGrabbing) {
            this.ctx.beginPath();
            this.ctx.moveTo(thumbTip.x, thumbTip.y);
            this.ctx.lineTo(indexTip.x, indexTip.y);
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
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
    }

    /**
     * Update the inventory display with current counts (sorted by quantity)
     */
    updateInventoryDisplay() {
        const listContainer = document.getElementById('collectiblesList');
        if (!listContainer) return;
        
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollectiblesGame;
}
