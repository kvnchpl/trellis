import { gameState, getTile } from './state.js';
import { saveGameState } from './game.js';
import { incrementTime, updateTileInfoPanel, evaluateCondition, getFailedConditions, showPlantSelectionModal } from './ui.js';
import { render } from './renderer.js';

function applyActionEffects(tile, actionDef, config) {
    // Returns a new tile object with effects applied
    const effect = actionDef.effect || {};
    const newTile = { ...tile };
    for (const key in effect) {
        const val = effect[key];
        if (val && typeof val === "object" && !Array.isArray(val)) {
            if ("inc" in val) {
                newTile[key] = (newTile[key] || 0) + val.inc;
            } else if ("dec" in val) {
                newTile[key] = (newTile[key] || 0) - val.dec;
            } else {
                newTile[key] = val;
            }
        } else {
            newTile[key] = val;
        }
    }
    return newTile;
}

function finalizeAction(actionDef, config) {
    const timeCost = actionDef.timeIncrement || 5;
    incrementTime(timeCost, config);
    saveGameState();
    updateTileInfoPanel(config);
    render(config);
}

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

    // Handle number keys for actions based on config.keyBindings.actions
    const actionKeys = config.keyBindings.actions || {};
    for (const [actionLabel, key] of Object.entries(actionKeys)) {
        if (keysPressed[key]) {
            keysPressed[key] = false;
            const actionDef = config.tiles.actions[actionLabel];
            const tile = getTile(gameState.selector.x, gameState.selector.y, config);
            const validNow = evaluateCondition(tile, actionDef.condition);

            if (!validNow) {
                const failed = getFailedConditions(tile, actionDef.condition);
                alert(`Cannot perform "${actionLabel}" on this tile.\nReason(s):\n- ${failed.join('\n- ')}`);
                console.log(`Action "${actionLabel}" blocked:`, failed);
                return;
            }

            if (actionLabel === 'plant') {
                showPlantSelectionModal(config, tile, gameState.selector.x, gameState.selector.y);
            } else {
                const newTile = applyActionEffects(tile, actionDef, config);
                gameState.map[`${gameState.selector.x},${gameState.selector.y}`] = newTile;
                finalizeAction(actionDef, config);
            }
        }
    }
}