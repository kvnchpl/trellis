import {
    evaluateCondition,
    applyActionEffects,
    getBlockedActionMessages
} from './actions.js';

import {
    render,
    updateTileInfoPanelIfChanged
} from './renderer.js';

import {
    gameState,
    getTile,
    resetDailyStats,
    advanceDay,
    advanceTime,
    updateGrowth,
    saveGameState
} from './state.js';

export const inputState = {
    modalOpen: false,
    keysPressed: {},
    keysBlocked: new Set()
};

export let strings = {};

let plantModalButtonList = [];
let plantModalFocusedIndex = 0;
let lastGrowthUpdateWeek = null;
let lastSaveSizeUpdate = 0;

export const modalRegistry = {
    gameMessage: {
        overlayId: 'game-message-overlay',
        modalId: 'game-message-modal',
        setup: ({ title, message, confirmText = 'OK', cancelText, onConfirm, onCancel }) => {
            const overlay = document.getElementById('game-message-overlay');
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
                showModal('closeAll');
                onConfirm?.();
            };

            if (cancelText) {
                cancelBtn.textContent = cancelText;
                cancelBtn.style.display = 'inline-block';
                cancelBtn.onclick = () => {
                    showModal('closeAll');
                    onCancel?.();
                };
            } else {
                cancelBtn.style.display = 'none';
            }

            overlay.style.display = 'flex';
            openModal();

            overlay.onclick = (e) => {
                if (e.target === overlay && cancelText) {
                    cancelBtn.click();
                }
            };

            confirmBtn.focus();
        }
    },
    plantSelection: {
        overlayId: 'plant-modal-overlay',
        modalId: 'plant-modal',
        setup: (config, tile, x, y) => {
            const overlay = document.getElementById('plant-modal-overlay');
            const container = document.getElementById('plant-modal-buttons');
            container.innerHTML = '';

            plantModalButtonList = [];
            plantModalFocusedIndex = 0;

            Object.entries(config.plants.definitions).forEach(([plantKey, def], idx) => {
                const btn = document.createElement('button');
                btn.textContent = `[${idx + 1}] ${def.label}`;
                btn.className = 'ui-button';
                btn.tabIndex = 0;
                btn.onclick = () => {
                    const newTile = { ...tile };
                    newTile.plantType = plantKey;
                    newTile.growthStage = def.growthStages[0];
                    newTile.growthProgress = 0;

                    // Debug logging
                    console.log("DEBUG: Planting tile at", x, y);
                    console.log("DEBUG: plantType =", newTile.plantType);
                    console.log("DEBUG: growthStage =", newTile.growthStage);
                    console.log("DEBUG: plantVariant (before) =", newTile.plantVariant);
                    console.log("DEBUG: image cache variants =", config._imageCache.plants[plantKey]?.[newTile.growthStage]?.length);

                    gameState.map[`${x},${y}`] = newTile;
                    gameState.dailyStats.planted++;
                    finalizeAction(config.tiles.actions.plant, config);
                    showModal('closeAll');
                };
                container.appendChild(btn);
                plantModalButtonList.push(btn);
            });

            overlay.style.display = 'flex';
            openModal();

            if (plantModalButtonList.length > 0) {
                plantModalButtonList[0].focus();
            }

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    showModal('closeAll');
                }
            };
        }
    },
    dayComplete: {
        setup: (stats, config) => {
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

            // Hide cancel button
            cancelBtn.style.display = 'none';

            overlay.style.display = 'flex';
            openModal();
            confirmBtn.focus();

            confirmBtn.onclick = () => {
                showModal('closeAll');
                // Advance to next day
                advanceDay(config);
                resetDailyStats();
                if (gameState.time.week !== lastGrowthUpdateWeek) {
                    const changedTiles = updateGrowth(config);
                    lastGrowthUpdateWeek = gameState.time.week;

                    // Only refresh tile info if the currently selected tile changed
                    if (changedTiles.includes(`${gameState.selector.x},${gameState.selector.y}`)) {
                        updateTileInfoPanel(config);
                    }
                }
                updateTimePanel(config);
                saveGameState(config);
                updateSaveSizeDisplay(config);
            };
        }
    },
    closeAll: {
        setup: () => {
            inputState.modalOpen = false;

            Object.keys(inputState.keysPressed).forEach(k => inputState.keysPressed[k] = false);
            inputState.keysBlocked.clear();

            const plantOverlay = document.getElementById('plant-modal-overlay');
            if (plantOverlay) plantOverlay.style.display = 'none';

            const gameOverlay = document.getElementById('game-message-overlay');
            if (gameOverlay) gameOverlay.style.display = 'none';

            plantModalButtonList = [];
            plantModalFocusedIndex = 0;
        }
    }
};

export function showModal(type, ...args) {
    const modal = modalRegistry[type];
    if (!modal) throw new Error(`Modal type '${type}' not registered`);
    modal.setup(...args);
}

export function openModal() {
    inputState.modalOpen = true;
}

export function closeModal() {
    inputState.modalOpen = false;

    // Clear any stuck input state
    Object.keys(inputState.keysPressed).forEach(
        k => inputState.keysPressed[k] = false
    );
    inputState.keysBlocked.clear();

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
 * Finalizes an action by updating the UI, saving the game, incrementing time, and rendering.
 * @param {Object} actionDef - The action definition.
 * @param {Object} config - Game configuration.
 */
export function finalizeAction(actionDef, config) {
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

    saveGameState(config);
    updateSaveSizeDisplay(config);

    // Use per-action timeIncrement
    const timeInc = actionDef.timeIncrement ?? 1; // fallback to 1 if missing
    incrementTimeUI(timeInc, config);

    render(config);
}

/**
 * Determines the correct image src and visibility for the tile info panel.
 * @param {Object} tile
 * @param {Object} config
 */
function _getTileImage(tile, config) {
    const imageEl = document.getElementById('tile-image');
    if (!imageEl) return;

    const fallbackImage = 'assets/debug/missing.png';

    // Plant image (with variants)
    if (tile.plantType && config.plants.images && config.plants.images[tile.plantType]) {
        const def = config.plants.definitions[tile.plantType];
        if (!def) {
            console.warn('Missing plant definition for', tile.plantType);
            imageEl.style.display = 'none';
            return;
        }

        const stageIndex = def.growthStages.indexOf(tile.growthStage);
        if (stageIndex < 0) {
            console.warn('Invalid growth stage for', tile.plantType, tile.growthStage);
            imageEl.style.display = 'none';
            return;
        }

        const variants = config._imageCache.plants[tile.plantType]?.[tile.growthStage];
        if (!variants || variants.length === 0) {
            console.warn('Missing plant images for', tile.plantType, tile.growthStage);
            imageEl.style.display = 'none';
            return;
        }

        const idx = tile.plantVariant ?? 0;
        imageEl.src = variants[idx]?.src || fallbackImage;
        imageEl.style.display = 'block';
        return;
    }

    // Tile image (with variants)
    const imageKey = tile.tile || 'default';
    const variants = config._imageCache.tiles[imageKey];
    if (!variants || variants.length === 0) {
        console.warn('Missing tile images for', imageKey);
        imageEl.style.display = 'none';
        return;
    }

    const idx = tile.tileVariant ?? 0;
    imageEl.src = variants[idx]?.src || fallbackImage;
    imageEl.style.display = 'block';
}

/**
 * Formats the value for a given tile detail key, applying labels, booleans, percentages, etc.
 * @param {Object} tile
 * @param {string} key
 * @param {Object} config
 * @returns {Object} { label, value }
 */
function _formatTileDetailValue(tile, key, config) {
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
    return { label, value };
}

/**
 * Renders the action buttons for the tile info panel.
 * @param {Object} tile
 * @param {Object} config
 */
function _renderActionButtons(tile, config) {
    const actionsEl = document.getElementById('tile-actions');
    if (!actionsEl) return;
    actionsEl.innerHTML = '';

    // Sort actions by their keyBindings number
    const sortedActions = Object.entries(config.tiles.actions)
        .sort(([aLabel], [bLabel]) => {
            const aKey = parseInt(config.keyBindings.actions[aLabel] || 99);
            const bKey = parseInt(config.keyBindings.actions[bLabel] || 99);
            return aKey - bKey;
        });

    for (const [actionLabel, actionDef] of sortedActions) {
        const isPlant = actionLabel === "plant";
        // Always get the current tile state in case it was updated
        const tileNow = getTile(gameState.selector.x, gameState.selector.y, config);
        let validNow = evaluateCondition(tileNow, actionDef.condition);
        // Prevent planting if tile already has a plant
        if (isPlant && tileNow.plantType) {
            validNow = false;
        }

        const key = config.keyBindings.actions[actionLabel] || '';
        const btn = document.createElement('button');
        btn.className = 'ui-button';
        btn.textContent = `[${key}] ${actionLabel}`;

        if (!validNow) btn.classList.add('disabled');

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tileLatest = getTile(gameState.selector.x, gameState.selector.y, config);
            const valid = evaluateCondition(tileLatest, actionDef.condition);
            if (isPlant && tileLatest.plantType) {
                // Prevent planting if already planted
                return;
            }
            if (!valid) {
                const reasonText = formatFailedConditions(null, actionLabel, tileLatest, actionDef);
                showModal('gameMessage', {
                    title: `Cannot ${strings.actions[actionLabel] || actionLabel} this tile`,
                    message: Array.isArray(reasonText) ? reasonText : "The tile does not meet the requirements for this action."
                });
                return;
            }
            if (isPlant) {
                showModal('plantSelection', config, tileLatest, gameState.selector.x, gameState.selector.y);
            } else {
                const newTile = applyActionEffects(tileLatest, actionDef, config);
                gameState.map[`${gameState.selector.x},${gameState.selector.y}`] = newTile;
                finalizeAction(actionDef, config);
            }
        };
        actionsEl.appendChild(btn);
    }
}

/**
 * Updates the tile information panel based on the currently selected tile.
 * @param {Object} config - Game configuration.
 */
export function updateTileInfoPanel(config) {
    const tile = getTile(gameState.selector.x, gameState.selector.y, config);
    const detailsEl = document.getElementById('tile-details');
    if (!detailsEl) return;

    _getTileImage(tile, config);

    detailsEl.innerHTML = '';
    config.tiles.detailsOrder.forEach((key) => {
        const { label, value } = _formatTileDetailValue(tile, key, config);
        const p = document.createElement('p');
        p.innerHTML = `<strong>${label}:</strong> <span id="tile-value-${key}">${value}</span>`;
        detailsEl.appendChild(p);
    });

    _renderActionButtons(tile, config);
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

export function incrementTimeUI(minutes, config) {
    advanceTime(minutes, config); // pure state update

    // Check for end-of-day
    if (gameState.time.hour >= config.dayEndHour) {
        showModal('dayComplete', { ...gameState.dailyStats }, config);
    }

    // Update UI elements
    updateTimePanel(config);

    // Optionally: trigger weekly growth
    if (gameState.time.week !== lastGrowthUpdateWeek) {
        const changedTiles = updateGrowth(config);
        lastGrowthUpdateWeek = gameState.time.week;

        if (changedTiles.includes(`${gameState.selector.x},${gameState.selector.y}`)) {
            updateTileInfoPanel(config);
        }
    }
}

// Handles keyboard navigation and selection within the plant selection modal.
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

        // Always clear keysPressed and keysBlocked for safety
        Object.keys(inputState.keysPressed).forEach(k => inputState.keysPressed[k] = false);
        inputState.keysBlocked.clear();

        const columns = 2;
        let handled = false;

        switch (e.key) {
            case 'ArrowRight':
            case 'd':
            case 'D':
                plantModalFocusedIndex = Math.min(
                    plantModalFocusedIndex + 1,
                    plantModalButtonList.length - 1
                );
                handled = true;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                plantModalFocusedIndex = Math.max(
                    plantModalFocusedIndex - 1,
                    0
                );
                handled = true;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                plantModalFocusedIndex = Math.min(
                    plantModalFocusedIndex + columns,
                    plantModalButtonList.length - 1
                );
                handled = true;
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
                plantModalFocusedIndex = Math.max(
                    plantModalFocusedIndex - columns,
                    0
                );
                handled = true;
                break;
            case 'Enter':
            case ' ':
                plantModalButtonList[plantModalFocusedIndex]?.click();
                return;
            case '1': case '2': case '3': case '4': case '5':
            case '6': case '7': case '8': case '9': {
                const index = Number(e.key) - 1;
                if (plantModalButtonList[index]) {
                    plantModalButtonList[index].click();
                }
                return;
            }
            case 'Escape':
                // Only close via closeModal, not direct overlay manipulation
                closeModal();
                return;
        }

        if (handled) {
            plantModalButtonList[plantModalFocusedIndex]?.focus();
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

export function updateSaveSizeDisplay(config) {
    const saveEl = document.getElementById("save-size");
    if (!saveEl) return;

    const sizeInBytes = saveGameState(config);
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);

    let warningText = "";
    if (config?.saveSizeWarningKB && sizeInBytes > 1024 * config.saveSizeWarningKB) {
        warningText = " ⚠ nearing limit";
    }
    if (config?.saveSizeCriticalKB && sizeInBytes > 1024 * config.saveSizeCriticalKB) {
        warningText = " ⚠⚠ close to limit!";
    }

    saveEl.textContent = `(${sizeInKB} KB${warningText})`;
}

function maybeUpdateSaveSizeDisplay(config) {
    const now = performance.now();
    if (now - lastSaveSizeUpdate > 2000) {
        updateSaveSizeDisplay(config);
        lastSaveSizeUpdate = now;
    }
}

export function refreshUI(config) {
    updateTimePanel(config);
    updateTileInfoPanelIfChanged(config);
    maybeUpdateSaveSizeDisplay(config);
}
// DEBUG: Global fetch and XHR logger
const oldFetch = window.fetch;
window.fetch = async (...args) => {
    console.log("DEBUG: Fetch called:", ...args);
    return oldFetch(...args);
};

const oldOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    console.log("DEBUG: XHR request:", method, url);
    return oldOpen.call(this, method, url, ...rest);
};