import { gameState } from './state.js';
import { saveGameState } from './game.js';

export function updateTileInfoPanel() {
    const tile = gameState.map[gameState.selector.y][gameState.selector.x];
    const typeEl = document.getElementById('tile-type');
    const plantEl = document.getElementById('tile-plant');
    const actionsEl = document.getElementById('tile-actions');

    typeEl.textContent = tile.tile || 'unknown';
    plantEl.textContent = tile.plant || 'none';

    // Clear old actions
    actionsEl.innerHTML = '';

    // Example action: "Till"
    if (tile.tile === 'soil' && !tile.plant) {
        const btn = document.createElement('button');
        btn.textContent = 'Till';
        btn.onclick = () => {
            tile.tile = 'tilled';
            updateTileInfoPanel();
            saveGameState();
        };
        actionsEl.appendChild(btn);
    }

    // Future: add more actions depending on tile state
}