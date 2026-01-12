import {
    gameState,
    getTile
} from './state.js';
import {
    saveGameState
} from './game.js';
import {
    render
} from './renderer.js';

export const inputState = {
    modalOpen: false,
    keysPressed: {},
    blockedKeys: new Set()
};

let plantModalButtons = [];
let plantModalFocusIndex = 0;
let lastGrowthUpdateWeek = null;

/**
 * Evaluates if a tile meets the specified conditions.
 * @param {*} tile 
 * @param {*} condObj 
 * @returns 
 */
export function evaluateCondition(tile, condObj) {
    if (condObj.or && Array.isArray(condObj.or)) {
        return condObj.or.some(c => evaluateCondition(tile, c));
    }
    return Object.entries(condObj).every(([key, cond]) => {
        const current = tile[key];
        if (cond === 'exists') return !(current === null || current === undefined);
        if (typeof cond === 'object' && cond !== null) {
            if ('not' in cond) return current !== cond.not;
            if ('lt' in cond && !(current < cond.lt)) return false;
            if ('gt' in cond && !(current > cond.gt)) return false;
            if ('lte' in cond && !(current <= cond.lte)) return false;
            if ('gte' in cond && !(current >= cond.gte)) return false;
        } else {
            if (current !== cond) return false;
        }
        return true;
    });
}

/**
 * Returns an array of human-readable strings describing which conditions failed.
 * @param {*} tile 
 * @param {*} condObj 
 * @returns {string[]}
 */
export function getFailedConditions(tile, condObj) {
    const failed = [];

    if (condObj.or && Array.isArray(condObj.or)) {
        const passed = condObj.or.some(c => evaluateCondition(tile, c));
        if (!passed) {
            // Convert each OR alternative into a human-friendly description
            const readable = condObj.or.map(c => {
                const key = Object.keys(c)[0];
                const val = c[key];
                if (typeof val === 'object' && val.not !== undefined) return `${key} must not be ${val.not}`;
                if (typeof val === 'object' && val.lt !== undefined) return `${key} must be less than ${val.lt}`;
                if (typeof val === 'object' && val.gt !== undefined) return `${key} must be greater than ${val.gt}`;
                if (typeof val === 'object' && val.lte !== undefined) return `${key} must be ≤ ${val.lte}`;
                if (typeof val === 'object' && val.gte !== undefined) return `${key} must be ≥ ${val.gte}`;
                if (val === 'exists') return `${key} must exist`;
                return `${key} must be ${val}`;
            });
            failed.push(`One of: ${readable.join(', ')}`);
        }
        return failed;
    }

    // Handle single conditions as before
    Object.entries(condObj).forEach(([key, cond]) => {
        const current = tile[key];
        if (cond === 'exists') {
            if (current === null || current === undefined) failed.push(`${key} must exist`);
        } else if (typeof cond === 'object' && cond !== null) {
            if ('not' in cond && current === cond.not) failed.push(`${key} must not be ${cond.not}`);
            if ('lt' in cond && !(current < cond.lt)) failed.push(`${key} must be < ${cond.lt}`);
            if ('gt' in cond && !(current > cond.gt)) failed.push(`${key} must be > ${cond.gt}`);
            if ('lte' in cond && !(current <= cond.lte)) failed.push(`${key} must be ≤ ${cond.lte}`);
            if ('gte' in cond && !(current >= cond.gte)) failed.push(`${key} must be ≥ ${cond.gte}`);
        } else {
            if (current !== cond) failed.push(`${key} must be ${cond}`);
        }
    });

    return failed;
}

/**
 * Applies the effects of an action to a tile and returns the new tile object.
 * @param {Object} tile 
 * @param {Object} actionDef
 * @param {Object} config
 * @returns {Object} new tile object
 */
function applyActionEffects(tile, actionDef, config) {
    const newTile = {
        ...tile
    };
    Object.entries(actionDef.effect).forEach(([key, change]) => {
        if (change !== null && typeof change === 'object') {
            if ('inc' in change) {
                newTile[key] = Math.min(config[`${key}Range`].max, tile[key] + change.inc);
            }
            if ('dec' in change) {
                newTile[key] = Math.max(config[`${key}Range`].min, tile[key] - change.dec);
            }
        } else {
            newTile[key] = change;
        }
    });
    return newTile;
}

/**
 * Finalizes an action by updating the UI, saving the game, incrementing time, and rendering.
 * @param {Object} actionDef 
 * @param {Object} config 
 */
function finalizeAction(actionDef, config) {
    updateTileInfoPanel(config);
    Object.entries(actionDef.effect).forEach(([key]) => {
        const el = document.getElementById(`tile-value-${key}`);
        if (el) {
            el.classList.remove('value-changed');
            void el.offsetWidth;
            el.classList.add('value-changed');
        }
    });
    saveGameState();
    incrementTime(config.actionTimeIncrement, config);
    render(config);
}

/**
 * Displays the plant selection modal for planting a crop.
 * @param {Object} config
 * @param {Object} tile
 * @param {number} x
 * @param {number} y
 */
export function showPlantSelectionModal(config, tile, x, y) {
    console.log("DEBUG: showPlantSelectionModal called. inputState before =", inputState);
    const overlay = document.getElementById('plant-modal-overlay');
    const modalButtonsEl = document.getElementById('plant-modal-buttons');

    // Clear previous buttons
    modalButtonsEl.innerHTML = '';

    // Create buttons for each plant
    Object.entries(config.plants.definitions).forEach(([plantKey, plantDef], idx) => {
        const btn = document.createElement('button');

        // Assign number key for selection (1-indexed)
        const numberKey = (idx + 1).toString();

        btn.textContent = `[${numberKey}] ${plantDef.label || plantKey}`;
        btn.classList.add('ui-button');
        btn.tabIndex = 0;

        btn.onclick = () => {
            const newTile = { ...tile };
            newTile.plantType = plantKey;
            newTile.growthStage = plantDef.growthStages[0];
            newTile.growthProgress = 0;
            gameState.map[`${x},${y}`] = newTile;

            finalizeAction({ effect: { plantType: null, growthStage: null, growthProgress: 0 } }, config);

            console.log("DEBUG: Closing plant modal, inputState before =", inputState);
            // Close modal
            inputState.modalOpen = false;

            // Clear all keys pressed inside the modal
            Object.keys(inputState.keysPressed).forEach(k => inputState.keysPressed[k] = false);

            // Clear blockedKeys to allow normal input again
            inputState.blockedKeys.clear();

            plantModalButtons = [];
            plantModalFocusIndex = 0;
            overlay.style.display = 'none';
        };

        modalButtonsEl.appendChild(btn);
    });

    overlay.style.display = 'flex';
    inputState.modalOpen = true;
    console.log("DEBUG: inputState after setting modalOpen =", inputState);

    plantModalButtons = Array.from(
        document.querySelectorAll('#plant-modal-buttons .ui-button:not(.disabled)')
    );

    plantModalFocusIndex = 0;

    if (plantModalButtons.length > 0) {
        plantModalButtons[0].focus();
    }
}
/**
 * Updates the tile information panel based on the currently selected tile.
 * @param {Object} config
 */
export function updateTileInfoPanel(config) {
    const tile = getTile(gameState.selector.x, gameState.selector.y, config);
    const detailsEl = document.getElementById('tile-details');
    const actionsEl = document.getElementById('tile-actions');

    // Show tile image if available (prefer plant image if plantType present)
    const imageEl = document.getElementById('tile-image');
    if (imageEl) {
        if (tile.plantType && config.plants.images && Array.isArray(config.plants.images[tile.plantType])) {
            const stageIndex = config.plants.definitions[tile.plantType].growthStages.indexOf(tile.growthStage);
            if (stageIndex >= 0 && config.plants.images[tile.plantType][stageIndex]) {
                imageEl.src = config.plants.images[tile.plantType][stageIndex];
                imageEl.style.display = 'block';
            } else {
                imageEl.style.display = 'none';
                return;
            }
        } else {
            const imageKey = tile.tile;
            if (imageKey && config.tiles.images && config.tiles.images[imageKey]) {
                imageEl.src = config.tiles.images[imageKey];
                imageEl.style.display = 'block';
            } else {
                imageEl.style.display = 'none';
            }
        }
    }

    detailsEl.innerHTML = '';
    actionsEl.innerHTML = '';

    config.tiles.detailsOrder.forEach((key, idx) => {
        const p = document.createElement('p');
        let value = tile[key];

        // Normalize undefined or null to 'none' for tile and plantType
        if ((key === 'tile' || key === 'plantType') && (value === null || value === undefined)) {
            value = 'none';
        }

        // Handle boolean values: always display Yes or No
        if (typeof value === 'boolean') {
            value = value ? 'Yes' : 'No';
        }

        // Apply labels if defined
        if (key === 'tile' && config.tiles.labels && config.tiles.labels[value]) {
            value = config.tiles.labels[value];
        }
        if (key === 'plantType') {
            value = config.plants.definitions[value]?.label || value;
        }

        // Format numeric values
        if ((key === 'moisture' || key === 'fertility') && typeof value === 'number') {
            value = `${value}%`;
        }

        // Fallback if still no value
        if (value === null || value === undefined) {
            value = '–';
        }

        // Apply custom labels for these keys if defined
        const label = (config.tiles.labels && config.tiles.labels[key]) ?
            config.tiles.labels[key] :
            key;
        p.innerHTML = `<strong>${label}:</strong> <span id="tile-value-${key}">${value}</span>`;
        detailsEl.appendChild(p);
    });

    // Prepare plant select dropdown if "plant" action is valid
    let plantActionValid = false;
    for (const [actionLabel, actionDef] of Object.entries(config.tiles.actions)) {
        if (actionLabel === "plant") {
            if (evaluateCondition(tile, actionDef.condition)) {
                plantActionValid = true;
                break;
            }
        }
    }
    // Prevent planting if tile already has a plant
    if (tile.plantType) {
        plantActionValid = false;
    }

    // Determine if planting is valid
    let plantEnabled = evaluateCondition(tile, config.tiles.actions.plant.condition);
    if (tile.plantType) plantEnabled = false; // cannot plant if tile already has a plant

    // Add default option and plant options
    const plantKey = config.keyBindings.actions['plant'] || '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = `[${plantKey}] plant`;

    // Now iterate actions and render their buttons (handling "plant" specially)
    actionsEl.innerHTML = ''; // clear existing buttons

    // Sort actions by their keyBindings number
    const sortedActions = Object.entries(config.tiles.actions)
        .sort(([aLabel], [bLabel]) => {
            const aKey = parseInt(config.keyBindings.actions[aLabel] || 99);
            const bKey = parseInt(config.keyBindings.actions[bLabel] || 99);
            return aKey - bKey;
        });

    for (const [actionLabel, actionDef] of sortedActions) {
        const isPlant = actionLabel === "plant";
        const tile = getTile(gameState.selector.x, gameState.selector.y, config);
        const validNow = evaluateCondition(tile, actionDef.condition);

        const key = config.keyBindings.actions[actionLabel] || '';
        const btn = document.createElement('button');
        btn.className = 'ui-button';
        btn.textContent = `[${key}] ${actionLabel}`;

        if (!validNow) btn.classList.add('disabled');

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tileNow = getTile(gameState.selector.x, gameState.selector.y, config);
            const valid = evaluateCondition(tileNow, actionDef.condition);
            if (!valid) {
                const failed = getFailedConditions(tileNow, actionDef.condition);
                const message = failed.length ?
                    `Cannot perform "${actionLabel}" on this tile.\nReason(s):\n- ${failed.join('\n- ')}` :
                    `Cannot perform "${actionLabel}" on this tile.`;
                alert(message);
                console.log(`Action "${actionLabel}" blocked on tile:`, tileNow, "Failed conditions:", failed);
                return;
            }
            if (isPlant) {
                showPlantSelectionModal(config, tileNow, gameState.selector.x, gameState.selector.y);
            } else {
                const newTile = applyActionEffects(tileNow, actionDef, config);
                gameState.map[`${gameState.selector.x},${gameState.selector.y}`] = newTile;
                finalizeAction(actionDef, config);
            }
        };

        actionsEl.appendChild(btn);
    }
}

/** Updates the time panel display.
 * @param {Object} config
 */
export function updateTimePanel(config) {
    const el = document.getElementById('time-display');
    if (!el) return;
    const {
        hour,
        minute,
        week,
        seasonIndex
    } = gameState.time;
    const period = hour < 12 ? 'AM' : 'PM';
    const displayHour = ((hour - 1) % 12 + 1);
    const paddedMinute = minute.toString().padStart(2, '0');
    const season = config.seasons[seasonIndex];
    el.textContent = `${season} - WEEK ${week} - ${displayHour}:${paddedMinute} ${period}`;
}

/** Increments the in-game time by the specified number of minutes.
 * Handles day and season transitions, and updates growth weekly.
 * @param {number} minutes 
 * @param {Object} config 
 */
export function incrementTime(minutes, config) {
    const time = gameState.time;
    time.minute += minutes;
    while (time.minute >= 60) {
        time.minute -= 60;
        time.hour++;
    }

    if (time.hour >= config.dayEndHour) {
        alert('A new day is starting.');
        time.hour = config.dayStartHour;
        time.minute = 0;
        time.week++;
        if (time.week > config.weeksPerSeason) {
            time.week = 1;
            time.seasonIndex = (time.seasonIndex + 1) % config.seasons.length;
        }
        // Only update growth if not already updated for this week
        if (time.week !== lastGrowthUpdateWeek) {
            updateGrowth(config);
            lastGrowthUpdateWeek = time.week;
        }
    }
    updateTimePanel(config);
}

/** Updates plant growth for all tiles based on their growth time and conditions.
 * @param {Object} config 
 */
function updateGrowth(config) {
    for (const tile of Object.values(gameState.map)) {
        if (!tile.plantType) continue;
        const def = config.plants.definitions[tile.plantType];
        if (!def) continue;

        tile.growthProgress++;
        if (tile.growthProgress >= def.growthTime) {
            const idx = def.growthStages.indexOf(tile.growthStage);
            if (idx < def.growthStages.length - 1) {
                tile.growthStage = def.growthStages[idx + 1];
                tile.growthProgress = 0;
                if (def.harvestable && tile.growthStage === def.growthStages[def.growthStages.length - 1]) {
                    tile.readyToHarvest = true;
                }
            }
        }
        tile.moisture = Math.max(0, tile.moisture - def.moistureUse);
        tile.fertility = Math.max(0, tile.fertility - def.fertilityUse);
    }
    // Refresh tile info panel to reflect updated growth stage and image.
    // This call is only made once per day rollover due to incrementTime throttling.
    updateTileInfoPanel(config);
}

// Handles keyboard navigation and selection within the plant selection modal.
// This also consumes keys so they do not trigger global actions.
document.addEventListener('keydown', (e) => {
    if (!inputState.modalOpen) return;

    e.preventDefault();
    e.stopPropagation();

    // Always clear keysPressed and blockedKeys for safety
    Object.keys(inputState.keysPressed).forEach(k => inputState.keysPressed[k] = false);
    inputState.blockedKeys.clear();

    const columns = 2;
    let handled = false;

    switch (e.key) {
        case 'ArrowRight':
        case 'd':
        case 'D':
            plantModalFocusIndex = Math.min(
                plantModalFocusIndex + 1,
                plantModalButtons.length - 1
            );
            handled = true;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            plantModalFocusIndex = Math.max(
                plantModalFocusIndex - 1,
                0
            );
            handled = true;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            plantModalFocusIndex = Math.min(
                plantModalFocusIndex + columns,
                plantModalButtons.length - 1
            );
            handled = true;
            break;
        case 'ArrowUp':
        case 'w':
        case 'W':
            plantModalFocusIndex = Math.max(
                plantModalFocusIndex - columns,
                0
            );
            handled = true;
            break;
        case 'Enter':
        case ' ':
            plantModalButtons[plantModalFocusIndex]?.click();
            return;
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9': {
            const index = Number(e.key) - 1;
            if (plantModalButtons[index]) {
                plantModalButtons[index].click();
            }
            return;
        }
        case 'Escape':
            document.getElementById('plant-modal-overlay').style.display = 'none';
            inputState.modalOpen = false;
            return;
    }

    if (handled) {
        plantModalButtons[plantModalFocusIndex]?.focus();
    }
});
