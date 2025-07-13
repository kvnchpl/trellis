

import { gameState } from './state.js';

/**
 * Renders the game viewport centered on the player, with fog of war and placeholder tiles.
 * @param {Object} config - Game configuration (expects tileSize, mapWidth, mapHeight).
 */
export function render(config) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const tileSize = config.tileSize;
    // Determine how many tiles fit in the viewport (assume square viewport)
    const viewSize = Math.floor(canvas.width / tileSize);

    // Calculate top-left tile of the viewport so the player is centered
    const startX = gameState.player.x - Math.floor(viewSize / 2);
    const startY = gameState.player.y - Math.floor(viewSize / 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < viewSize; y++) {
        for (let x = 0; x < viewSize; x++) {
            const mapX = startX + x;
            const mapY = startY + y;
            const screenX = x * tileSize;
            const screenY = y * tileSize;

            // Draw in-bounds tile or out-of-bounds
            if (
                mapX >= 0 && mapX < config.mapWidth &&
                mapY >= 0 && mapY < config.mapHeight
            ) {
                // Placeholder: draw soil tile or fallback color
                const tile = gameState.map[mapY][mapX];
                ctx.fillStyle = tile && tile.tile === 'soil' ? '#4B6F44' : '#333';
                ctx.fillRect(screenX, screenY, tileSize, tileSize);

                // Apply fog of war if not revealed
                if (!gameState.revealed[mapY][mapX]) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.fillRect(screenX, screenY, tileSize, tileSize);
                }
            } else {
                // Out-of-bounds: draw dark background
                ctx.fillStyle = '#111';
                ctx.fillRect(screenX, screenY, tileSize, tileSize);
            }
        }
    }

    // Draw player as a yellow square in the center of the viewport
    const playerScreenX = Math.floor(viewSize / 2) * tileSize;
    const playerScreenY = Math.floor(viewSize / 2) * tileSize;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(playerScreenX, playerScreenY, tileSize, tileSize);
}