import {
    applyActionEffects,
    getBlockedActionMessages
} from './actions.js';

import {
    render
} from './renderer.js';

import {
    gameState,
    getTile,
    attemptPlayerMove
} from './state.js';

import {
    strings,
    updateTileInfoPanel,
    showPlantSelectionModal,
    inputState,
    showGameMessageModal,
    finalizeAction
} from './ui.js';

/**
 * Initializes player input event listeners.
 */
export function initPlayer() {
    window.addEventListener('keydown', (e) => {
        if (inputState.modalOpen) {
            e.preventDefault();
            e.stopPropagation();
            inputState.keysPressed[e.key] = false;
            inputState.keysBlocked.add(e.key);
            return;
        }
        if (inputState.keysBlocked.has(e.key)) {
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
        attemptPlayerMove(player, 0, -1, config);
        inputState.keysPressed[controls.up] = false;
    } else if (inputState.keysPressed[controls.down]) {
        attemptPlayerMove(player, 0, 1, config);
        inputState.keysPressed[controls.down] = false;
    } else if (inputState.keysPressed[controls.left]) {
        attemptPlayerMove(player, -1, 0, config);
        inputState.keysPressed[controls.left] = false;
    } else if (inputState.keysPressed[controls.right]) {
        attemptPlayerMove(player, 1, 0, config);
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

            const result = attemptActionOnTile(tile, actionLabel, config, strings, gameState.dailyStats);

            if (!result.success) {
                showGameMessageModal({
                    title: `Cannot ${strings.actions[actionLabel] || actionLabel} this tile`,
                    message: Array.isArray(result.message) ? result.message : [result.message]
                });
                return;
            }

            if (result.plantModal) {
                showPlantSelectionModal(config, tile, gameState.selector.x, gameState.selector.y);
            } else {
                finalizeAction(config.tiles.actions[actionLabel], config);
            }
        }
    }
}
