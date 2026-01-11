import { initPlayer, updatePlayer } from './player.js';
import { generateMap, updateFog } from './map.js';
import { gameState, initState, getTile } from './state.js';
import { render } from './renderer.js';
import { updateTileInfoPanel, updateTimePanel } from './ui.js';

const configUrl = 'config.json';
let config;

// --- Performance/throttling tracking variables ---
let lastSelectorKey = null;
let lastSaveSizeUpdate = 0;
let lastPlayerKey = null;

async function loadConfig() {
    try {
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error('Failed to load config');
        config = await response.json();
        return config;
    } catch (error) {
        console.error('Error loading config:', error);
        throw error;
    }
}

function saveGameState() {
    function defaultTile(config) {
        return {
            tile: null,
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

    const optimizedMap = {};
    const def = defaultTile(config);

    for (const [key, tile] of Object.entries(gameState.map)) {
        if (Object.keys(def).some(k => tile[k] !== def[k] && tile[k] !== undefined)) {
            optimizedMap[key] = tile;
        }
    }

    localStorage.setItem("trellisSave", JSON.stringify({
        player: gameState.player,
        selector: gameState.selector,
        map: optimizedMap,
        revealed: gameState.revealed,
        time: gameState.time
    }));

    console.log(`Game saved. Tiles stored: ${Object.keys(optimizedMap).length}`);
    updateSaveSizeDisplay();
}

function loadGameState() {
    const saved = localStorage.getItem("trellisSave");
    if (!saved) return false;
    try {
        const data = JSON.parse(saved);
        gameState.player = data.player;
        gameState.selector = data.selector;
        gameState.map = data.map;
        gameState.revealed = data.revealed;
        gameState.time = data.time;
        console.log("Game loaded.");
        return true;
    } catch (e) {
        console.warn("Corrupted save data. Starting new game.");
        return false;
    }
}

function startNewGame() {
    if (localStorage.getItem("trellisSave")) {
        const confirmNew = confirm("start a new game? this will overwrite your current progress.");
        if (!confirmNew) return;
    }
    localStorage.removeItem("trellisSave");
    initState(config);
    generateMap(config);
    initPlayer(config);
    updateFog(config);
    updateTimePanel(config);
    render(config);
    updateTileInfoPanel(config);
    saveGameState();
    console.log("Started a new game.");
}

async function initGame(loadExisting = true) {
    await loadConfig();
    const canvas = document.getElementById('game-canvas');
    canvas.width = config.canvasWidth;
    canvas.height = config.canvasHeight;

    if (loadExisting && loadGameState()) {
        console.log("Loaded game from localStorage.");
        console.log("DEBUG: after loadGameState", {
            player: gameState.player,
            selector: gameState.selector,
            revealedKeys: Object.keys(gameState.revealed || {}).length
        });
        updateFog(config);
        console.log("DEBUG: after updateFog", {
            revealedKeys: Object.keys(gameState.revealed || {}).length
        });

        // Compute viewport bounds
        const tileSize = config.tiles.size;
        const viewSize = Math.floor(config.canvasWidth / tileSize);
        const startX = gameState.player.x - Math.floor(viewSize / 2);
        const startY = gameState.player.y - Math.floor(viewSize / 2);

        // Reveal all tiles in the viewport immediately
        for (let y = 0; y < viewSize; y++) {
            for (let x = 0; x < viewSize; x++) {
                const key = `${startX + x},${startY + y}`;
                getTile(startX + x, startY + y, config); // ensure tile exists
                gameState.revealed[key] = true;
            }
        }

        // Force initial render
        lastPlayerKey = null;
        lastSelectorKey = null;
        requestAnimationFrame(() => {
            render(config);
            updateTileInfoPanel(config);
            updateTimePanel(config);
        });
    } else {
        initState(config);
        generateMap(config);
        saveGameState();
    }

    initPlayer(config);
    // Use fullRender to set up initial state/UI
    fullRender(config);
    requestAnimationFrame(() => gameLoop(config));
}

function gameLoop(config) {
    updatePlayer(config); // handle input + position
    // Use fullRender for conditional, throttled updates
    fullRender(config);
    requestAnimationFrame(() => gameLoop(config));
}

initGame(true).catch((err) => {
    console.error('Error initializing game:', err);
    alert('Failed to start the game. Please try again later.');
});

document.getElementById('new-game').addEventListener('click', () => {
    startNewGame();
});

// Display save size and warning/critical status
function updateSaveSizeDisplay() {
    const saveEl = document.getElementById("save-size");
    if (!saveEl) return;

    const savedData = localStorage.getItem("trellisSave");
    if (!savedData) {
        saveEl.textContent = "(no save)";
        return;
    }

    const sizeInBytes = new Blob([savedData]).size;
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);

    let warningText = "";
    if (config.saveSizeWarningKB && sizeInBytes > 1024 * config.saveSizeWarningKB) {
        warningText = " ⚠ nearing limit";
    }
    if (config.saveSizeCriticalKB && sizeInBytes > 1024 * config.saveSizeCriticalKB) {
        warningText = " ⚠⚠ close to limit!";
    }

    saveEl.textContent = `(${sizeInKB} KB${warningText})`;
}

// --- Performance optimization helper functions ---
function maybeUpdateTileInfoPanel(config) {
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

function maybeRender(config) {
    const currentPlayerKey = `${gameState.player.x},${gameState.player.y}`;
    if (currentPlayerKey !== lastPlayerKey) {
        updateFog(config);
        render(config);
        lastPlayerKey = currentPlayerKey;
    }
}

function refreshUI(config) {
    updateTimePanel(config);
    maybeUpdateTileInfoPanel(config);
    maybeUpdateSaveSizeDisplay();
}

function fullRender(config) {
    maybeRender(config);
    refreshUI(config);
}

export { saveGameState };