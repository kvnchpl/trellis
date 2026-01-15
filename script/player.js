import {
    gameState,
    getTile
} from './state.js';
import {
    saveGameState,
    getBlockedActionMessages
} from './game.js';
import {
    strings,
    incrementTimeUI,
    updateTileInfoPanel,
    evaluateCondition,
    showPlantSelectionModal,
    inputState,
    showGameMessageModal,
    applyActionEffects
} from './ui.js';
import {
    render
} from './renderer.js';

/**
 * Attempts to move the player by (dx, dy) if the target tile is not rock and has no plant.
 * @param {Object} player - The player object.
 * @param {number} dx - Delta x.
 * @param {number} dy - Delta y.
 * @param {Object} config - Game configuration.
 */
function attemptMove(player, dx, dy, config) {
    const newX = player.x + dx;
    const newY = player.y + dy;
    const targetTile = getTile(newX, newY, config);
    if (targetTile.tile !== 'rock' && !targetTile.plantType) {
        player.x = newX;
        player.y = newY;
        gameState.selector = {
            x: player.x,
            y: player.y
        };
        gameState.dailyStats.steps++;
        saveGameState();
        const movementCost = config.movementTimeIncrement || 1;
        incrementTimeUI(movementCost, config);
        updateTileInfoPanel(config);
    }
}

/**
 * Initializes player input event listeners.
 * @param {Object} config - Game configuration (not used here, but provided for consistency)
 */
export function initPlayer(config) {
    window.addEventListener('keydown', (e) => {
        if (inputState.modalOpen) {
            e.preventDefault();
            e.stopPropagation();
            inputState.keysPressed[e.key] = false;
            inputState.blockedKeys.add(e.key);
            return;
        }
        if (inputState.blockedKeys.has(e.key)) {
            inputState.keysPressed[e.key] = false; // ignore keys pressed during modal
            return;
        }
        inputState.keysPressed[e.key] = true;
    });
}

/**
 * Updates the player position and handles player actions based on input.
 * Handles map boundary checking and action key handling.
 * @param {Object} config - Game configuration (expects mapWidth, mapHeight)
 */
export function updatePlayer(config) {
    if (inputState.modalOpen) {
        Object.keys(inputState.keysPressed).forEach(k => inputState.keysPressed[k] = false);
        return;
    }

    const {
        mapWidth,
        mapHeight
    } = config;
    const player = gameState.player;
    const controls = config.keyBindings;

    // Movement
    if (inputState.keysPressed[controls.up]) {
        attemptMove(player, 0, -1, config);
        inputState.keysPressed[controls.up] = false;
    } else if (inputState.keysPressed[controls.down]) {
        attemptMove(player, 0, 1, config);
        inputState.keysPressed[controls.down] = false;
    } else if (inputState.keysPressed[controls.left]) {
        attemptMove(player, -1, 0, config);
        inputState.keysPressed[controls.left] = false;
    } else if (inputState.keysPressed[controls.right]) {
        attemptMove(player, 1, 0, config);
        inputState.keysPressed[controls.right] = false;
    }

    // Select tile above player
    else if (inputState.keysPressed[controls.selectUp]) {
        const newY = player.y - 1;
        if (newY >= 0) gameState.selector = {
            x: player.x,
            y: newY
        };
        inputState.keysPressed[controls.selectUp] = false;
        updateTileInfoPanel(config);
        render(config);
    }
    // Select tile below player
    else if (inputState.keysPressed[controls.selectDown]) {
        const newY = player.y + 1;
        if (newY < mapHeight) gameState.selector = {
            x: player.x,
            y: newY
        };
        inputState.keysPressed[controls.selectDown] = false;
        updateTileInfoPanel(config);
        render(config);
    }
    // Select tile left of player
    else if (inputState.keysPressed[controls.selectLeft]) {
        const newX = player.x - 1;
        if (newX >= 0) gameState.selector = {
            x: newX,
            y: player.y
        };
        inputState.keysPressed[controls.selectLeft] = false;
        updateTileInfoPanel(config);
        render(config);
    }
    // Select tile right of player
    else if (inputState.keysPressed[controls.selectRight]) {
        const newX = player.x + 1;
        if (newX < mapWidth) gameState.selector = {
            x: newX,
            y: player.y
        };
        inputState.keysPressed[controls.selectRight] = false;
        updateTileInfoPanel(config);
        render(config);
    }
    // Reset selector to player position
    else if (inputState.keysPressed[controls.resetSelector]) {
        gameState.selector = {
            x: player.x,
            y: player.y
        };
        inputState.keysPressed[controls.resetSelector] = false;
        updateTileInfoPanel(config);
        render(config);
    }

    // Handle number keys for actions based on config.keyBindings.actions
    const actionKeys = config.keyBindings.actions || {};
    for (const [actionLabel, key] of Object.entries(actionKeys)) {
        const tile = getTile(gameState.selector.x, gameState.selector.y, config);
        if (inputState.keysPressed[key]) {
            inputState.keysPressed[key] = false; // consume the key
            if (actionLabel === 'plant') {
                // Consume all other action keys too
                for (const k of Object.values(config.keyBindings.actions)) {
                    inputState.keysPressed[k] = false;
                }
                showPlantSelectionModal(config, tile, gameState.selector.x, gameState.selector.y);
                return;
            }
            // Extra safety: block all other actions if modal already open
            if (inputState.modalOpen) {
                return;
            }
            inputState.keysPressed[key] = false; // consume key immediately for non-plant actions
            const actionDef = config.tiles.actions[actionLabel];
            if (!actionDef) return;

            const failedReasons = getBlockedActionMessages(tile, { ...actionDef, name: actionLabel }, strings);
            if (failedReasons.length > 0) {
                showGameMessageModal({
                    title: `Cannot ${strings.actions[actionLabel] || actionLabel} this tile`,
                    message: failedReasons
                });
                return;
            }

            const newTile = applyActionEffects(tile, actionDef, config);
            gameState.map[`${gameState.selector.x},${gameState.selector.y}`] = newTile;
            // increment daily stats for each action label
            if (actionLabel === 'plant') gameState.dailyStats.planted++;
            if (actionLabel === 'till') gameState.dailyStats.tilled++;
            if (actionLabel === 'water') gameState.dailyStats.watered++;
            if (actionLabel === 'fertilize') gameState.dailyStats.fertilized++;
            if (actionLabel === 'harvest') gameState.dailyStats.harvested++;
            finalizeAction(actionDef, config);
        }
    }
}
