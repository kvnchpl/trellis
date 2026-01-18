export const gameState = {
    player: {
        x: 0,
        y: 0
    },
    map: {},
    revealed: {},
    selector: {
        x: 0,
        y: 0
    },
    time: {
        hour: 7,
        minute: 0,
        week: 1,
        seasonIndex: 0
    },
    dailyStats: {
        steps: 0,
        planted: 0,
        tilled: 0,
        watered: 0,
        fertilized: 0,
        harvested: 0
    }
};

/**
 * Initializes the game state.
 * @param {Object} config - Game configuration (expects mapWidth, mapHeight).
 */
export function initState(config) {
    const {
        mapWidth,
        mapHeight
    } = config;

    // Set up the map: now an empty object for lazy tile generation
    gameState.map = {};

    // Set up the revealed/fog state: now an object for fast lookup
    gameState.revealed = {};

    // Place player in the center of the map
    gameState.player = {
        x: Math.floor(mapWidth / 2),
        y: Math.floor(mapHeight / 2),
    };

    // Initialize selector position (default to player position)
    gameState.selector = {
        x: gameState.player.x,
        y: gameState.player.y
    };
    // Reset time to start of day/season
    gameState.time = {
        hour: 7,
        minute: 0,
        week: 1,
        seasonIndex: 0
    };

    // Force starting tile to "soil"
    const startingKey = `${gameState.player.x},${gameState.player.y}`;
    gameState.map[startingKey] = {
        tile: "soil",
        plantType: null,
        growthStage: null,
        growthProgress: 0,
        moisture: 0,
        fertility: 0,
        weeds: false,
        mulch: false,
        readyToHarvest: false,
        tileVariant: null,
        plantVariant: null
    };
}

function _weightedRandomTile(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    const rand = Math.random() * total;
    let acc = 0;
    for (const [tile, weight] of entries) {
        acc += weight;
        if (rand < acc) return tile;
    }
    return entries[entries.length - 1][0]; // fallback
}

/**
 * Lazily gets or generates a tile at (x, y) using config.initialTileWeights.
 * @param {number} x
 * @param {number} y
 * @param {Object} config - Game configuration.
 * @returns {Object} tile object
 */
export function getTile(x, y, config) {
    const key = `${x},${y}`;
    if (!gameState.map[key]) {
        gameState.map[key] = {
            tile: _weightedRandomTile(config.initialTileWeights),
            plantType: null,
            growthStage: null,
            growthProgress: 0,
            moisture: 0,
            fertility: 0,
            weeds: false,
            mulch: false,
            readyToHarvest: false,
            tileVariant: null,
            plantVariant: null
        };
    }
    return gameState.map[key];
}

export function advanceDay(config) {
    // Move to start hour next day
    gameState.time.hour = config.dayStartHour;
    gameState.time.minute = 0;
    gameState.time.week += 1;

    // Season rollover
    if (gameState.time.week > config.weeksPerSeason) {
        gameState.time.week = 1;
        gameState.time.seasonIndex = (gameState.time.seasonIndex + 1) % config.seasons.length;
    }
}

/**
 * Advances in-game time by the specified number of minutes.
 * @param {number} minutes
 * @param {Object} config
 */
export function advanceTime(minutes, config) {
    const time = gameState.time;
    time.minute += minutes;

    while (time.minute >= 60) {
        time.minute -= 60;
        time.hour++;
    }

    // End of day logic
    if (time.hour >= config.dayEndHour) {
        time.hour = config.dayEndHour;
        time.minute = 0;
    }

    // Weekly and seasonal rollover can stay here or in advanceDay if needed
    // e.g., if advancing weeks, call updateGrowth elsewhere
}

export function resetDailyStats() {
    gameState.dailyStats = {
        steps: 0,
        planted: 0,
        tilled: 0,
        watered: 0,
        fertilized: 0,
        harvested: 0
    };
}

export function attemptPlayerMove(player, dx, dy, config) {
    const newX = player.x + dx;
    const newY = player.y + dy;
    const targetTile = getTile(newX, newY, config);

    // Only allow movement if tile is walkable
    if (targetTile.tile !== 'rock' && !targetTile.plantType) {
        player.x = newX;
        player.y = newY;

        // Move selector with player
        gameState.selector = {
            x: player.x,
            y: player.y
        };

        // Increment steps
        gameState.dailyStats.steps++;

        // Return how much time should be advanced
        const movementCost = config.movementTimeIncrement || 1;
        return movementCost;
    }

    return 0; // No movement occurred
}

export function updateGrowth(config) {
    const changedTiles = [];

    for (const [key, tile] of Object.entries(gameState.map)) {
        if (!tile.plantType) continue;
        const def = config.plants.definitions[tile.plantType];
        if (!def) continue;

        tile.growthProgress++;
        if (tile.growthProgress >= def.growthTime) {
            const idx = def.growthStages.indexOf(tile.growthStage);
            if (idx < def.growthStages.length - 1) {
                tile.growthStage = def.growthStages[idx + 1];
                tile.growthProgress = 0;
                changedTiles.push(key);
                if (def.harvestable && tile.growthStage === def.growthStages[def.growthStages.length - 1]) {
                    tile.readyToHarvest = true;
                }
            }
        }
        tile.moisture = Math.max(0, tile.moisture - def.moistureUse);
        tile.fertility = Math.max(0, tile.fertility - def.fertilityUse);
    }

    return changedTiles;
}

export function saveGameState(config) {
    function defaultTile() {
        return {
            tile: null,
            plantType: null,
            growthStage: null,
            growthProgress: 0,
            moisture: 0,
            fertility: 0,
            weeds: false,
            mulch: false,
            readyToHarvest: false,
            tileVariant: null,
            plantVariant: null
        };
    }

    const optimizedMap = {};
    const def = defaultTile();

    for (const [key, tile] of Object.entries(gameState.map)) {
        if (Object.keys(def).some(k => tile[k] !== def[k] && tile[k] !== undefined)) {
            optimizedMap[key] = tile;
        }
    }

    const saveData = {
        player: gameState.player,
        selector: gameState.selector,
        map: optimizedMap,
        revealed: gameState.revealed,
        time: gameState.time
    };

    localStorage.setItem("trellisSave", JSON.stringify(saveData));

    // Return size so UI can update display
    const sizeInBytes = new Blob([JSON.stringify(saveData)]).size;
    return sizeInBytes;
}