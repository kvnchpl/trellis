import { initPlayer, updatePlayer } from './player.js';
import { generateMap, updateFog } from './map.js';
import { gameState, initState } from './state.js';
import { render } from './renderer.js';
import { updateTileInfoPanel, updateTimePanel } from './ui.js';

const configUrl = 'config.json';
let config;

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
    localStorage.setItem("trellisSave", JSON.stringify({
        player: gameState.player,
        selector: gameState.selector,
        map: gameState.map,
        revealed: gameState.revealed,
        time: gameState.time
    }));
    console.log("Game saved.");
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
    } else {
        initState(config);
        generateMap(config);
        saveGameState();
    }

    initPlayer(config);
    updateFog(config);
    updateTimePanel(config);
    render(config);
    updateTileInfoPanel(config);
    requestAnimationFrame(() => gameLoop(config));
}

function gameLoop(config) {
    updatePlayer(config); // handle input + position
    updateFog(config);    // update fog visibility
    render(config);       // re-render map
    updateTimePanel(config);
    requestAnimationFrame(() => gameLoop(config));
}

initGame(true).catch((err) => {
    console.error('Error initializing game:', err);
    alert('Failed to start the game. Please try again later.');
});

document.getElementById('new-game').addEventListener('click', () => {
    startNewGame();
});

export { saveGameState };