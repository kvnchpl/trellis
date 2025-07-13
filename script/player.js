

import { gameState } from './state.js';

// Tracks which keys are currently pressed
let keysPressed = {};

/**
 * Initializes player input event listeners.
 * @param {Object} config - Game configuration (not used here, but provided for consistency)
 */
export function initPlayer(config) {
    window.addEventListener('keydown', (e) => {
        keysPressed[e.key] = true;
    });
    window.addEventListener('keyup', (e) => {
        keysPressed[e.key] = false;
    });
}

/**
 * Updates the player position based on input, with map boundary checking.
 * @param {Object} config - Game configuration (expects mapWidth, mapHeight)
 */
export function updatePlayer(config) {
    const { mapWidth, mapHeight } = config;
    const player = gameState.player;

    // Move up
    if (keysPressed['ArrowUp'] && player.y > 0) {
        player.y--;
        keysPressed['ArrowUp'] = false; // Move only once per key press
    }
    // Move down
    else if (keysPressed['ArrowDown'] && player.y < mapHeight - 1) {
        player.y++;
        keysPressed['ArrowDown'] = false;
    }
    // Move left
    else if (keysPressed['ArrowLeft'] && player.x > 0) {
        player.x--;
        keysPressed['ArrowLeft'] = false;
    }
    // Move right
    else if (keysPressed['ArrowRight'] && player.x < mapWidth - 1) {
        player.x++;
        keysPressed['ArrowRight'] = false;
    }
}