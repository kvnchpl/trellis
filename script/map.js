import { gameState, getTile } from './state.js';

/**
 * Generates the map terrain.
 * Placeholder implementation: does nothing, as map is generated in initState.
 * Future expansion: could generate biomes, terrain, or load maps.
 * @param {Object} config - Game configuration.
 */
export function generateMap(config) {
    // Map is currently generated in initState.
    // Placeholder for future biome or terrain generation.
}

/**
 * Updates the fog of war, revealing tiles around the player.
 * @param {Object} config - Game configuration (expects mapWidth, mapHeight, fogRevealRadius).
 */
export function updateFog(config) {
    const { fogRevealRadius } = config;
    const { player } = gameState;

    for (let dy = -fogRevealRadius; dy <= fogRevealRadius; dy++) {
        for (let dx = -fogRevealRadius; dx <= fogRevealRadius; dx++) {
            const nx = player.x + dx;
            const ny = player.y + dy;
            const key = `${nx},${ny}`;
            getTile(nx, ny, config); // lazily generate tile if needed
            gameState.revealed[key] = true;
        }
    }
}