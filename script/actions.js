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
 * Applies the effects of an action to a tile and returns the new tile object.
 * @param {Object} tile - The current tile object.
 * @param {Object} actionDef - The action definition.
 * @param {Object} config - Game configuration.
 * @returns {Object} The new tile object after applying effects.
 */
export function applyActionEffects(tile, actionDef, config) {
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
 * Returns human-readable messages explaining why an action is blocked on a tile.
 * Fully maps condition keys to per-action blocked messages dynamically.
 * Supports OR conditions, lt/gt/not, booleans, and tile-specific messages.
 * @param {Object} tile - The tile object.
 * @param {Object} actionDef - The action definition.
 * @param {Object} strings - Loaded strings.json
 * @returns {string[]} Array of human-readable messages
 */
export function getBlockedActionMessages(tile, actionDef, strings) {
    if (!tile || !actionDef || !strings?.messages?.blockedAction) return [];

    const actionName = actionDef.name;
    const blockedStrings = strings.messages.blockedAction[actionName] || {};
    const keyMap = strings.conditionKeyMap || {};
    const blockedKeyMap = strings.blockedKeyMap || {};

    function collectFailedConditions(tile, condition) {
        if (!condition) return [];

        // OR condition: fail only if all subconditions fail
        if (condition.or && Array.isArray(condition.or)) {
            const subFailed = condition.or.map(sub => collectFailedConditions(tile, sub));
            if (subFailed.every(f => f.length > 0)) return subFailed.flat();
            return [];
        }

        const failed = [];
        for (const [key, val] of Object.entries(condition)) {
            const tileVal = tile[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                if ('lt' in val && !(tileVal < val.lt)) failed.push({ key, type: 'lt' });
                else if ('gt' in val && !(tileVal > val.gt)) failed.push({ key, type: 'gt' });
                else if ('not' in val && tileVal === val.not) failed.push({ key, type: 'not' });
                else failed.push(...collectFailedConditions(tileVal, val));
            } else if (tileVal !== val) {
                failed.push({ key, value: val });
            }
        }
        return failed;
    }

    const failedConditions = collectFailedConditions(tile, actionDef.condition);

    const actionKeyMap = blockedKeyMap[actionName] || {};

    // First pass: collect explicit per-action blocked reasons
    const explicitBlockedMessages = failedConditions
        .map(f => {
            const mapVal = actionKeyMap[f.key];
            if (typeof mapVal === 'string') return blockedStrings[mapVal];
            if (mapVal && typeof mapVal === 'object') {
                const tileValue = tile[f.key];
                if (tileValue !== undefined && mapVal[tileValue]) {
                    return blockedStrings[mapVal[tileValue]];
                }
            }
            return null;
        })
        .filter(Boolean);

    if (explicitBlockedMessages.length > 0) {
        return [...new Set(explicitBlockedMessages)];
    }

    const fallbackBlockedMessages = failedConditions.map(f => {
        // Then try conditionKeyMap
        if (f.type && keyMap[f.key]?.[f.type]) return keyMap[f.key][f.type];
        if (f.value !== undefined && keyMap[f.key]?.[f.value] !== undefined) return keyMap[f.key][f.value];

        // Last fallback: dev warning
        console.warn(`Unmapped blocked condition for action '${actionName}':`, f);
        return null;
    }).filter(Boolean);

    return [...new Set(fallbackBlockedMessages)]; // remove duplicates and falsy
}

/**
 * Attempts to perform an action on a tile, returning success status and messages.
 * @param {Object} tile - The tile object.
 * @param {string} actionLabel - The action label (e.g., 'till', 'plant').
 * @param {Object} config - Game configuration.
 * @param {Object} strings - Loaded strings.json
 * @param {Object} dailyStats - Object to track daily stats (optional).
 * @returns {Object} Result object with success boolean and optional messages or plantModal.
 */
export function attemptActionOnTile(tile, actionLabel, config, strings, dailyStats) {
    const actionDef = config.tiles.actions[actionLabel];
    if (!actionDef) return false;

    const valid = evaluateCondition(tile, actionDef.condition);
    if (!valid) {
        const failedReasons = getBlockedActionMessages(tile, { ...actionDef, name: actionLabel }, strings);
        return {
            success: false,
            message: failedReasons.length > 0 ? failedReasons : "The tile does not meet the requirements for this action."
        };
    }

    if (actionLabel === 'plant') {
        return {
            success: true,
            plantModal: { tile, x: tile.x, y: tile.y } // delegate to UI to show modal
        };
    }

    const newTile = applyActionEffects(tile, actionDef, config);
    Object.assign(tile, newTile); // update tile in place

    // Increment daily stats
    if (dailyStats) {
        if (actionLabel === 'till') dailyStats.tilled++;
        if (actionLabel === 'water') dailyStats.watered++;
        if (actionLabel === 'fertilize') dailyStats.fertilized++;
        if (actionLabel === 'harvest') dailyStats.harvested++;
    }

    return { success: true };
}
