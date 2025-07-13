

import { initPlayer, updatePlayer } from './player.js';
import { generateMap, updateFog } from './map.js';
import { initState } from './state.js';
import { render } from './renderer.js';

// Load config
const configUrl = '/config.json';

async function loadConfig() {
    const response = await fetch(configUrl);
    if (!response.ok) throw new Error('Failed to load config');
    return response.json();
}

async function initGame() {
    const config = await loadConfig();

    initState(config);
    generateMap(config);
    initPlayer(config);

    updateFog(config); // Reveal initial fog
    render(config);

    requestAnimationFrame(() => gameLoop(config));
}

function gameLoop(config) {
    updatePlayer(config); // handle input + position
    updateFog(config);    // update fog visibility
    render(config);       // re-render map
    requestAnimationFrame(() => gameLoop(config));
}

initGame();