import * as THREE from 'three';

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create rocket
const textureLoader = new THREE.TextureLoader();
const rocketTexture = textureLoader.load('spaceship.png');
const rocketGeometry = new THREE.PlaneGeometry(3, 3); // Larger size for better visibility
const rocketMaterial = new THREE.MeshBasicMaterial({
    map: rocketTexture,
    transparent: true,
    side: THREE.DoubleSide
});
const rocket = new THREE.Mesh(rocketGeometry, rocketMaterial);
rocket.position.set(0, -15, 0);
rocket.rotation.z = Math.PI; // Rotate to point upward
scene.add(rocket);

// Game state
let gameOver = false;
let won = false;
let score = 0;
let gameTime = 0;
const moonAppearTime = 30; // Seconds until moon appears
const scrollSpeed = 0.05;
const scoreElement = document.getElementById('score');
const winContainer = document.getElementById('winContainer');
const gameOverContainer = document.getElementById('gameOverContainer');
const shootButton = document.getElementById('shootButton');
let obstacles = [];
const obstacleCount = 10;
let powerUps = [];
let lasers = [];
let canShoot = true;
let shootCooldown = 20;
let hasShield = false;
let hasSpeedBoost = false;
let scoreMultiplier = 1;
let shieldTimer = 0;
let speedBoostTimer = 0;
let multiplierTimer = 0;

// Touch controls state
let touchStartX = 0;
let touchStartY = 0;
let targetX = 0;
let targetY = -15;
let isDragging = false;

// Create stars background
const starsGeometry = new THREE.BufferGeometry();
const starsMaterial = new THREE.PointsMaterial({
    color: 0xFFFFFF,
    size: 0.1,
    sizeAttenuation: true
});

const starsVertices = [];
for(let i = 0; i < 1000; i++) {
    starsVertices.push(
        Math.random() * 60 - 30, // x
        Math.random() * 100 - 20, // y
        Math.random() * 50 - 25  // z
    );
}
starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

// Create moon (initially hidden)
const moonGeometry = new THREE.SphereGeometry(3, 32, 32);
const moonMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
const moon = new THREE.Mesh(moonGeometry, moonMaterial);
moon.position.y = 50; // Start far above
moon.visible = false;
scene.add(moon);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Create power-up
function createPowerUp() {
    const types = [
        { color: 0x0000ff, type: 'shield' },    // Blue for shield
        { color: 0x00ff00, type: 'speed' },     // Green for speed
        { color: 0xffd700, type: 'multiplier' } // Gold for score multiplier
    ];
    
    const powerUpType = types[Math.floor(Math.random() * types.length)];
    const geometry = new THREE.OctahedronGeometry(0.5);
    const material = new THREE.MeshPhongMaterial({ 
        color: powerUpType.color,
        emissive: powerUpType.color,
        emissiveIntensity: 0.5
    });
    const powerUp = new THREE.Mesh(geometry, material);
    
    // Random position
    powerUp.position.x = (Math.random() - 0.5) * 30;
    powerUp.position.y = 30;
    powerUp.position.z = 0;
    
    scene.add(powerUp);
    powerUps.push({
        mesh: powerUp,
        type: powerUpType.type,
        rotSpeed: 0.02
    });
}

// Create obstacles (asteroids)
function createObstacle() {
    const size = Math.random() * 1.5 + 0.5;
    const geometry = new THREE.DodecahedronGeometry(size);
    const material = new THREE.MeshPhongMaterial({ color: 0x808080 });
    const obstacle = new THREE.Mesh(geometry, material);
    
    // Random position
    obstacle.position.x = (Math.random() - 0.5) * 30;
    obstacle.position.y = 30;
    obstacle.position.z = 0;
    
    // Random rotation
    obstacle.rotation.x = Math.random() * Math.PI;
    obstacle.rotation.y = Math.random() * Math.PI;
    
    scene.add(obstacle);
    obstacles.push({
        mesh: obstacle,
        rotSpeed: Math.random() * 0.02,
        moveSpeed: Math.random() * 0.05
    });
}

// Create laser beam
function createLaser() {
    const geometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    const laser = new THREE.Mesh(geometry, material);
    laser.rotation.x = Math.PI / 2; // Rotate to point upward
    
    // Position at rocket's position
    laser.position.copy(rocket.position);
    laser.position.y += 1;
    
    scene.add(laser);
    lasers.push({
        mesh: laser,
        speed: 0.5
    });
}

// Create initial obstacles
for (let i = 0; i < obstacleCount; i++) {
    createObstacle();
}

// Create initial power-ups
for (let i = 0; i < 3; i++) {
    createPowerUp();
}

camera.position.z = 25;

// Movement controls
const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: false
};

window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            keys.left = true;
            break;
        case 'ArrowRight':
            keys.right = true;
            break;
        case 'ArrowUp':
            keys.up = true;
            break;
        case 'ArrowDown':
            keys.down = true;
            break;
        case ' ': // Spacebar
            keys.shoot = true;
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            keys.left = false;
            break;
        case 'ArrowRight':
            keys.right = false;
            break;
        case 'ArrowUp':
            keys.up = false;
            break;
        case 'ArrowDown':
            keys.down = false;
            break;
        case ' ': // Spacebar
            keys.shoot = false;
            break;
    }
});

// Initialize touch controls
function initTouchControls() {
    // Touch movement on the canvas
    renderer.domElement.addEventListener('touchstart', (e) => {
        // Ignore if touching the shoot button
        if (e.target === shootButton) return;
        
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isDragging = true;
        
        // Convert touch position to game coordinates
        const rect = renderer.domElement.getBoundingClientRect();
        targetX = ((touch.clientX - rect.left) / rect.width) * 30 - 15;
        targetY = -((touch.clientY - rect.top) / rect.height) * 30 + 15;
        
        e.preventDefault();
    }, { passive: false });

    renderer.domElement.addEventListener('touchmove', (e) => {
        if (!isDragging || e.target === shootButton) return;
        
        const touch = e.touches[0];
        const rect = renderer.domElement.getBoundingClientRect();
        
        // Convert touch position to game coordinates
        targetX = ((touch.clientX - rect.left) / rect.width) * 30 - 15;
        targetY = -((touch.clientY - rect.top) / rect.height) * 30 + 15;
        
        // Clamp target positions
        targetX = Math.max(-15, Math.min(15, targetX));
        targetY = Math.max(-15, Math.min(25, targetY));
        
        e.preventDefault();
    }, { passive: false });

    renderer.domElement.addEventListener('touchend', () => {
        isDragging = false;
    }, { passive: true });

    // Prevent default touch behavior to avoid scrolling
    document.addEventListener('touchmove', (e) => {
        if (e.target === renderer.domElement || e.target === shootButton) {
            e.preventDefault();
        }
    }, { passive: false });

    // Initialize shoot button
    shootButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (canShoot) {
            createLaser();
            canShoot = false;
        }
    }, { passive: false });
}

initTouchControls();

// Collision detection
function checkCollision(obj1, obj2) {
    const distance = obj1.position.distanceTo(obj2.position);
    return distance < 2;
}

// Update status text
function updateStatusText() {
    let statusText = `Score: ${score}`;
    if (hasShield) statusText += ' | Shield Active!';
    if (hasSpeedBoost) statusText += ' | Speed Boost!';
    if (scoreMultiplier > 1) statusText += ` | ${scoreMultiplier}x Score!`;
    scoreElement.textContent = statusText;
}

// Victory effects
function showVictoryEffects() {
    // Show win container
    winContainer.style.display = 'block';
    winContainer.querySelector('.gameMessage').textContent = `YOU WIN!\nScore: ${score}`;
    
    // Make the moon glow
    moon.material.emissive.setHex(0xffff00);
    moon.material.emissiveIntensity = 0.5;
    
    // Make the rocket glow
    rocket.material.emissive.setHex(0xff0000);
    rocket.material.emissiveIntensity = 0.5;
}

// Show game over screen
function showGameOver() {
    gameOverContainer.style.display = 'block';
    gameOverContainer.querySelector('.gameMessage').textContent = `GAME OVER!\nScore: ${score}`;
}

// Reset game state
function resetGame() {
    // Reset game state
    gameOver = false;
    won = false;
    score = 0;
    gameTime = 0;
    hasShield = false;
    hasSpeedBoost = false;
    scoreMultiplier = 1;
    
    // Reset rocket
    rocket.position.set(0, -15, 0);
    rocket.material.opacity = 1;
    
    // Reset moon
    moon.visible = false;
    moon.position.y = 50;
    moon.material.emissiveIntensity = 0;
    
    // Hide messages
    winContainer.style.display = 'none';
    gameOverContainer.style.display = 'none';
    
    // Clear lasers
    lasers.forEach(laser => scene.remove(laser.mesh));
    lasers = [];
    canShoot = true;
    shootCooldown = 20;
    
    // Clear and recreate obstacles
    obstacles.forEach(obstacle => scene.remove(obstacle.mesh));
    obstacles = [];
    for (let i = 0; i < obstacleCount; i++) {
        createObstacle();
    }
    
    // Clear and recreate power-ups
    powerUps.forEach(powerUp => scene.remove(powerUp.mesh));
    powerUps = [];
    for (let i = 0; i < 3; i++) {
        createPowerUp();
    }
    
    updateStatusText();
    animate();
}

// Initialize restart buttons and R key
document.querySelectorAll('.restartButton').forEach(button => {
    button.addEventListener('click', resetGame);
    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        resetGame();
    }, { passive: false });
});

window.addEventListener('keydown', (e) => {
    if ((gameOver || won) && e.key.toLowerCase() === 'r') {
        resetGame();
    }
});

// Game loop
function animate() {
    if (!gameOver && !won) {
        requestAnimationFrame(animate);
        
        // Update game time
        gameTime += 1/60; // Assuming 60fps
        
        // Scroll everything down
        obstacles.forEach(obstacle => {
            obstacle.mesh.position.y -= scrollSpeed;
            if (obstacle.mesh.position.y < -20) {
                // Reset obstacle to top
                obstacle.mesh.position.y = 30;
                obstacle.mesh.position.x = (Math.random() - 0.5) * 30;
            }
        });
        
        powerUps.forEach(powerUp => {
            powerUp.mesh.position.y -= scrollSpeed;
            if (powerUp.mesh.position.y < -20) {
                // Reset power-up to top
                powerUp.mesh.position.y = 30;
                powerUp.mesh.position.x = (Math.random() - 0.5) * 30;
            }
        });
        
        // Scroll stars for parallax effect
        const starsPositions = stars.geometry.attributes.position.array;
        for(let i = 1; i < starsPositions.length; i += 3) {
            starsPositions[i] -= scrollSpeed * 0.5;
            if(starsPositions[i] < -20) {
                starsPositions[i] = 80;
            }
        }
        stars.geometry.attributes.position.needsUpdate = true;
        
        // Check if it's time to show the moon
        if (gameTime >= moonAppearTime && !moon.visible) {
            moon.visible = true;
            moon.position.y = 40;
        }
        
        // Move moon down if visible
        if (moon.visible) {
            moon.position.y -= scrollSpeed;
        }

        // Update shoot cooldown
        if (!canShoot) {
            shootCooldown--;
            if (shootCooldown <= 0) {
                canShoot = true;
                shootCooldown = 20;
            }
        }

        // Handle keyboard shooting
        if (keys.shoot && canShoot) {
            createLaser();
            canShoot = false;
        }

        // Update lasers
        lasers.forEach((laser, laserIndex) => {
            laser.mesh.position.y += laser.speed;
            
            // Remove laser if it goes off screen
            if (laser.mesh.position.y > 30) {
                scene.remove(laser.mesh);
                lasers.splice(laserIndex, 1);
                return;
            }
            
            // Check laser collision with obstacles
            obstacles.forEach((obstacle, obstacleIndex) => {
                if (checkCollision(laser.mesh, obstacle.mesh)) {
                    // Remove both laser and obstacle
                    scene.remove(laser.mesh);
                    scene.remove(obstacle.mesh);
                    lasers.splice(laserIndex, 1);
                    obstacles.splice(obstacleIndex, 1);
                    
                    // Add score
                    score += 20 * scoreMultiplier;
                    updateStatusText();
                    
                    // Create new obstacle after delay
                    setTimeout(createObstacle, 3000);
                }
            });
        });

        // Move rocket (smooth follow touch position)
        if (isDragging) {
            const lerpFactor = 0.1;
            rocket.position.x += (targetX - rocket.position.x) * lerpFactor;
            rocket.position.y += (targetY - rocket.position.y) * lerpFactor;
        } else {
            // Keyboard controls
            const moveSpeed = hasSpeedBoost ? 0.4 : 0.2;
            if (keys.left && rocket.position.x > -15) rocket.position.x -= moveSpeed;
            if (keys.right && rocket.position.x < 15) rocket.position.x += moveSpeed;
            if (keys.up && rocket.position.y < 25) rocket.position.y += moveSpeed;
            if (keys.down && rocket.position.y > -15) rocket.position.y -= moveSpeed;
        }

        // Update power-up timers
        if (hasShield) {
            shieldTimer--;
            if (shieldTimer <= 0) {
                hasShield = false;
                rocket.material.color.setHex(0xff0000);
            }
        }
        if (hasSpeedBoost) {
            speedBoostTimer--;
            if (speedBoostTimer <= 0) {
                hasSpeedBoost = false;
            }
        }
        if (scoreMultiplier > 1) {
            multiplierTimer--;
            if (multiplierTimer <= 0) {
                scoreMultiplier = 1;
            }
        }

        // Update obstacles
        obstacles.forEach((obstacle, obstacleIndex) => {
            obstacle.mesh.rotation.x += obstacle.rotSpeed;
            obstacle.mesh.rotation.y += obstacle.rotSpeed;
            
            // Check collision with rocket
            if (checkCollision(rocket, obstacle.mesh)) {
                if (hasShield) {
                    // Remove the obstacle when shield is active
                    scene.remove(obstacle.mesh);
                    obstacles = obstacles.filter(o => o.mesh !== obstacle.mesh);
                    score += 10 * scoreMultiplier;
                } else {
                    gameOver = true;
                    showGameOver();
                }
            }
        });

        // Update power-ups
        powerUps.forEach((powerUp, index) => {
            powerUp.mesh.rotation.x += powerUp.rotSpeed;
            powerUp.mesh.rotation.y += powerUp.rotSpeed;
            
            // Check collision with rocket
            if (checkCollision(rocket, powerUp.mesh)) {
                // Apply power-up effect
                switch(powerUp.type) {
                    case 'shield':
                        hasShield = true;
                        shieldTimer = 300; // 5 seconds at 60fps
                        rocket.material.opacity = 0.7; // Make semi-transparent to show shield effect
                        break;
                    case 'speed':
                        hasSpeedBoost = true;
                        speedBoostTimer = 300;
                        break;
                    case 'multiplier':
                        scoreMultiplier = 2;
                        multiplierTimer = 300;
                        break;
                }
                
                // Remove collected power-up
                scene.remove(powerUp.mesh);
                powerUps.splice(index, 1);
                
                // Create new power-up
                setTimeout(createPowerUp, 3000);
            }
        });

        // Check if rocket reached the moon
        if (moon.visible && checkCollision(rocket, moon)) {
            won = true;
            showVictoryEffects();
        }

        updateStatusText();
        renderer.render(scene, camera);
    }
}

// Handle window resizing
window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(newWidth, newHeight);
});

// Start the game
animate();
