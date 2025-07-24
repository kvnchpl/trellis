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
                // Draw tile using config.tileColors or images
                const tile = getTile(mapX, mapY, config);
                let drawn = false;
                // Prefer plant sprite if plantType present
                if (tile.plantType && config._imageCache.plants[tile.plantType]) {
                    const stageIndex = config.plantDefinitions[tile.plantType].growthStages.indexOf(tile.growthStage);
                    const stageImg = config._imageCache.plants[tile.plantType][stageIndex];
                    if (stageImg) {
                        ctx.drawImage(stageImg, screenX, screenY, tileSize, tileSize);
                        drawn = true;
                    }
                }
                // Otherwise draw tile sprite if available
                if (!drawn) {
                    if (tile.tile && config._imageCache.tiles[tile.tile]) {
                        ctx.drawImage(config._imageCache.tiles[tile.tile], screenX, screenY, tileSize, tileSize);
                        drawn = true;
                    } else {
                        let tileColor = config.tileColors && tile && tile.tile && config.tileColors[tile.tile]
                            ? config.tileColors[tile.tile]
                            : config.tileColors && config.tileColors.default;
                        ctx.fillStyle = tileColor;
                        ctx.fillRect(screenX, screenY, tileSize, tileSize);
                    }
                }

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

    // Draw player (sprite preferred, fallback to colored square)
    const playerScreenX = Math.floor(viewSize / 2) * tileSize;
    const playerScreenY = Math.floor(viewSize / 2) * tileSize;
    if (config.playerImagePath && config._imageCache.player) {
        ctx.drawImage(config._imageCache.player, playerScreenX, playerScreenY, tileSize, tileSize);
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