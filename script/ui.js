import { gameState } from './state.js';
import { saveGameState } from './game.js';

let config;

fetch('config.json')
    .then((res) => res.json())
    .then((data) => config = data);

export function updateTileInfoPanel() {
    const tile = gameState.map[gameState.selector.y][gameState.selector.x];
    const detailsEl = document.getElementById('tile-details');
    const actionsEl = document.getElementById('tile-actions');

    detailsEl.innerHTML = '';
    actionsEl.innerHTML = '';

    config.tileDetails.forEach(key => {
        const p = document.createElement('p');
        let value = tile[key] ?? '–';

        // Use label from config if available
        if (key === 'tile' && config.tileTypeLabels[value]) {
            value = config.tileTypeLabels[value];
        }
        if ((key === 'moisture' || key === 'fertility') && typeof value === 'number') {
            value = `${value}%`;
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
                updateTileInfoPanel();
                saveGameState();
                incrementTime(config.actionTimeIncrement, config);
            };
            actionsEl.appendChild(btn);
        }
    }
}

export function updateTimePanel() {
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
    updateTimePanel();
}

export { incrementTime };