import {
    initPlayer,
    updatePlayer
} from './player.js';
import {
    generateMap,
    updateFog
} from './map.js';
import {
    gameState,
    initState
} from './state.js';
import {
    incrementTime,
    showDayCompleteModal,
    showGameMessageModal
} from './ui.js';
import {
    render,
    preloadImages
} from './renderer.js';
import {
    updateTileInfoPanel,
    updateTimePanel,
    inputState,
    loadStrings
} from './ui.js';

/**
 * Returns an array of reasons why an action cannot be performed on a tile.
 * Checks each condition in the action's config against the tile state.
 */
export function getActionBlockReasons(tile, actionConfig, strings) {
    const reasons = [];
    const cond = actionConfig.condition;

    if (!cond) return reasons;

    // Tile type
    if (cond.tile !== undefined && tile.tile !== cond.tile) {
        reasons.push(`It must be ${cond.tile}`);
    }

    // Moisture
    if (cond.moisture?.lt !== undefined && tile.moisture >= cond.moisture.lt) {
        reasons.push("It must not be fully moist");
    }
    if (cond.moisture?.gt !== undefined && tile.moisture <= cond.moisture.gt) {
        reasons.push("It must be moist enough");
    }

    // Fertility
    if (cond.fertility?.lt !== undefined && tile.fertility >= cond.fertility.lt) {
        reasons.push("It must not be fully fertile");
    }
    if (cond.fertility?.gt !== undefined && tile.fertility <= cond.fertility.gt) {
        reasons.push("It must be fertile enough");
    }

    // Mulch
    if (cond.mulch !== undefined && tile.mulch !== cond.mulch) {
        reasons.push(cond.mulch ? "It must be mulched" : "It must be unmulched");
    }

    // Weeds
    if (cond.weeds !== undefined && tile.weeds !== cond.weeds) {
        reasons.push(cond.weeds ? "It must have weeds" : "It must have no weeds");
    }

    // PlantType
    if (cond.plantType !== undefined) {
        if (cond.plantType === null && tile.plantType !== null) {
            reasons.push("It must be empty");
        } else if (cond.plantType !== null && tile.plantType !== cond.plantType) {
            reasons.push(`It must contain ${cond.plantType}`);
        }
    }

    // OR conditions
    if (cond.or && Array.isArray(cond.or)) {
        const orFailed = cond.or.every(subCond => {
            return Object.entries(subCond).every(([key, val]) => {
                if (key === "tile") return tile.tile !== val;
                if (key === "plantType") return tile.plantType === val;
                if (key === "weeds") return tile.weeds !== val;
                if (key === "mulch") return tile.mulch !== val;
                return false;
            });
        });
        if (orFailed) reasons.push("No valid element to clear");
    }

    return reasons;
}

const configUrl = 'config.json';
let config;

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

export function saveGameState() {
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
        gameState.time = {
            hour: data.time?.hour ?? 7,
            minute: data.time?.minute ?? 0,
            week: data.time?.week ?? 1,
            seasonIndex: data.time?.seasonIndex ?? 0
        };
        // Game loaded successfully
        return true;
    } catch (e) {
        console.warn("Corrupted save data. Starting new game.");
        return false;
    }
}

function startNewGame() {
    if (localStorage.getItem("trellisSave")) {
        showGameMessageModal({
            title: "Start a new game?",
            message: "This will overwrite your current progress.",
            confirmText: "OK",
            cancelText: "Cancel",
            onConfirm: () => {
                localStorage.removeItem("trellisSave");
                initState(config);
                generateMap(config);
                initPlayer(config);
                updateFog(config);
                updateTimePanel(config);
                render(config);
                updateTileInfoPanel(config);
                saveGameState();
            }
        });
        return;
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
    // New game started
}

async function initGame(loadExisting = true) {
    await loadConfig();
    await loadStrings();

    window.addEventListener('resize', () => {
        resizeCanvasAndTiles(config);
        render(config);
    });

    // Ensure images are loaded before any render
    await preloadImages(config);
    resizeCanvasAndTiles(config);
    render(config);

    if (loadExisting && loadGameState()) {
        console.log("Loaded game from localStorage.");
        gameState.selector = {
            ...gameState.player
        };
        updateFog(config);

        // Force initial render
        lastPlayerKey = null;
        lastSelectorKey = null;
        render(config);
        updateTileInfoPanel(config);
        updateTimePanel(config);
    } else {
        initState(config);
        generateMap(config);
        saveGameState();
    }

    initPlayer(config);
    fullRender(config);
    requestAnimationFrame(() => gameLoop(config));
}

function gameLoop(config) {
    if (!inputState.modalOpen) updatePlayer(config); // player input blocked when modal open
    fullRender(config);
    requestAnimationFrame(() => gameLoop(config));
}

initGame(true).catch((err) => {
    console.error('Error initializing game:', err);
    alert('Failed to start the game. Please try again later.');
}).then(() => {
    const newGameBtn = document.getElementById('new-game');
    const endDayBtn = document.getElementById('end-day');
    const cancelBtn = document.getElementById('plant-modal-cancel');
    const overlay = document.getElementById('plant-modal-overlay');

    newGameBtn.addEventListener('click', () => {
        startNewGame();
    });

    endDayBtn.addEventListener('click', () => {
        showGameMessageModal({
            title: "End the day?",
            message: "You won’t be able to take more actions today.",
            confirmText: "End Day",
            cancelText: "Cancel",
            onConfirm: () => showDayCompleteModal({ ...gameState.dailyStats }, config)
        });
    });

    cancelBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
    });
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
