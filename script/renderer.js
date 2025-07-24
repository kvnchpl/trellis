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

    // Preload images on first render
    if (!config._imageCache) {
        config._imageCache = preloadImages(config);
    }

    // Cache commonly used variables
    const cache = config._imageCache;
    const tileColors = config.tileColors;
    const fogColor = config.fogColor;

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

            // Always draw a tile, no boundaries
            const tile = getTile(mapX, mapY, config);
            drawTileOrColor(ctx, tile, config, cache, tileColors, screenX, screenY, tileSize);
            if (!gameState.revealed[`${mapX},${mapY}`]) {
                drawFog(ctx, fogColor, screenX, screenY, tileSize);
            }
        }
    }

    // Draw player (sprite preferred, fallback to colored square)
    const playerScreenX = Math.floor(viewSize / 2) * tileSize;
    const playerScreenY = Math.floor(viewSize / 2) * tileSize;
    if (config.playerImagePath && cache.player) {
        ctx.drawImage(cache.player, playerScreenX, playerScreenY, tileSize, tileSize);
    } else {
        ctx.fillStyle = config.playerColor;
        const sizeRatio = config.playerSize;
        const playerSizePx = tileSize * sizeRatio;
        const offset = (tileSize - playerSizePx) / 2;
        ctx.fillRect(playerScreenX + offset, playerScreenY + offset, playerSizePx, playerSizePx);
    }

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

/**
 * Preload all tile, plant, and player images and return a cache object.
 * @param {Object} config
 * @returns {Object} image cache
 */
function preloadImages(config) {
    const cache = {
        tiles: {},
        plants: {},
        player: null
    };

    // Tile images
    if (config.tileImagePaths) {
        for (const [tileType, path] of Object.entries(config.tileImagePaths)) {
            const img = new window.Image();
            img.src = path;
            cache.tiles[tileType] = img;
        }
    }

    // Plant images (arrays by index mapped to growthStages)
    if (config.plantImagePaths) {
        for (const [plantType, paths] of Object.entries(config.plantImagePaths)) {
            cache.plants[plantType] = [];
            paths.forEach((path, index) => {
                const img = new window.Image();
                img.src = path;
                cache.plants[plantType][index] = img;
            });
        }
    }

    // Player image
    if (config.playerImagePath) {
        const img = new window.Image();
        img.src = config.playerImagePath;
        cache.player = img;
    }
    return cache;
}

// --- Helper functions for drawing tiles and fog (DRY) ---
function drawTileOrColor(ctx, tile, config, cache, tileColors, x, y, size) {
    // Prefer plant sprite if present
    if (tile.plantType && cache.plants[tile.plantType]) {
        const stageIndex = config.plantDefinitions[tile.plantType].growthStages.indexOf(tile.growthStage);
        const stageImg = cache.plants[tile.plantType][stageIndex];
        if (stageImg) {
            ctx.drawImage(stageImg, x, y, size, size);
            return;
        }
    }
    // Otherwise draw tile sprite or fallback color
    if (tile.tile && cache.tiles[tile.tile]) {
        ctx.drawImage(cache.tiles[tile.tile], x, y, size, size);
    } else {
        const color = tileColors && tile.tile && tileColors[tile.tile]
            ? tileColors[tile.tile]
            : tileColors && tileColors.default;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, size, size);
    }
}

function drawFog(ctx, color, x, y, size) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
}