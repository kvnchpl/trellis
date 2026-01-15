import {
    initPlayer,
    updatePlayer
} from './player.js';

import {
    render,
    refreshScreenIfChanged,
    preloadImages,
    resizeCanvasAndTiles,
    updateFog
} from './renderer.js';

import {
    gameState,
    initState
} from './state.js';

import {
    updateTileInfoPanel,
    updateTimePanel,
    inputState,
    loadStrings,
    showModal,
    showDayCompleteModal,
    closeModal
} from './ui.js';

const configUrl = 'config.json';
let config;

let lastSelectorKey = null;
let lastPlayerKey = null;

let lastSaveSizeUpdate = 0;

async function fetchConfig() {
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
            readyToHarvest: false
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
        showModal('gameMessage', {
            title: "Start a new game?",
            message: "This will overwrite your current progress.",
            confirmText: "OK",
            cancelText: "Cancel",
            onConfirm: () => {
                localStorage.removeItem("trellisSave");
                initState(config);
                initPlayer();
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
    initPlayer();
    updateFog(config);
    updateTimePanel(config);
    render(config);
    updateTileInfoPanel(config);
    saveGameState();
    // New game started
}

async function initGame(loadExisting = true) {
    await fetchConfig();
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
        saveGameState();
    }

    initPlayer();
    refreshScreenIfChanged(config);
    requestAnimationFrame(() => gameLoop(config));
}

function gameLoop(config) {
    if (!inputState.modalOpen) updatePlayer(config); // player input blocked when modal open
    refreshScreenIfChanged(config);
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
        showModal('gameMessage', {
            title: "End the day?",
            message: "You won’t be able to take more actions today.",
            confirmText: "End Day",
            cancelText: "Cancel",
            onConfirm: () => showModal('dayComplete', { ...gameState.dailyStats }, config)
        });
    });

    cancelBtn.addEventListener('click', () => {
        closeModal();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
});

/**
 * Updates the save size display in the UI.
 * @param {Object} config - Game configuration.
 */
export function updateSaveSizeDisplay() {
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
