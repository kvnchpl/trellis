import {
    gameState,
    getTile
} from './state.js';
import {
    saveGameState
} from './game.js';
import {
    incrementTime,
    updateTileInfoPanel,
    evaluateCondition,
    getFailedConditions,
    showPlantSelectionModal,
    inputState
} from './ui.js';
import {
    render
} from './renderer.js';

function applyActionEffects(tile, actionDef, config) {
    // Returns a new tile object with effects applied
    const effect = actionDef.effect || {};
    const newTile = {
        ...tile
    };
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
        gameState.selector = {
            x: player.x,
            y: player.y
        };
        saveGameState();

        const movementCost = config.movementTimeIncrement || 1;
        incrementTime(movementCost, config);

        updateTileInfoPanel(config);
    }
}

/**
 * Initializes player input event listeners.
 * @param {Object} config - Game configuration (not used here, but provided for consistency)
 */
export function initPlayer(config) {
    window.addEventListener('keydown', (e) => {
        console.log(`DEBUG: keydown captured: ${e.key}, inputState.modalOpen =`, inputState.modalOpen);

        if (inputState.modalOpen) {
            inputState.keysPressed[e.key] = false;
            inputState.blockedKeys.add(e.key); // track keys pressed during modal
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
 * Updates the player position based on input, with map boundary checking.
 * @param {Object} config - Game configuration (expects mapWidth, mapHeight)
 */
export function updatePlayer(config) {
    const frameTime = performance.now();
    console.log(`DEBUG: frame ${frameTime.toFixed(2)}, inputState =`, inputState.modalOpen);
    console.log("DEBUG: keysPressed at start of updatePlayer:", inputState.keysPressed);

    if (inputState.modalOpen) {
        console.log("DEBUG: updatePlayer early exit because modal is open");
        Object.keys(inputState.keysPressed).forEach(k => inputState.keysPressed[k] = false);
        return;
    }

    console.log("DEBUG: inputState.modalOpen =", inputState.modalOpen);

    const {
        mapWidth,
        mapHeight
    } = config;
    const player = gameState.player;
    const controls = config.keyBindings;

    // Move
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

        console.log(`DEBUG: Checking action key '${key}' for '${actionLabel}' on tile at (${gameState.selector.x},${gameState.selector.y}), inputState =`, inputState.modalOpen);

        if (inputState.keysPressed[key]) {
            inputState.keysPressed[key] = false; // consume the key
            console.log(`DEBUG: Consumed key '${key}' for action '${actionLabel}' at frame ${frameTime.toFixed(2)}`);
            if (actionLabel === 'plant') {
                // Consume all other action keys too
                for (const k of Object.values(config.keyBindings.actions)) {
                    inputState.keysPressed[k] = false;
                }
                showPlantSelectionModal(config, tile, gameState.selector.x, gameState.selector.y);
                console.log(`DEBUG: Plant modal opened, exiting updatePlayer to block other actions`);
                return;
            }
            // Extra safety: block all other actions if modal already open
            if (inputState.modalOpen) {
                console.log(`DEBUG: Skipping action "${actionLabel}" because modal is open`);
                return;
            }
            inputState.keysPressed[key] = false; // consume key immediately for non-plant actions
            const actionDef = config.tiles.actions[actionLabel];
            const validNow = evaluateCondition(tile, actionDef.condition);
            if (!validNow) {
                const failed = getFailedConditions(tile, actionDef.condition);
                alert(`Cannot perform "${actionLabel}" on this tile.\nReason(s):\n- ${failed.join('\n- ')}`);
                console.log(`Action "${actionLabel}" blocked:`, failed);
                return;
            }
            const newTile = applyActionEffects(tile, actionDef, config);
            gameState.map[`${gameState.selector.x},${gameState.selector.y}`] = newTile;
            finalizeAction(actionDef, config);
        }
    }
}
