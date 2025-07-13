

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
    const controls = config.keyBindings;

    // Move up
    if (keysPressed[controls.up] && player.y > 0) {
        player.y--;
        keysPressed[controls.up] = false;
    }
    // Move down
    else if (keysPressed[controls.down] && player.y < mapHeight - 1) {
        player.y++;
        keysPressed[controls.down] = false;
    }
    // Move left
    else if (keysPressed[controls.left] && player.x > 0) {
        player.x--;
        keysPressed[controls.left] = false;
    }
    // Move right
    else if (keysPressed[controls.right] && player.x < mapWidth - 1) {
        player.x++;
        keysPressed[controls.right] = false;
    }
}