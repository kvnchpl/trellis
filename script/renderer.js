import { gameState, getTile } from './state.js';

export function drawPlayer(ctx, player, startX, startY, tileSize, config) {
    const playerScreenX = (player.x - startX) * tileSize;
    const playerScreenY = (player.y - startY) * tileSize;
    const playerSizePx = tileSize * (config.playerSize || 1);
    const offset = (tileSize - playerSizePx) / 2;

    if (config._imageCache?.player) {
        ctx.drawImage(
            config._imageCache.player,
            playerScreenX + offset,
            playerScreenY + offset,
            playerSizePx,
            playerSizePx
        );
    } else {
        ctx.fillStyle = config.playerColor;
        ctx.fillRect(playerScreenX + offset, playerScreenY + offset, playerSizePx, playerSizePx);
    }
}

export function drawSelector(ctx, selector, startX, startY, tileSize, config) {
    const selectorScreenX = (selector.x - startX) * tileSize;
    const selectorScreenY = (selector.y - startY) * tileSize;

    ctx.strokeStyle = config.selectorColor || '#00FFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(selectorScreenX + 1, selectorScreenY + 1, tileSize - 2, tileSize - 2);
}

/**
 * Renders the game viewport centered on the player, with fog of war and placeholder tiles.
 * @param {Object} config - Game configuration (expects tileSize, mapWidth, mapHeight).
 */
export function render(config) {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    const { mapWidth, mapHeight } = config;
    const { player, selector, revealed } = gameState;

    const viewportSize = 7; // 7x7 visible tiles
    const paddingRatio = 0.125; // 12.5% padding on each side, total ~75% map coverage

    const usableWidth = canvas.width * (1 - paddingRatio * 2);
    const usableHeight = canvas.height * (1 - paddingRatio * 2);
    const tileSize = Math.floor(Math.min(usableWidth / viewportSize, usableHeight / viewportSize));

    const halfViewport = Math.floor(viewportSize / 2);
    let startX = player.x - halfViewport;
    let startY = player.y - halfViewport;

    // Clamp to map bounds
    startX = Math.max(0, Math.min(startX, mapWidth - viewportSize));
    startY = Math.max(0, Math.min(startY, mapHeight - viewportSize));

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Offset for centering viewport in canvas
    const offsetX = Math.floor((canvas.width - tileSize * viewportSize) / 2);
    const offsetY = Math.floor((canvas.height - tileSize * viewportSize) / 2);

    for (let y = 0; y < viewportSize; y++) {
        for (let x = 0; x < viewportSize; x++) {
            const mapX = startX + x;
            const mapY = startY + y;

            const tile = getTile(mapX, mapY, config);
            const isRevealed = revealed[`${mapX},${mapY}`];

            drawTileOrColor(
                ctx,
                tile,
                isRevealed,
                offsetX + x * tileSize,
                offsetY + y * tileSize,
                tileSize,
                config._imageCache,
                config
            );
        }
    }

    // Draw player and selector relative to viewport
    drawPlayer(ctx, player, startX, startY, tileSize, config);
    drawSelector(ctx, selector, startX, startY, tileSize, config);
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
function drawTileOrColor(ctx, tile, revealed, x, y, size, cache, config) {
    if (!revealed) {
        ctx.fillStyle = config.fogColor;
        ctx.fillRect(x, y, size, size);
        return;
    }

    // Prefer plant sprite if present
    if (tile.plantType && cache?.plants?.[tile.plantType]) {
        const def = config.plants.definitions[tile.plantType];
        const stageIndex = def.growthStages.indexOf(tile.growthStage);
        const stageImg = cache.plants[tile.plantType][stageIndex];
        if (stageImg) {
            ctx.drawImage(stageImg, x, y, size, size);
            return;
        }
    }

    // Otherwise draw tile sprite or fallback color
    if (tile.tile && cache?.tiles?.[tile.tile]) {
        ctx.drawImage(cache.tiles[tile.tile], x, y, size, size);
    } else {
        const color =
            config.tiles.colors[tile.tile] ??
            config.tiles.colors.default;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, size, size);
    }
}

function drawFog(ctx, color, x, y, size) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
}