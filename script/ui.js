import { gameState } from './state.js';
import { saveGameState } from './game.js';

export function updateTileInfoPanel(config) {
    const tile = gameState.map[gameState.selector.y][gameState.selector.x];
    const detailsEl = document.getElementById('tile-details');
    const actionsEl = document.getElementById('tile-actions');

    detailsEl.innerHTML = '';
    actionsEl.innerHTML = '';

    config.tileDetails.forEach(key => {
        const p = document.createElement('p');
        let value = tile[key];

        // Normalize undefined or null to 'none' for tile and plant
        if ((key === 'tile' || key === 'plant') && (value === null || value === undefined)) {
            value = 'None';
        }

        // Apply labels if defined
        if (key === 'tile' && config.tileTypeLabels[value]) {
            value = config.tileTypeLabels[value];
        }
        if (key === 'plant' && config.plantLabels && config.plantLabels[value]) {
            value = config.plantLabels[value];
        }

        // Format numeric values
        if ((key === 'moisture' || key === 'fertility') && typeof value === 'number') {
            value = `${value}%`;
        }

        // Fallback if still no value
        if (value === null || value === undefined) {
            value = '–';
        }

        p.innerHTML = `<strong>${key}:</strong> <span>${value}</span>`;
        detailsEl.appendChild(p);
    });

    for (const [actionLabel, actionDef] of Object.entries(config.tileActions)) {
        const isValid = Object.entries(actionDef.condition).every(([key, cond]) => {
            const current = tile[key];
            if (typeof cond === 'object') {
                if ('lt' in cond && !(current < cond.lt)) return false;
                if ('gt' in cond && !(current > cond.gt)) return false;
                if ('lte' in cond && !(current <= cond.lte)) return false;
                if ('gte' in cond && !(current >= cond.gte)) return false;
            } else {
                return current === cond;
            }
            return true;
        });
        if (isValid) {
            const btn = document.createElement('button');
            btn.textContent = actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1);
            btn.onclick = () => {
                Object.entries(actionDef.effect).forEach(([key, change]) => {
                    if (typeof change === 'object') {
                        if ('inc' in change) {
                            tile[key] = Math.min(config[`${key}Range`].max, tile[key] + change.inc);
                        }
                        if ('dec' in change) {
                            tile[key] = Math.max(config[`${key}Range`].min, tile[key] - change.dec);
                        }
                    } else {
                        tile[key] = change;
                    }
                });
                updateTileInfoPanel(config);
                saveGameState();
                incrementTime(config.actionTimeIncrement, config);
            };
            actionsEl.appendChild(btn);
        }
    }
}

export function updateTimePanel(config) {
    const el = document.getElementById('time-display');
    if (!el) return;
    const { hour, minute, week, seasonIndex } = gameState.time;
    const period = hour < 12 ? 'AM' : 'PM';
    const displayHour = ((hour - 1) % 12 + 1);
    const paddedMinute = minute.toString().padStart(2, '0');
    const season = config.seasons[seasonIndex];
    el.textContent = `${season} - WEEK ${week} - ${displayHour}:${paddedMinute} ${period}`;
}

function incrementTime(minutes, config) {
    const time = gameState.time;
    time.minute += minutes;
    while (time.minute >= 60) {
        time.minute -= 60;
        time.hour++;
    }

    if (time.hour >= config.dayEndHour) {
        alert('A new day is starting.');
        time.hour = config.dayStartHour;
        time.minute = 0;
        time.week++;
        if (time.week > config.weeksPerSeason) {
            time.week = 1;
            time.seasonIndex = (time.seasonIndex + 1) % config.seasons.length;
        }
    }
    updateTimePanel(config);
}

export { incrementTime };