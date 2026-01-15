import { attemptActionOnTile } from './actions.js';
import { gameState, getTile, attemptPlayerMove } from './state.js';
import { inputState } from './ui.js';

/**
 * Handles movement keys and updates player state.
 * Returns the number of minutes the player moved (0 if no movement).
 */
function handleMovementKeys(player, controls, inputState, config) {
    let dx = 0, dy = 0;

    if (inputState.keysPressed[controls.up]) { dy = -1; inputState.keysPressed[controls.up] = false; }
    else if (inputState.keysPressed[controls.down]) { dy = 1; inputState.keysPressed[controls.down] = false; }
    else if (inputState.keysPressed[controls.left]) { dx = -1; inputState.keysPressed[controls.left] = false; }
    else if (inputState.keysPressed[controls.right]) { dx = 1; inputState.keysPressed[controls.right] = false; }

    if (dx !== 0 || dy !== 0) {
        const timeCost = attemptPlayerMove(player, dx, dy, config);
        return timeCost;
    }
    return 0;
}

function handleSelectorKeys(player, controls, inputState, config) {
    const { mapWidth, mapHeight } = config;
    const sel = gameState.selector;

    let newX = sel.x;
    let newY = sel.y;

    if (inputState.keysPressed[controls.selectUp]) {
        newY = Math.max(0, sel.y - 1);
        inputState.keysPressed[controls.selectUp] = false;
    }
    if (inputState.keysPressed[controls.selectDown]) {
        newY = Math.min(mapHeight - 1, sel.y + 1);
        inputState.keysPressed[controls.selectDown] = false;
    }
    if (inputState.keysPressed[controls.selectLeft]) {
        newX = Math.max(0, sel.x - 1);
        inputState.keysPressed[controls.selectLeft] = false;
    }
    if (inputState.keysPressed[controls.selectRight]) {
        newX = Math.min(mapWidth - 1, sel.x + 1);
        inputState.keysPressed[controls.selectRight] = false;
    }
    if (inputState.keysPressed[controls.resetSelector]) {
        newX = player.x;
        newY = player.y;
        inputState.keysPressed[controls.resetSelector] = false;
    }

    const moved = newX !== sel.x || newY !== sel.y;
    if (moved) {
        gameState.selector.x = newX;
        gameState.selector.y = newY;
    }

    return moved;
}

/**
 * Handles actions on the currently selected tile.
 * Only mutates state; no UI handling.
 */
function handleActionKeys(config, inputState, dailyStats) {
    const actionKeys = config.keyBindings.actions || {};
    const sel = gameState.selector;
    const tile = getTile(sel.x, sel.y, config);

    for (const [actionLabel, key] of Object.entries(actionKeys)) {
        if (!inputState.keysPressed[key]) continue;
        inputState.keysPressed[key] = false;

        const result = attemptActionOnTile(tile, actionLabel, config, null, dailyStats); // pass null for strings, UI handles it
        return { actionLabel, result }; // caller handles UI
    }
    return null;
}

export function initPlayer(inputState) {
    window.addEventListener('keydown', (e) => {
        if (inputState.modalOpen) {
            e.preventDefault();
            e.stopPropagation();
            inputState.keysPressed[e.key] = false;
            return;
        }
        inputState.keysPressed[e.key] = true;
    });
}

/**
 * Updates player/selector state and returns info for UI handling.
 */
export function updatePlayer(config, inputState) {
    if (inputState.modalOpen) return null;

    const player = gameState.player;
    const controls = config.keyBindings;

    const movementTime = handleMovementKeys(player, controls, inputState, config);
    const selectorMoved = handleSelectorKeys(controls, inputState, config);
    const actionInfo = handleActionKeys(config, inputState, gameState.dailyStats);

    return {
        movementTime,
        selectorMoved,
        actionInfo
    };
}