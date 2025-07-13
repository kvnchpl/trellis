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

function listSaveSlots() {
    const container = document.getElementById('save-slots');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= config.maxSaveSlots; i++) {
        const slotKey = `trellisSave_slot${i}`;
        const data = localStorage.getItem(slotKey);
        const button = document.createElement('button');
        button.textContent = data ? `Load Slot ${i}` : `Empty Slot ${i}`;
        button.disabled = !data;
        button.addEventListener('click', () => initGame(true, `slot${i}`));
        container.appendChild(button);
    }
}

function saveGameState(slot = null) {
    const saveData = {
        player: gameState.player,
        selector: gameState.selector,
        map: gameState.map,
        revealed: gameState.revealed
    };
    const targetSlot = slot || localStorage.getItem('trellisCurrentSlot') || 'slot1';
    localStorage.setItem(`trellisSave_${targetSlot}`, JSON.stringify(saveData));
    localStorage.setItem('trellisCurrentSlot', targetSlot);
}

function loadGameState(slot = null) {
    const targetSlot = slot || localStorage.getItem('trellisCurrentSlot') || 'slot1';
    const raw = localStorage.getItem(`trellisSave_${targetSlot}`);
    if (!raw) return false;

    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        console.warn(`Corrupted save data in ${targetSlot}. Starting new game.`);
        return false;
    }

    if (!data) return false;

    gameState.player = data.player;
    gameState.selector = data.selector;
    gameState.map = data.map;
    gameState.revealed = data.revealed;
    localStorage.setItem('trellisCurrentSlot', targetSlot);
    return true;
}

async function initGame(loadExisting = false, slot = null) {
    await loadConfig();
    listSaveSlots();
    const canvas = document.getElementById('game-canvas');
    canvas.width = config.canvasWidth;
    canvas.height = config.canvasHeight;

    initState(config);

    if (loadExisting && loadGameState(slot)) {
        console.log('Loaded game from localStorage.');
    } else {
        generateMap(config);
    }

    initPlayer(config);
    updateFog(config);
    updateTimePanel(config);
    render(config);
    requestAnimationFrame(() => gameLoop(config));
}

function gameLoop(config) {
    updatePlayer(config); // handle input + position
    updateFog(config);    // update fog visibility
    render(config);       // re-render map
    updateTileInfoPanel(config); // refresh info panel
    updateTimePanel(config);
    requestAnimationFrame(() => gameLoop(config));
}

initGame(true).catch((err) => {
    console.error('Error initializing game:', err);
    alert('Failed to start the game. Please try again later.');
});

document.getElementById('new-game').addEventListener('click', () => {
    // Rotate older saves upward, drop the last one
    for (let i = config.maxSaveSlots; i > 1; i--) {
        const fromSlot = `trellisSave_slot${i - 1}`;
        const toSlot = `trellisSave_slot${i}`;
        localStorage.setItem(toSlot, localStorage.getItem(fromSlot) || '');
    }
    localStorage.removeItem('trellisSave_slot1');
    initGame(false, 'slot1');
});

export { saveGameState };