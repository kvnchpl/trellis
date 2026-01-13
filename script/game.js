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
 * Returns human-readable messages explaining why an action is blocked on a tile.
 * Fully maps condition keys to per-action blocked messages dynamically.
 * Supports OR conditions, lt/gt/not, booleans, and tile-specific messages.
 * @param {Object} tile - The tile object.
 * @param {Object} actionDef - The action definition.
 * @param {Object} strings - Loaded strings.json
 * @returns {string[]} Array of human-readable messages
 */
export function getBlockedActionMessages(tile, actionDef, strings) {
    if (!tile || !actionDef || !strings?.messages?.blockedAction) return [];

    const actionName = actionDef.name;
    const blockedStrings = strings.messages.blockedAction[actionName] || {};
    const keyMap = strings.conditionKeyMap || {};
    const blockedKeyMap = strings.blockedKeyMap || {};

    function collectFailed(tile, condition) {
        if (!condition) return [];

        // OR condition: fail only if all subconditions fail
        if (condition.or && Array.isArray(condition.or)) {
            const subFailed = condition.or.map(sub => collectFailed(tile, sub));
            if (subFailed.every(f => f.length > 0)) return subFailed.flat();
            return [];
        }

        const failed = [];
        for (const [key, val] of Object.entries(condition)) {
            const tileVal = tile[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                if ('lt' in val && !(tileVal < val.lt)) failed.push({ key, type: 'lt' });
                else if ('gt' in val && !(tileVal > val.gt)) failed.push({ key, type: 'gt' });
                else if ('not' in val && tileVal === val.not) failed.push({ key, type: 'not', notValue: val.not });
                else failed.push(...collectFailed(tileVal, val));
            } else if (tileVal !== val) {
                failed.push({ key, value: val });
            }
        }
        return failed;
    }

    const rawFailed = collectFailed(tile, actionDef.condition);

    const reasons = rawFailed.map(f => {
        const map = blockedKeyMap[actionName] || {};
        const mapVal = map[f.key];

        // 1️⃣ First try blockedKeyMap -> blockedStrings
        if (typeof mapVal === "string") {
            return blockedStrings[mapVal];
        }

        if (mapVal && typeof mapVal === "object") {
            const tileValue = tile[f.key];
            if (tileValue !== undefined && mapVal[tileValue] && blockedStrings[mapVal[tileValue]]) {
                return blockedStrings[mapVal[tileValue]];
            }
        }

        // 2️⃣ Then try conditionKeyMap
        if (f.type && keyMap[f.key]?.[f.type]) return keyMap[f.key][f.type];
        if (f.value !== undefined && keyMap[f.key]?.[f.value] !== undefined) return keyMap[f.key][f.value];

        // 3️⃣ Last fallback: generic message
        return `Cannot perform action due to ${f.key}.`;
    }).filter(Boolean);

    return [...new Set(reasons)]; // remove duplicates
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
