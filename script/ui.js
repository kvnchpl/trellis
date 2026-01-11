import { gameState, getTile } from './state.js';
import { saveGameState } from './game.js';
import { render } from './renderer.js';

let lastGrowthUpdateWeek = null;

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

function getFailedConditions(tile, condObj) {
    const failed = [];

    if (condObj.or && Array.isArray(condObj.or)) {
        const passed = condObj.or.some(c => evaluateCondition(tile, c));
        if (!passed) failed.push(`One of: ${condObj.or.map(c => JSON.stringify(c)).join(', ')}`);
        return failed;
    }

    Object.entries(condObj).forEach(([key, cond]) => {
        const current = tile[key];
        if (cond === 'exists') {
            if (current === null || current === undefined) failed.push(`${key} must exist`);
        } else if (typeof cond === 'object' && cond !== null) {
            if ('not' in cond && current === cond.not) failed.push(`${key} must not be ${cond.not}`);
            if ('lt' in cond && !(current < cond.lt)) failed.push(`${key} must be less than ${cond.lt}`);
            if ('gt' in cond && !(current > cond.gt)) failed.push(`${key} must be greater than ${cond.gt}`);
            if ('lte' in cond && !(current <= cond.lte)) failed.push(`${key} must be ≤ ${cond.lte}`);
            if ('gte' in cond && !(current >= cond.gte)) failed.push(`${key} must be ≥ ${cond.gte}`);
        } else {
            if (current !== cond) failed.push(`${key} must be ${cond}`);
        }
    });

    return failed;
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
        // Always render plant select
        const plantSelect = document.createElement('select');
        plantSelect.className = 'plant-action-select';

        // Determine if planting is valid
        let plantActionValid = evaluateCondition(tile, config.tiles.actions.plant.condition);
        if (tile.plantType) plantActionValid = false; // cannot plant if tile already has a plant

        // Apply visual and functional disabled state
        plantSelect.classList.toggle('disabled', !plantActionValid);
        plantSelect.disabled = !plantActionValid;

        // First option: "Plant"
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'plant';
        plantSelect.appendChild(defaultOpt);

        // Add all plant options
        Object.entries(config.plants.definitions).forEach(([plantKey, plantDef]) => {
            const opt = document.createElement('option');
            opt.value = plantKey;
            opt.textContent = (plantDef.label || plantKey).toLowerCase();
            plantSelect.appendChild(opt);
        });
        plantSelect.value = '';

        // Handle selection
        plantSelect.onchange = () => {
            if (!plantActionValid) {
                const failed = getFailedConditions(tile, config.tiles.actions.plant.condition);
                const message = failed.length
                    ? `Cannot perform "plant" on this tile.\nReason(s):\n- ${failed.join('\n- ')}`
                    : `Cannot perform "plant" on this tile.`;
                alert(message);
                console.log('Plant action blocked on tile:', tile, 'Failed conditions:', failed);
                plantSelect.value = '';
                return;
            }

            const choice = plantSelect.value;
            if (!choice || !config.plants.definitions[choice]) {
                plantSelect.value = '';
                return;
            }

            console.group(`Action: plant`);
            console.log('Before:', JSON.stringify(tile));
            const newTile = { ...tile };
            newTile.plantType = choice;
            newTile.growthStage = config.plants.definitions[choice].growthStages[0];
            newTile.growthProgress = 0;
            gameState.map[`${gameState.selector.x},${gameState.selector.y}`] = newTile;
            console.log('After:', JSON.stringify(newTile));
            console.groupEnd();
            finalizeAction({ effect: { plantType: null, growthStage: null, growthProgress: 0 } }, config);
            plantSelect.value = '';
        };

        // Append to actions container
        actionsEl.appendChild(plantSelect);
    }

    // Now iterate actions and render their buttons (handling "plant" specially)
    for (const [actionLabel, actionDef] of Object.entries(config.tiles.actions)) {
        if (actionLabel === "plant") {
            // skip plant here since it's handled by the select dropdown above
            continue;
        }
        const isValid = evaluateCondition(tile, actionDef.condition);
        // Always render a button for every action except "plant"
        // Optionally skip harvest for non-harvestable plants (keep old logic)
        if (actionLabel === "harvest" && tile.plantType && !config.plants.definitions[tile.plantType]?.harvestable) {
            continue;
        }

        const btn = document.createElement('button');
        btn.textContent = actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1);

        // Apply visual "disabled" class if invalid
        if (!isValid) btn.classList.add('disabled');

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Fetch the current tile at the time of click
            const currentTile = getTile(gameState.selector.x, gameState.selector.y, config);

            // Evaluate whether the action is valid now
            const validNow = evaluateCondition(currentTile, actionDef.condition);

            if (!validNow) {
                // Determine which conditions failed and make them human-readable
                const failed = getFailedConditions(currentTile, actionDef.condition);
                const message = failed.length
                    ? `Cannot perform "${actionLabel}" on this tile.\nReason(s):\n- ${failed.join('\n- ')}`
                    : `Cannot perform "${actionLabel}" on this tile.`;

                // Show alert to player
                alert(message);

                // Log to console for debugging
                console.log(`Action "${actionLabel}" blocked on tile:`, currentTile, "Failed conditions:", failed);
                return;
            }

            // Apply the action normally
            const newTile = applyActionEffects(currentTile, actionDef, config);
            gameState.map[`${gameState.selector.x},${gameState.selector.y}`] = newTile;

            // Finalize updates: info panel, save, time, render
            finalizeAction(actionDef, config);
        };
        actionsEl.appendChild(btn);
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