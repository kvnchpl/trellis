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
    initState,
    getTile,
    attemptPlayerMove,
    saveGameState
} from './state.js';

import {
    updateTileInfoPanel,
    updateTimePanel,
    inputState,
    loadStrings,
    showModal,
    closeModal,
    updateSaveSizeDisplay,
    incrementTimeUI
} from './ui.js';

const configUrl = 'config.json';
let config;

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
                initPlayer(inputState);
                updateFog(config);
                updateTimePanel(config);
                render(config);
                updateTileInfoPanel(config);
                saveGameState(config);
                updateSaveSizeDisplay(config);
            }
        });
        return;
    }
    localStorage.removeItem("trellisSave");
    initState(config);
    initPlayer(inputState);
    updateFog(config);
    updateTimePanel(config);
    render(config);
    updateTileInfoPanel(config);
    saveGameState(config);
    updateSaveSizeDisplay(config);
    // New game started
}

function endDayPrompt() {
    showModal('gameMessage', {
        title: "End the day?",
        message: "You won’t be able to take more actions today.",
        confirmText: "End Day",
        cancelText: "Cancel",
        onConfirm: () => showModal('dayComplete', { ...gameState.dailyStats }, config)
    });
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
        render(config);
        updateTileInfoPanel(config);
        updateTimePanel(config);
    } else {
        initState(config);
        saveGameState(config);
        updateSaveSizeDisplay(config);
    }

    initPlayer(inputState);
    refreshScreenIfChanged(config);
    requestAnimationFrame(() => gameLoop(config));
}

function gameLoop(config) {
    if (!inputState.modalOpen) {
        const { movementTime, selectorMoved, actionInfo } = updatePlayer(config, inputState) || {};

        if (movementTime) incrementTimeUI(movementTime, config);
        if (selectorMoved) {
            updateTileInfoPanel(config);
            render(config);
        }
        if (actionInfo) {
            const { actionLabel, result } = actionInfo;
            if (!result.success) {
                showModal('gameMessage', {
                    title: `Cannot ${actionLabel} this tile`,
                    message: Array.isArray(result.message) ? result.message : [result.message]
                });
            } else if (result.plantModal) {
                showModal('plantSelection', config, getTile(gameState.selector.x, gameState.selector.y, config), gameState.selector.x, gameState.selector.y);
            } else {
                finalizeAction(config.tiles.actions[actionLabel], config);
            }
        }
    }

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
        endDayPrompt();
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
