import { gameState } from './state.js';
import { saveGameState } from './game.js';
import { incrementTime } from './ui.js';

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
        gameState.selector = { x: player.x, y: player.y };
        keysPressed[controls.up] = false;
        saveGameState();
        incrementTime(1, config);
    }

    // Move down
    else if (keysPressed[controls.down] && player.y < mapHeight - 1) {
        player.y++;
        gameState.selector = { x: player.x, y: player.y };
        keysPressed[controls.down] = false;
        saveGameState();
        incrementTime(1, config);
    }

    // Move left
    else if (keysPressed[controls.left] && player.x > 0) {
        player.x--;
        gameState.selector = { x: player.x, y: player.y };
        keysPressed[controls.left] = false;
        saveGameState();
        incrementTime(1, config);
    }

    // Move right
    else if (keysPressed[controls.right] && player.x < mapWidth - 1) {
        player.x++;
        gameState.selector = { x: player.x, y: player.y };
        keysPressed[controls.right] = false;
        saveGameState();
        incrementTime(1, config);
    }

    // Select tile above player
    else if (keysPressed[controls.selectUp]) {
        const newY = player.y - 1;
        if (newY >= 0) gameState.selector = { x: player.x, y: newY };
        keysPressed[controls.selectUp] = false;
    }

    // Select tile below player
    else if (keysPressed[controls.selectDown]) {
        const newY = player.y + 1;
        if (newY < mapHeight) gameState.selector = { x: player.x, y: newY };
        keysPressed[controls.selectDown] = false;
    }

    // Select tile left of player
    else if (keysPressed[controls.selectLeft]) {
        const newX = player.x - 1;
        if (newX >= 0) gameState.selector = { x: newX, y: player.y };
        keysPressed[controls.selectLeft] = false;
    }

    // Select tile right of player
    else if (keysPressed[controls.selectRight]) {
        const newX = player.x + 1;
        if (newX < mapWidth) gameState.selector = { x: newX, y: player.y };
        keysPressed[controls.selectRight] = false;
    }

    // Reset selector to player position
    else if (keysPressed[controls.resetSelector]) {
        gameState.selector = { x: player.x, y: player.y };
        keysPressed[controls.resetSelector] = false;
    }
}