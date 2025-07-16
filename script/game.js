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
    console.log("=== Listing Save Slots ===");
    console.log("trellisCurrentSlot:", localStorage.getItem('trellisCurrentSlot'));
    const container = document.getElementById('save-slots');
    if (!container) return;
    container.innerHTML = '';

    const currentSlot = localStorage.getItem('trellisCurrentSlot') || null;

    for (let i = 1; i <= config.maxSaveSlots; i++) {
        const slotId = `slot${i}`;
        const slotKey = `trellisSave_${slotId}`;
        const data = localStorage.getItem(slotKey);
        const button = document.createElement('button');

        let isValidSave = false;
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (parsed && typeof parsed === 'object' && parsed.player) {
                    isValidSave = true;
                }
            } catch {
                isValidSave = false;
            }
        }
        // Use updated current calculation: both name and valid data
        const current = (slotId === currentSlot && data !== null);
        console.log(`Slot ${i} - valid?`, isValidSave, "current?", current, "data:", data);

        if (isValidSave) {
            if (current) {
                button.textContent = `Slot ${i} [ACTIVE]`;
                button.disabled = true;
            } else {
                button.textContent = `Load Slot ${i}`;
                button.disabled = false;
                button.addEventListener('click', () => initGame(true, slotId));
            }
        } else {
            if (current) {
                // Only show [ACTIVE] if we've actually started a game in this slot (unsaved)
                button.textContent = `Slot ${i} [ACTIVE]`;
                button.disabled = true;
            } else {
                button.textContent = `Empty Slot ${i}`;
                button.disabled = true;
            }
        }

        container.appendChild(button);
    }
}

function saveGameState(slot = null) {
    const targetSlot = slot || localStorage.getItem('trellisCurrentSlot') || 'slot1';

    // Overwrite the active slot
    localStorage.setItem(`trellisSave_${targetSlot}`, JSON.stringify({
        player: gameState.player,
        selector: gameState.selector,
        map: gameState.map,
        revealed: gameState.revealed
    }));

    localStorage.setItem('trellisCurrentSlot', targetSlot);
    listSaveSlots();
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
        // Only set trellisCurrentSlot when actually starting a new game
        if (slot) {
            localStorage.setItem('trellisCurrentSlot', slot);
        } else if (!localStorage.getItem('trellisCurrentSlot')) {
            // Do NOT set by default on page load; leave null until first save/move
        }
        generateMap(config);
    }

    initPlayer(config);
    updateFog(config);
    updateTimePanel(config);
    render(config);
    updateTileInfoPanel(config);
    listSaveSlots();
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

// Helper: rotates save slots, moving slot1 to slot2, slot2 to slot3, etc.
function rotateSaveSlots() {
    for (let i = config.maxSaveSlots; i > 1; i--) {
        const fromSlot = `trellisSave_slot${i - 1}`;
        const toSlot = `trellisSave_slot${i}`;
        const data = localStorage.getItem(fromSlot);
        if (data) {
            localStorage.setItem(toSlot, data);
        } else {
            localStorage.removeItem(toSlot);
        }
    }
}

// Helper: clear only the specified slot's data
function clearSlot(slotName) {
    localStorage.removeItem("trellisSave_" + slotName);
    console.log("Cleared slot:", slotName);
}

// Helper: create a new blank game state
function createNewGameState() {
    return {
        player: { x: 0, y: 0 },
        selector: { x: 0, y: 0 },
        map: {}
    };
}

// Helper: save a given game state to the current slot
function saveGame(gameStateObj) {
    const slot = trellisCurrentSlot || 'slot1';
    localStorage.setItem(`trellisSave_${slot}`, JSON.stringify(gameStateObj));
    localStorage.setItem('trellisCurrentSlot', slot);
}

// NewGame: rotates saves, clears slot1, sets slot1 as current, and saves a fresh state
function startNewGame() {
    console.log("=== Starting New Game ===");

    // Rotate existing saves first
    rotateSaveSlots();

    // Clear slot1 to prepare for new data
    clearSlot("slot1");

    // Set current slot to slot1 now that it's cleared
    trellisCurrentSlot = "slot1";

    // Create and immediately save a fresh game state to ensure slot1 is valid
    const newGameState = createNewGameState();
    saveGame(newGameState);

    // Log updated slot states
    listSaveSlots();
}

export { saveGameState };