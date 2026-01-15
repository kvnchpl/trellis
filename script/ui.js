import {
    gameState,
    getTile,
    resetDailyStats,
    advanceDay
} from './state.js';
import {
    saveGameState,
    getBlockedActionMessages
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

export let strings = {};

export const modalRegistry = {
    plantSelection: {
        overlayId: 'plant-modal-overlay',
        modalId: 'plant-modal',
        setup: (config, tile, x, y) => {
            const container = document.getElementById('plant-modal-buttons');
            container.innerHTML = '';
            Object.entries(config.plants.definitions).forEach(([plantKey, def], idx) => {
                const btn = document.createElement('button');
                btn.textContent = `[${idx + 1}] ${def.label}`;
                btn.className = 'ui-button';
                btn.onclick = () => {
                    const newTile = { ...tile };
                    newTile.plantType = plantKey;
                    newTile.growthStage = def.growthStages[0];
                    gameState.map[`${x},${y}`] = newTile;
                    finalizeAction(config.tiles.actions.plant, config);
                    closeModal();
                };
                container.appendChild(btn);
            });
        }
    },
    gameMessage: {
        overlayId: 'game-message-overlay',
        modalId: 'game-message-modal',
        setup: ({ title, message, confirmText = 'OK', cancelText, onConfirm, onCancel }) => {
            const overlay = document.getElementById('game-message-overlay');
            const modal = document.getElementById('game-message-modal');
            const titleEl = document.getElementById('game-message-title');
            const contentEl = document.getElementById('game-message-content');
            const confirmBtn = document.getElementById('game-message-confirm');
            const cancelBtn = document.getElementById('game-message-cancel');

            titleEl.textContent = title;
            contentEl.innerHTML = Array.isArray(message)
                ? `<ul>${message.map(m => `<li>${m}</li>`).join('')}</ul>`
                : `<div>${message}</div>`;

            confirmBtn.textContent = confirmText;
            confirmBtn.onclick = () => {
                closeModal();
                onConfirm?.();
            };

            if (cancelText) {
                cancelBtn.textContent = cancelText;
                cancelBtn.style.display = 'inline-block';
                cancelBtn.onclick = () => {
                    closeModal();
                    onCancel?.();
                };
            } else cancelBtn.style.display = 'none';

            overlay.style.display = 'flex';
            openModal();
            confirmBtn.focus();
        }
    }
};

export function showModal(type, ...args) {
    const modal = modalRegistry[type];
    if (!modal) throw new Error(`Modal type '${type}' not registered`);
    modal.setup(...args);
}

// Modal helpers
export function openModal() {
    inputState.modalOpen = true;
}

export function closeModal() {
    inputState.modalOpen = false;

    // Clear any stuck input state
    Object.keys(inputState.keysPressed).forEach(
        k => inputState.keysPressed[k] = false
    );
    inputState.blockedKeys.clear();

    // Hide all modal overlays defensively
    const plantOverlay = document.getElementById('plant-modal-overlay');
    if (plantOverlay) plantOverlay.style.display = 'none';

    const messageOverlay = document.getElementById('game-message-overlay');
    if (messageOverlay) messageOverlay.style.display = 'none';
}

/**
 * Loads localized strings from external JSON file.
 */
export async function loadStrings() {
    try {
        const response = await fetch('./data/strings.json');
        if (!response.ok) throw new Error('Failed to load strings.json');
        strings = await response.json();
    } catch (err) {
        console.error('Error loading strings.json:', err);
    }
}

/**
 * Shows a generic game message modal.
 * @param {string} message - Message text to display.
 */
export function showGameMessageModal({
    title,
    message,
    confirmText = "OK",
    cancelText = null,
    onConfirm = null,
    onCancel = null
}) {
    const overlay = document.getElementById('game-message-overlay');
    const titleEl = document.getElementById('game-message-title');
    const contentEl = document.getElementById('game-message-content');
    const confirmBtn = document.getElementById('game-message-confirm');
    const cancelBtn = document.getElementById('game-message-cancel');

    titleEl.textContent = title;
    if (Array.isArray(message)) {
        contentEl.innerHTML = `
            <ul>
                ${message.map(m => `<li>${m}</li>`).join('')}
            </ul>
        `;
    } else {
        contentEl.innerHTML = `<div>${message}</div>`;
    }

    confirmBtn.textContent = confirmText;
    confirmBtn.onclick = () => {
        closeModal();
        onConfirm?.();
    };

    if (cancelText) {
        cancelBtn.textContent = cancelText;
        cancelBtn.style.display = 'inline-block';
        cancelBtn.onclick = () => {
            closeModal();
            onCancel?.();
        };
    } else {
        cancelBtn.style.display = 'none';
    }

    // Overlay click-to-cancel support for cancelable modals
    overlay.onclick = (e) => {
        if (e.target === overlay && cancelText) {
            cancelBtn.click();
        }
    };

    openModal();
    overlay.style.display = 'flex';
    confirmBtn.focus();
}

/**
 * Evaluates if a tile meets a condition.
 * Supports nested AND/OR logic.
 * @param {Object} tile - The tile object.
 * @param {Object} condition - The condition object.
 * @returns {boolean} true if all conditions are met
 */
export function evaluateCondition(tile, condition) {
    if (!condition) return true;

    if (condition.or && Array.isArray(condition.or)) {
        return condition.or.some(sub => evaluateCondition(tile, sub));
    }

    return Object.entries(condition).every(([key, val]) => {
        if (typeof val === "object" && val !== null) {
            if ("lt" in val) return tile[key] < val.lt;
            if ("gt" in val) return tile[key] > val.gt;
            if ("not" in val) return tile[key] !== val.not;
            // nested AND in object
            return evaluateCondition(tile[key], val);
        } else {
            return tile[key] === val;
        }
    });
}

/**
 * Converts failed condition keys into human-readable messages.
 * Uses the unified getActionBlockReasons helper.
 * @param {string[]} failed - Array of failed condition keys/messages (ignored).
 * @param {string} actionLabel - The action being attempted.
 * @param {Object} tile - The tile object.
 * @param {Object} actionDef - The action definition.
 * @returns {string} Formatted reason text
 */
function formatFailedConditions(failed, actionLabel, tile, actionDef) {
    if (!actionDef || !tile) return '';

    // Delegate to unified action-block reason logic
    const reasons = getBlockedActionMessages(tile, { ...actionDef, name: actionLabel }, strings);

    return reasons;
}

/**
 * Applies the effects of an action to a tile and returns the new tile object.
 * @param {Object} tile - The current tile object.
 * @param {Object} actionDef - The action definition.
 * @param {Object} config - Game configuration.
 * @returns {Object} The new tile object after applying effects.
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
 * @param {Object} actionDef - The action definition.
 * @param {Object} config - Game configuration.
 */
function finalizeAction(actionDef, config) {
    updateTileInfoPanel(config);

    // Animate changed values
    Object.entries(actionDef.effect).forEach(([key]) => {
        const el = document.getElementById(`tile-value-${key}`);
        if (el) {
            el.classList.remove('value-changed');
            void el.offsetWidth; // force reflow
            el.classList.add('value-changed');
        }
    });

    saveGameState();

    // Use per-action timeIncrement
    const timeInc = actionDef.timeIncrement ?? 1; // fallback to 1 if missing
    incrementTimeUI(timeInc, config);

    render(config);
}

/**
 * Displays the plant selection modal for planting a crop.
 * @param {Object} config - Game configuration.
 * @param {Object} tile - The tile object.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 */
export function showPlantSelectionModal(config, tile, x, y) {
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
            const plantActionDef = config.tiles.actions.plant;
            finalizeAction(plantActionDef, config);
            closeModal();
            plantModalButtons = [];
            plantModalFocusIndex = 0;
        };
        modalButtonsEl.appendChild(btn);
    });

    overlay.style.display = 'flex';
    // Overlay click-to-cancel: clicking overlay cancels plant modal
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeModal();
            plantModalButtons = [];
            plantModalFocusIndex = 0;
        }
    };
    openModal();

    plantModalButtons = Array.from(
        document.querySelectorAll('#plant-modal-buttons .ui-button:not(.disabled)')
    );
    plantModalFocusIndex = 0;
    if (plantModalButtons.length > 0) {
        plantModalButtons[0].focus();
    }
}
/**
 * Displays the day complete modal with statistics.
 * @param {Object} stats - Daily statistics.
 */
export function showDayCompleteModal(stats, config) {
    const overlay = document.getElementById('game-message-overlay');
    const titleEl = document.getElementById('game-message-title');
    const contentEl = document.getElementById('game-message-content');
    const confirmBtn = document.getElementById('game-message-confirm');
    const cancelBtn = document.getElementById('game-message-cancel');

    titleEl.textContent = 'DAY COMPLETE';
    contentEl.innerHTML = `
        <div>Steps walked: ${stats.steps}</div>
        <div>Crops planted: ${stats.planted}</div>
        <div>Tiles tilled: ${stats.tilled}</div>
        <div>Tiles watered: ${stats.watered}</div>
        <div>Tiles fertilized: ${stats.fertilized}</div>
        <div>Crops harvested: ${stats.harvested}</div>
    `;

    // Hide cancel button for day complete
    cancelBtn.style.display = 'none';

    overlay.style.display = 'flex';
    openModal();
    confirmBtn.focus();

    confirmBtn.onclick = () => {
        closeModal();

        // Advance to next day
        advanceDay(config);
        resetDailyStats();
        if (gameState.time.week !== lastGrowthUpdateWeek) {
            updateGrowth(config);
            lastGrowthUpdateWeek = gameState.time.week;
        }
        updateTimePanel(config);
        saveGameState();
    };
}

/**
 * Updates the tile information panel based on the currently selected tile.
 * @param {Object} config - Game configuration.
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
                const reasonText = formatFailedConditions(null, actionLabel, tileNow, actionDef);

                showGameMessageModal({
                    title: `Cannot ${strings.actions[actionLabel] || actionLabel} this tile`,
                    message: Array.isArray(reasonText) ? reasonText : "The tile does not meet the requirements for this action."
                });
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

/**
 * Updates the time panel display.
 * @param {Object} config - Game configuration.
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

/**
 * Increments the in-game time by the specified number of minutes.
 * Handles day and season transitions, and updates growth weekly.
 * @param {number} minutes - Minutes to increment.
 * @param {Object} config - Game configuration.
 */
export function incrementTimeUI(minutes, config) {
    const time = gameState.time;
    time.minute += minutes;
    while (time.minute >= 60) {
        time.minute -= 60;
        time.hour++;
    }

    if (time.hour >= config.dayEndHour) {
        // Clamp time and wait for player confirmation
        time.hour = config.dayEndHour;
        time.minute = 0;
        showDayCompleteModal({ ...gameState.dailyStats }, config);
    }
    updateTimePanel(config);
}

/**
 * Updates plant growth for all tiles based on their growth time and conditions.
 * @param {Object} config - Game configuration.
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
    // This call is only made once per day rollover due to incrementTimeUI throttling.
    updateTileInfoPanel(config);
}

// Handles keyboard navigation and selection within the plant selection modal.
// This also consumes keys so they do not trigger global actions.
document.addEventListener('keydown', (e) => {
    // Only handle plant modal navigation if plant modal is open and visible
    const plantOverlay = document.getElementById('plant-modal-overlay');
    if (
        plantOverlay &&
        plantOverlay.style.display !== 'none' &&
        inputState.modalOpen
    ) {
        // Only handle keys for plant modal, no Escape key should forcibly close modal here
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
                // Only close via closeModal, not direct overlay manipulation
                closeModal();
                return;
        }

        if (handled) {
            plantModalButtons[plantModalFocusIndex]?.focus();
        }
        return;
    }
});

// Modal keyboard handler for game-message modal (ESC/ENTER behavior)
document.addEventListener('keydown', (e) => {
    if (!inputState.modalOpen) return;

    // ESC = cancel (if available)
    if (e.key === 'Escape') {
        const cancelBtn = document.getElementById('game-message-cancel');
        if (cancelBtn && cancelBtn.style.display !== 'none') {
            e.preventDefault();
            cancelBtn.click();
            return;
        }
    }

    // ENTER = confirm focused button (or confirm button fallback)
    if (e.key === 'Enter') {
        const active = document.activeElement;
        if (active && active.tagName === 'BUTTON') {
            e.preventDefault();
            active.click();
            return;
        }

        const confirmBtn = document.getElementById('game-message-confirm');
        if (confirmBtn) {
            e.preventDefault();
            confirmBtn.click();
        }
    }
});
