

// Basic game state manager for Trellis

export const gameState = {
    player: { x: 0, y: 0 },
    map: [],
    revealed: [],
    selector: { x: 0, y: 0 }
};

/**
 * Initializes the game state.
 * @param {Object} config - Game configuration (expects mapWidth, mapHeight).
 */
export function initState(config) {
    const { mapWidth, mapHeight } = config;

    // Set up the map: 2D array of tiles, each with a type and optional plant
    gameState.map = Array.from({ length: mapHeight }, () =>
        Array.from({ length: mapWidth }, () => ({
            tile: config.defaultTile,
            plant: null,
        }))
    );

    // Set up the revealed/fog state: 2D array of booleans
    gameState.revealed = Array.from({ length: mapHeight }, () =>
        Array.from({ length: mapWidth }, () => false)
    );

    // Place player in the center of the map
    gameState.player = {
        x: Math.floor(mapWidth / 2),
        y: Math.floor(mapHeight / 2),
    };

    // Initialize selector position (default to player position)
    gameState.selector = {
        x: gameState.player.x,
        y: gameState.player.y - 1 // default to "up" tile
    };
}