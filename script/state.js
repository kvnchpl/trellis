export const gameState = {
    player: { x: 0, y: 0 },
    map: {},
    revealed: {},
    selector: { x: 0, y: 0 },
    time: {
        hour: 7,
        minute: 0,
        week: 1,
        seasonIndex: 0
    }
};

/**
 * Initializes the game state.
 * @param {Object} config - Game configuration (expects mapWidth, mapHeight).
 */
export function initState(config) {
    const { mapWidth, mapHeight } = config;

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
        fertilized: false
    };
}

function weightedRandomTile(weights) {
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
            tile: weightedRandomTile(config.initialTileWeights),
            plantType: null,
            growthStage: null,
            growthProgress: 0,
            moisture: 0,
            fertility: 0,
            weeds: false,
            mulch: false,
            readyToHarvest: false,
            fertilized: false
        };
    }
    return gameState.map[key];
}