import { gameState, getTile } from './state.js';

/**
 * Renders the game viewport centered on the player, with fog of war and placeholder tiles.
 * @param {Object} config - Game configuration (expects tileSize, mapWidth, mapHeight).
 */
export function render(config) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const tileSize = config.tileSize || config.tiles.size;

    // Determine view size based on canvas resolution
    const viewSizeX = Math.floor(canvas.width / tileSize);
    const viewSizeY = Math.floor(canvas.height / tileSize);

    // Preload images on first render
    if (!config._imageCache) {
        config._imageCache = preloadImages(config);
    }

    const cache = config._imageCache;
    const tileColors = config.tiles.colors;
    const fogColor = config.fogColor;

    // Top-left tile of viewport so player is centered
    const startX = gameState.player.x - Math.floor(viewSizeX / 2);
    const startY = gameState.player.y - Math.floor(viewSizeY / 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    for (let y = 0; y < viewSizeY; y++) {
        for (let x = 0; x < viewSizeX; x++) {
            const mapX = startX + x;
            const mapY = startY + y;
            const screenX = x * tileSize;
            const screenY = y * tileSize;

            const tile = getTile(mapX, mapY, config);
            drawTileOrColor(ctx, tile, config, cache, tileColors, screenX, screenY, tileSize);

            if (!gameState.revealed[`${mapX},${mapY}`]) {
                drawFog(ctx, fogColor, screenX, screenY, tileSize);
            }
        }
    }

    // Draw selector
    const selectorOffsetX = gameState.selector.x - startX;
    const selectorOffsetY = gameState.selector.y - startY;

    if (
        selectorOffsetX >= 0 && selectorOffsetX < viewSizeX &&
        selectorOffsetY >= 0 && selectorOffsetY < viewSizeY
    ) {
        const selectorX = selectorOffsetX * tileSize;
        const selectorY = selectorOffsetY * tileSize;
        ctx.strokeStyle = config.selectorColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(selectorX + 1, selectorY + 1, tileSize - 2, tileSize - 2);
    }

    // Draw player centered in viewport
    const playerScreenX = Math.floor(viewSizeX / 2) * tileSize;
    const playerScreenY = Math.floor(viewSizeY / 2) * tileSize;
    const playerSizePx = tileSize * (config.playerSize || 1);
    const offset = (tileSize - playerSizePx) / 2;

    if (config.playerImagePath && cache.player) {
        ctx.drawImage(cache.player, playerScreenX + offset, playerScreenY + offset, playerSizePx, playerSizePx);
    } else {
        ctx.fillStyle = config.playerColor;
        ctx.fillRect(playerScreenX + offset, playerScreenY + offset, playerSizePx, playerSizePx);
    }
}

/**
 * Preload all tile, plant, and player images and return a cache object.
 * @param {Object} config
 * @returns {Object} image cache
 */
export function preloadImages(config) {
    const cache = { tiles: {}, plants: {}, player: null };
    const promises = [];

    // Tile images
    if (config.tiles.images) {
        for (const [tileType, path] of Object.entries(config.tiles.images)) {
            const img = new Image();
            img.src = path;
            cache.tiles[tileType] = img;
            promises.push(new Promise(res => img.onload = res));
        }
    }

    // Plant images
    if (config.plants.images) {
        for (const [plantType, paths] of Object.entries(config.plants.images)) {
            cache.plants[plantType] = [];
            paths.forEach((path, index) => {
                const img = new Image();
                img.src = path;
                cache.plants[plantType][index] = img;
                promises.push(new Promise(res => img.onload = res));
            });
        }
    }

    // Player image
    if (config.playerImagePath) {
        const img = new Image();
        img.src = config.playerImagePath;
        cache.player = img;
        promises.push(new Promise(res => img.onload = res));
    }

    config._imageCache = cache;

    return Promise.all(promises);
}

// --- Helper functions for drawing tiles and fog (DRY) ---
function drawTileOrColor(ctx, tile, config, cache, tileColors, x, y, size) {
    // Prefer plant sprite if present
    if (tile.plantType && cache.plants[tile.plantType]) {
        const stageIndex = config.plants.definitions[tile.plantType].growthStages.indexOf(tile.growthStage);
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