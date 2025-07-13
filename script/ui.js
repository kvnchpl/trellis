import { gameState } from './state.js';
import { saveGameState } from './game.js';

export function updateTileInfoPanel() {
    const tile = gameState.map[gameState.selector.y][gameState.selector.x];
    const actionsEl = document.getElementById('tile-actions');

    const detailsEl = document.getElementById('tile-details');
    detailsEl.innerHTML = '';

    const details = {
        Type: tile.tile || 'unknown',
        Plant: tile.plant || 'none'
        // Add more tile attributes here as needed
    };

    for (const [label, value] of Object.entries(details)) {
        const p = document.createElement('p');
        p.innerHTML = `<strong>${label}:</strong> <span>${value}</span>`;
        detailsEl.appendChild(p);
    }

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