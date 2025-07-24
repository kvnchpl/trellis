import { gameState, getTile } from './state.js';
import { saveGameState } from './game.js';
import { incrementTime } from './ui.js';
import { updateTileInfoPanel } from './ui.js';

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
    if (keysPressed[controls.up]) {
        const newY = player.y - 1;
        const targetTile = getTile(player.x, newY, config);
        if (targetTile.tile !== 'rock' && !targetTile.plantType) {
            player.y = newY;
            gameState.selector = { x: player.x, y: player.y };
            keysPressed[controls.up] = false;
            saveGameState();
            incrementTime(1, config);
            console.log("Updating info panel for tile at", gameState.selector, getTile(gameState.selector.x, gameState.selector.y, config));
            updateTileInfoPanel(config);
        } else {
            keysPressed[controls.up] = false;
        }
    }

    // Move down
    else if (keysPressed[controls.down]) {
        const newY = player.y + 1;
        const targetTile = getTile(player.x, newY, config);
        if (targetTile.tile !== 'rock' && !targetTile.plantType) {
            player.y = newY;
            gameState.selector = { x: player.x, y: player.y };
            keysPressed[controls.down] = false;
            saveGameState();
            incrementTime(1, config);
            console.log("Updating info panel for tile at", gameState.selector, getTile(gameState.selector.x, gameState.selector.y, config));
            updateTileInfoPanel(config);
        } else {
            keysPressed[controls.down] = false;
        }
    }

    // Move left
    else if (keysPressed[controls.left]) {
        const newX = player.x - 1;
        const targetTile = getTile(newX, player.y, config);
        if (targetTile.tile !== 'rock' && !targetTile.plantType) {
            player.x = newX;
            gameState.selector = { x: player.x, y: player.y };
            keysPressed[controls.left] = false;
            saveGameState();
            incrementTime(1, config);
            console.log("Updating info panel for tile at", gameState.selector, getTile(gameState.selector.x, gameState.selector.y, config));
            updateTileInfoPanel(config);
        } else {
            keysPressed[controls.left] = false;
        }
    }

    // Move right
    else if (keysPressed[controls.right]) {
        const newX = player.x + 1;
        const targetTile = getTile(newX, player.y, config);
        if (targetTile.tile !== 'rock' && !targetTile.plantType) {
            player.x = newX;
            gameState.selector = { x: player.x, y: player.y };
            keysPressed[controls.right] = false;
            saveGameState();
            incrementTime(1, config);
            console.log("Updating info panel for tile at", gameState.selector, getTile(gameState.selector.x, gameState.selector.y, config));
            updateTileInfoPanel(config);
        } else {
            keysPressed[controls.right] = false;
        }
    }

    // Select tile above player
    else if (keysPressed[controls.selectUp]) {
        const newY = player.y - 1;
        if (newY >= 0) gameState.selector = { x: player.x, y: newY };
        keysPressed[controls.selectUp] = false;
        updateTileInfoPanel(config);
    }

    // Select tile below player
    else if (keysPressed[controls.selectDown]) {
        const newY = player.y + 1;
        if (newY < mapHeight) gameState.selector = { x: player.x, y: newY };
        keysPressed[controls.selectDown] = false;
        updateTileInfoPanel(config);
    }

    // Select tile left of player
    else if (keysPressed[controls.selectLeft]) {
        const newX = player.x - 1;
        if (newX >= 0) gameState.selector = { x: newX, y: player.y };
        keysPressed[controls.selectLeft] = false;
        updateTileInfoPanel(config);
    }

    // Select tile right of player
    else if (keysPressed[controls.selectRight]) {
        const newX = player.x + 1;
        if (newX < mapWidth) gameState.selector = { x: newX, y: player.y };
        keysPressed[controls.selectRight] = false;
        updateTileInfoPanel(config);
    }

    // Reset selector to player position
    else if (keysPressed[controls.resetSelector]) {
        gameState.selector = { x: player.x, y: player.y };
        keysPressed[controls.resetSelector] = false;
        updateTileInfoPanel(config);
    }
}