

import { initPlayer, updatePlayer } from './player.js';
import { generateMap, updateFog } from './map.js';
import { initState } from './state.js';
import { render } from './renderer.js';
import { updateTileInfoPanel } from './ui.js';
import { gameState } from './state.js';

// Load config
const configUrl = 'config.json';

async function loadConfig() {
    try {
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error('Failed to load config');
        return await response.json();
    } catch (error) {
        console.error('Error loading config:', error);
        throw error;
    }
}

function saveGameState() {
    const saveData = {
        player: gameState.player,
        selector: gameState.selector,
        map: gameState.map,
        revealed: gameState.revealed
    };
    localStorage.setItem('trellisSave', JSON.stringify(saveData));
}

function loadGameState() {
    const data = JSON.parse(localStorage.getItem('trellisSave'));
    if (!data) return false;
    gameState.player = data.player;
    gameState.selector = data.selector;
    gameState.map = data.map;
    gameState.revealed = data.revealed;
    return true;
}

async function initGame(loadExisting = false) {
    const config = await loadConfig();
    const canvas = document.getElementById('game-canvas');
    canvas.width = config.canvasWidth;
    canvas.height = config.canvasHeight;

    initState(config);

    if (loadExisting && loadGameState()) {
        console.log('Loaded game from localStorage.');
    } else {
        generateMap(config);
    }

    initPlayer(config);
    updateFog(config);
    render(config);
    requestAnimationFrame(() => gameLoop(config));
}

function gameLoop(config) {
    updatePlayer(config); // handle input + position
    updateFog(config);    // update fog visibility
    render(config);       // re-render map
    updateTileInfoPanel(); // refresh info panel
    requestAnimationFrame(() => gameLoop(config));
}

initGame().catch((err) => {
    console.error('Error initializing game:', err);
    alert('Failed to start the game. Please try again later.');
});

document.getElementById('new-game').addEventListener('click', () => {
    localStorage.removeItem('trellisSave');
    initGame(false);
});

document.getElementById('load-game').addEventListener('click', () => {
    initGame(true);
});

export { saveGameState };