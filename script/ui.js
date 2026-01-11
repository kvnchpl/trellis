import { gameState, getTile } from './state.js';
import { saveGameState } from './game.js';
import { render } from './renderer.js';

// --- Growth update throttling/caching ---
let lastGrowthUpdateWeek = null;

// --- Helper functions for DRY logic ---
function evaluateCondition(tile, condObj) {
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

function applyActionEffects(tile, actionDef, config) {
    const newTile = { ...tile };
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
        const label = (config.tiles.labels && config.tiles.labels[key])
            ? config.tiles.labels[key]
            : key;
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
    // If plant action is valid, render a single select dropdown styled as a button
    if (plantActionValid) {
        const plantSelect = document.createElement('select');
        plantSelect.className = 'plant-action-select';
        // First option: "Plant"
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Plant';
        plantSelect.appendChild(defaultOpt);
        // Add plant options
        Object.entries(config.plants.definitions).forEach(([plantKey, plantDef]) => {
            const opt = document.createElement('option');
            opt.value = plantKey;
            opt.textContent = (plantDef.label || plantKey).toLowerCase();
            plantSelect.appendChild(opt);
        });
        plantSelect.value = '';
        plantSelect.onchange = () => {
            const choice = plantSelect.value;
            if (!choice || !config.plants.definitions[choice]) {
                // reset select if invalid
                plantSelect.value = '';
                return;
            }
            // Perform the plant action logic
            console.group(`Action: plant`);
            console.log('Before:', JSON.stringify(tile));
            // Create a new tile object for the mutation
            const newTile = { ...tile };
            newTile.plantType = choice;
            newTile.growthStage = config.plants.definitions[choice].growthStages[0];
            newTile.growthProgress = 0;
            gameState.map[`${gameState.selector.x},${gameState.selector.y}`] = newTile;
            console.log('After:', JSON.stringify(newTile));
            console.groupEnd();
            // Use finalizeAction to DRY the update/highlight/save/time logic (simulate an actionDef)
            finalizeAction({ effect: { plantType: null, growthStage: null, growthProgress: 0 } }, config);
            // Reset select after planting
            plantSelect.value = '';
        };
        actionsEl.appendChild(plantSelect);
    }

    // Now iterate actions and render their buttons (handling "plant" specially)
    for (const [actionLabel, actionDef] of Object.entries(config.tiles.actions)) {
        const isValid = evaluateCondition(tile, actionDef.condition);
        // console.log(`Action "${actionLabel}" is`, isValid ? 'available' : 'not available', 'for tile:', tile);
        if (isValid) {
            if (actionLabel === "harvest" && tile.plantType && !config.plants.definitions[tile.plantType]?.harvestable) {
                continue; // skip harvest button for non-harvestable plants
            }
            if (actionLabel === "plant") {
                // "Plant" action is handled by the select above; do not render a button here.
                continue;
            } else {
                const btn = document.createElement('button');
                btn.textContent = actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1);
                btn.onclick = () => {
                    console.group(`Action: ${actionLabel}`);
                    console.log('Before:', JSON.stringify(tile));
                    // Apply effects with DRY helper
                    const newTile = applyActionEffects(tile, actionDef, config);
                    gameState.map[`${gameState.selector.x},${gameState.selector.y}`] = newTile;
                    console.log('After:', JSON.stringify(newTile));
                    console.groupEnd();
                    finalizeAction(actionDef, config);
                };
                actionsEl.appendChild(btn);
            }
        }
    }
}

export function updateTimePanel(config) {
    const el = document.getElementById('time-display');
    if (!el) return;
    const { hour, minute, week, seasonIndex } = gameState.time;
    const period = hour < 12 ? 'AM' : 'PM';
    const displayHour = ((hour - 1) % 12 + 1);
    const paddedMinute = minute.toString().padStart(2, '0');
    const season = config.seasons[seasonIndex];
    el.textContent = `${season} - WEEK ${week} - ${displayHour}:${paddedMinute} ${period}`;
}

function incrementTime(minutes, config) {
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

export { incrementTime };