import { gameState, getTile } from './state.js';
import { saveGameState } from './game.js';
import { incrementTime } from './ui.js';
import { updateTileInfoPanel } from './ui.js';
import { render } from './renderer.js';

// DRY helper for player movement
function attemptMove(player, dx, dy, config) {
    const newX = player.x + dx;
    const newY = player.y + dy;
    const targetTile = getTile(newX, newY, config);
    if (targetTile.tile !== 'rock' && !targetTile.plantType) {
        player.x = newX;
        player.y = newY;
        gameState.selector = { x: player.x, y: player.y };
        saveGameState();
        incrementTime(1, config);
        updateTileInfoPanel(config);
    }
}

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

    // Move
    if (keysPressed[controls.up]) {
        attemptMove(player, 0, -1, config);
        keysPressed[controls.up] = false;
    }
    else if (keysPressed[controls.down]) {
        attemptMove(player, 0, 1, config);
        keysPressed[controls.down] = false;
    }
    else if (keysPressed[controls.left]) {
        attemptMove(player, -1, 0, config);
        keysPressed[controls.left] = false;
    }
    else if (keysPressed[controls.right]) {
        attemptMove(player, 1, 0, config);
        keysPressed[controls.right] = false;
    }

    // Select tile above player
    else if (keysPressed[controls.selectUp]) {
        const newY = player.y - 1;
        if (newY >= 0) gameState.selector = { x: player.x, y: newY };
        keysPressed[controls.selectUp] = false;
        updateTileInfoPanel(config);
        render(config);
    }

    // Select tile below player
    else if (keysPressed[controls.selectDown]) {
        const newY = player.y + 1;
        if (newY < mapHeight) gameState.selector = { x: player.x, y: newY };
        keysPressed[controls.selectDown] = false;
        updateTileInfoPanel(config);
        render(config);
    }

    // Select tile left of player
    else if (keysPressed[controls.selectLeft]) {
        const newX = player.x - 1;
        if (newX >= 0) gameState.selector = { x: newX, y: player.y };
        keysPressed[controls.selectLeft] = false;
        updateTileInfoPanel(config);
        render(config);
    }

    // Select tile right of player
    else if (keysPressed[controls.selectRight]) {
        const newX = player.x + 1;
        if (newX < mapWidth) gameState.selector = { x: newX, y: player.y };
        keysPressed[controls.selectRight] = false;
        updateTileInfoPanel(config);
        render(config);
    }

    // Reset selector to player position
    else if (keysPressed[controls.resetSelector]) {
        gameState.selector = { x: player.x, y: player.y };
        keysPressed[controls.resetSelector] = false;
        updateTileInfoPanel(config);
        render(config);
    }
}