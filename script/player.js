import {
    attemptActionOnTile
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
    showModal,
    inputState,
    finalizeAction
} from './ui.js';

/**
 * Handles player movement input keys.
 */
function handleMovementKeys(player, controls, config) {
    if (inputState.keysPressed[controls.up]) {
        attemptPlayerMove(player, 0, -1, config);
        inputState.keysPressed[controls.up] = false;
        return true;
    }
    if (inputState.keysPressed[controls.down]) {
        attemptPlayerMove(player, 0, 1, config);
        inputState.keysPressed[controls.down] = false;
        return true;
    }
    if (inputState.keysPressed[controls.left]) {
        attemptPlayerMove(player, -1, 0, config);
        inputState.keysPressed[controls.left] = false;
        return true;
    }
    if (inputState.keysPressed[controls.right]) {
        attemptPlayerMove(player, 1, 0, config);
        inputState.keysPressed[controls.right] = false;
        return true;
    }
    return false;
}

/**
 * Handles selector movement input keys.
 */
function handleSelectorKeys(player, controls, config) {
    const { mapWidth, mapHeight } = config;
    const sel = gameState.selector;

    const updateSelector = (x, y) => {
        gameState.selector = { x, y };
        updateTileInfoPanel(config);
        render(config);
    };

    if (inputState.keysPressed[controls.selectUp]) {
        const newY = player.y - 1;
        if (newY >= 0) updateSelector(player.x, newY);
        inputState.keysPressed[controls.selectUp] = false;
        return true;
    }
    if (inputState.keysPressed[controls.selectDown]) {
        const newY = player.y + 1;
        if (newY < mapHeight) updateSelector(player.x, newY);
        inputState.keysPressed[controls.selectDown] = false;
        return true;
    }
    if (inputState.keysPressed[controls.selectLeft]) {
        const newX = player.x - 1;
        if (newX >= 0) updateSelector(newX, player.y);
        inputState.keysPressed[controls.selectLeft] = false;
        return true;
    }
    if (inputState.keysPressed[controls.selectRight]) {
        const newX = player.x + 1;
        if (newX < mapWidth) updateSelector(newX, player.y);
        inputState.keysPressed[controls.selectRight] = false;
        return true;
    }
    if (inputState.keysPressed[controls.resetSelector]) {
        updateSelector(player.x, player.y);
        inputState.keysPressed[controls.resetSelector] = false;
        return true;
    }
    return false;
}

/**
 * Handles action input keys based on config.keyBindings.actions.
 */
function handleActionKeys(config) {
    const actionKeys = config.keyBindings.actions || {};
    const sel = gameState.selector;
    const tile = getTile(sel.x, sel.y, config);

    for (const [actionLabel, key] of Object.entries(actionKeys)) {
        if (!inputState.keysPressed[key]) continue;

        inputState.keysPressed[key] = false; // consume key

        const result = attemptActionOnTile(tile, actionLabel, config, strings, gameState.dailyStats);

        if (!result.success) {
            showModal('gameMessage', {
                title: `Cannot ${strings.actions[actionLabel] || actionLabel} this tile`,
                message: Array.isArray(result.message) ? result.message : [result.message]
            });
            return true;
        }

        if (result.plantModal) {
            showModal('plantSelection', config, tile, sel.x, sel.y);
        } else {
            finalizeAction(config.tiles.actions[actionLabel], config);
        }
        return true;
    }
    return false;
}

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
 * Updates the player position and handles actions based on input.
 * Delegates to movement, selector, and action handlers.
 */
export function updatePlayer(config) {
    if (inputState.modalOpen) {
        Object.keys(inputState.keysPressed).forEach(k => inputState.keysPressed[k] = false);
        return;
    }

    const player = gameState.player;
    const controls = config.keyBindings;

    // Handle inputs in priority: movement > selector > actions
    if (handleMovementKeys(player, controls, config)) return;
    if (handleSelectorKeys(player, controls, config)) return;
    handleActionKeys(config);
}
