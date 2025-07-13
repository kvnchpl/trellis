import { gameState, getTile } from './state.js';

/**
 * Renders the game viewport centered on the player, with fog of war and placeholder tiles.
 * @param {Object} config - Game configuration (expects tileSize, mapWidth, mapHeight).
 */
export function render(config) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const tileSize = config.tileSize;
    // Use config.viewTileCount if present, else fallback to canvas size
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
                // Draw tile using config.tileColors
                const tile = getTile(mapX, mapY, config);
                let tileColor = config.tileColors && tile && tile.tile && config.tileColors[tile.tile]
                    ? config.tileColors[tile.tile]
                    : config.tileColors && config.tileColors.default;
                ctx.fillStyle = tileColor;
                ctx.fillRect(screenX, screenY, tileSize, tileSize);

                // Apply fog of war if not revealed
                if (!gameState.revealed[`${mapX},${mapY}`]) {
                    ctx.fillStyle = config.fogColor;
                    ctx.fillRect(screenX, screenY, tileSize, tileSize);
                }
            } else {
                // Out-of-bounds: draw dark background
                ctx.fillStyle = config.outOfBoundsColor;
                ctx.fillRect(screenX, screenY, tileSize, tileSize);
            }
        }
    }

    // Draw player as a colored square in the center of the viewport
    const playerScreenX = Math.floor(viewSize / 2) * tileSize;
    const playerScreenY = Math.floor(viewSize / 2) * tileSize;
    ctx.fillStyle = config.playerColor;
    const sizeRatio = config.playerSize;
    const playerSizePx = tileSize * sizeRatio;
    const offset = (tileSize - playerSizePx) / 2;
    ctx.fillRect(playerScreenX + offset, playerScreenY + offset, playerSizePx, playerSizePx);

    // Draw selector
    const selectorOffsetX = gameState.selector.x - startX;
    const selectorOffsetY = gameState.selector.y - startY;

    if (
        selectorOffsetX >= 0 && selectorOffsetX < viewSize &&
        selectorOffsetY >= 0 && selectorOffsetY < viewSize
    ) {
        const selectorX = selectorOffsetX * tileSize;
        const selectorY = selectorOffsetY * tileSize;
        ctx.strokeStyle = config.selectorColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(selectorX + 1, selectorY + 1, tileSize - 2, tileSize - 2);
    }
}