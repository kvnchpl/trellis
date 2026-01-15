import {
    updateSaveSizeDisplay
} from './game.js';

import {
    gameState,
    getTile
} from './state.js';

import {
    updateTileInfoPanel,
    updateTimePanel
} from './ui.js';

let lastSelectorKey = null;
let lastPlayerKey = null;

let lastSaveSizeUpdate = 0;

/**
 * Draws a tile or its color at the given position.
 * @param {CanvasRenderingContext2D} ctx - The canvas context.
 * @param {Object} tile - The tile object.
 * @param {number} x - X position in pixels.
 * @param {number} y - Y position in pixels.
 * @param {number} size - Size of the tile in pixels.
 * @param {Object} config - Game configuration.
 */
function drawTileOrColor(ctx, tile, x, y, size, config) {
    const cache = config._imageCache;

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

function updateTileInfoPanelIfChanged(config) {
    const currentKey = `${gameState.selector.x},${gameState.selector.y}`;
    if (currentKey !== lastSelectorKey) {
        updateTileInfoPanel(config);
        lastSelectorKey = currentKey;
    }
}

function maybeUpdateSaveSizeDisplay() {
    const now = performance.now();
    if (now - lastSaveSizeUpdate > 2000) { // update every 2 seconds
        updateSaveSizeDisplay();
        lastSaveSizeUpdate = now;
    }
}

function refreshUI(config) {
    updateTimePanel(config);
    updateTileInfoPanelIfChanged(config);
    maybeUpdateSaveSizeDisplay();
}

/**
 * Draws the player on the canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas context.
 * @param {Object} player - The player object.
 * @param {number} startX - The camera's top-left tile x.
 * @param {number} startY - The camera's top-left tile y.
 * @param {number} tileSize - Size of each tile in pixels.
 * @param {Object} config - Game configuration.
 */
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

/**
 * Draws the selector box on the canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas context.
 * @param {Object} selector - The selector object.
 * @param {number} startX - The camera's top-left tile x.
 * @param {number} startY - The camera's top-left tile y.
 * @param {number} tileSize - Size of each tile in pixels.
 * @param {Object} config - Game configuration.
 */
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

    const tileSize = config.tileSize;
    const VIEWPORT_TILES = config.viewport.tiles;
    const HALF = Math.floor(VIEWPORT_TILES / 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const camX = gameState.player.x - HALF;
    const camY = gameState.player.y - HALF;

    for (let sy = 0; sy < VIEWPORT_TILES; sy++) {
        for (let sx = 0; sx < VIEWPORT_TILES; sx++) {

            const wx = camX + sx;
            const wy = camY + sy;

            const px = sx * tileSize;
            const py = sy * tileSize;

            const key = `${wx},${wy}`;
            const revealed = gameState.revealed[key];

            if (!revealed) {
                ctx.fillStyle = config.fog.color;
                ctx.globalAlpha = config.fog.opacity;
                ctx.fillRect(px, py, tileSize, tileSize);
                ctx.globalAlpha = 1;
                continue;
            }

            const tile = getTile(wx, wy, config);
            drawTileOrColor(ctx, tile, px, py, tileSize, config);
        }
    }

    drawPlayer(ctx, gameState.player, camX, camY, tileSize, config);
    drawSelector(ctx, gameState.selector, camX, camY, tileSize, config);
}

export function refreshScreenIfChanged(config) {
    const currentPlayerKey = `${gameState.player.x},${gameState.player.y}`;
    if (currentPlayerKey !== lastPlayerKey) {
        updateFog(config);
        render(config);
        lastPlayerKey = currentPlayerKey;
    }
    refreshUI(config);
}

/**
 * Updates the fog of war, revealing tiles around the player.
 * @param {Object} config - Game configuration (expects mapWidth, mapHeight, fogRevealRadius).
 */
export function updateFog(config) {
    const fogRevealRadius = config.viewport.initialRevealRadius;
    const {
        player
    } = gameState;

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

/**
 * Preloads all tile, plant, and player images and returns a cache object.
 * @param {Object} config - Game configuration.
 * @returns {Promise<Object>} Resolves to the image cache.
 */
export function preloadImages(config) {
    const cache = {
        tiles: {},
        plants: {},
        player: null
    };
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

export function resizeCanvasAndTiles(config) {
    const canvas = document.getElementById('game-canvas');
    const container = document.getElementById('game-container');
    const infoPanel = document.getElementById('info-panel');

    if (!canvas || !container || !infoPanel) return;

    const containerRect = container.getBoundingClientRect();
    const infoPanelRect = infoPanel.getBoundingClientRect();

    const padding = 16;
    const availableWidth = containerRect.width - infoPanelRect.width - padding;
    const availableHeight = containerRect.height - padding;

    const viewportTiles = config.viewport.tiles;

    // Compute tile size in CSS pixels to fit viewport
    const tileSize = Math.floor(Math.min(availableWidth / viewportTiles, availableHeight / viewportTiles));

    // Device Pixel Ratio for high-DPI
    const dpr = window.devicePixelRatio || 1;

    // Set canvas internal resolution
    canvas.width = tileSize * viewportTiles * dpr;
    canvas.height = tileSize * viewportTiles * dpr;

    // Set CSS size (remains same as original pixel dimensions)
    canvas.style.width = `${tileSize * viewportTiles}px`;
    canvas.style.height = `${tileSize * viewportTiles}px`;

    // Scale the drawing context for DPR
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Store tile size in config (CSS pixels)
    config.tileSize = tileSize;
}
