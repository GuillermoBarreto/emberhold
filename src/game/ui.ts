import { BUILDINGS, BUILDING_NAMES, CP_CAP, UNITS, UNIT_NAMES, WARCRY_COOLDOWN } from './config';
import { cpUsed } from './economy';
import { queueUnit, startBuild, useWarcry } from './sim';
import { isMuted, sfx, toggleMute } from './audio';
import { fmtTime } from './input';
import { Game } from './game';
import type { BuildingKind, Unit, UnitKind } from './types';

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing #${id}`);
  return e;
}

function costBtn(label: string, cost: number, gold: number, hotkey: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn';
  b.innerHTML = `${label} <span class="cost">🪙${cost}</span> <span class="hk">${hotkey}</span>`;
  if (gold < cost) b.classList.add('disabled');
  b.onclick = () => {
    if (gold >= cost) onClick();
    else sfx.error();
  };
  return b;
}

export function initUI(game: Game): void {
  el('mute-btn').onclick = () => {
    toggleMute();
    refreshTopbar(game);
  };
  el('restart-btn').onclick = () => {
    game.reset();
    el('end-screen').classList.add('hidden');
    game.uiDirty = true;
  };
  el('start-btn').onclick = () => {
    el('start-screen').classList.add('hidden');
    (window as unknown as { __emberholdStart: () => void }).__emberholdStart();
  };
  el('again-btn').onclick = () => {
    game.reset();
    el('end-screen').classList.add('hidden');
    game.uiDirty = true;
  };
}

function refreshTopbar(game: Game): void {
  el('gold-val').textContent = `${Math.floor(game.state.gold[0])}`;
  el('cp-val').textContent = `${cpUsed(game.state.units, 0)}/${CP_CAP}`;
  el('timer-val').textContent = fmtTime(game.state.time);
  el('mute-btn').textContent = isMuted() ? '🔇' : '🔊';
}

function renderPanel(game: Game): void {
  const panel = el('panel');
  panel.innerHTML = '';
  const s = game.state;

  // 1. build plot selected
  if (game.selectedPlot) {
    const plot = game.selectedPlot;
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Build Plot — choose a structure';
    panel.appendChild(title);
    const row = document.createElement('div');
    row.className = 'btn-row';
    const defs: [BuildingKind, string][] = [
      ['barracks', '1'],
      ['archery', '2'],
      ['stables', '3'],
    ];
    for (const [kind, hk] of defs) {
      row.appendChild(
        costBtn(BUILDING_NAMES[kind], BUILDINGS[kind].cost, s.gold[0], hk, () => {
          const p = game.selectedPlot;
          if (p && startBuild(s, p, kind)) {
            const b = s.buildings.find((bb) => bb.id === p.buildingId);
            game.selectedPlot = null;
            game.selectedBuildings.clear();
            if (b) game.selectedBuildings.add(b.id);
            game.uiDirty = true;
          }
        }),
      );
    }
    panel.appendChild(row);
    const hint = document.createElement('div');
    hint.className = 'panel-hint';
    hint.textContent = 'Hotkeys 1 / 2 / 3';
    panel.appendChild(hint);
    return;
  }

  // 2. building selected
  if (game.selectedBuildings.size > 0) {
    const id = [...game.selectedBuildings][0];
    const b = s.buildings.find((bb) => bb.id === id);
    if (!b) return;
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = `${BUILDING_NAMES[b.kind]} — HP ${Math.ceil(b.hp)}/${b.maxHp}`;
    panel.appendChild(title);
    if (b.underConstruction) {
      const pct = Math.round((1 - b.buildT / BUILDINGS[b.kind].buildTime) * 100);
      const d = document.createElement('div');
      d.className = 'panel-hint';
      d.textContent = `Under construction… ${pct}%`;
      panel.appendChild(d);
      return;
    }
    if (b.queue.length > 0) {
      const qd = document.createElement('div');
      qd.className = 'queue';
      b.queue.forEach((q, i) => {
        const pct = Math.round((1 - q.t / q.total) * 100);
        const line = document.createElement('div');
        line.className = 'queue-item';
        line.innerHTML =
          `<span>${i === 0 ? '▶' : '…'} ${UNIT_NAMES[q.kind]}</span>` +
          `<span class="qbar"><span class="qfill" style="width:${pct}%"></span></span>`;
        qd.appendChild(line);
      });
      panel.appendChild(qd);
    }
    const row = document.createElement('div');
    row.className = 'btn-row';
    for (const kind of BUILDINGS[b.kind].trains as UnitKind[]) {
      const spec = UNITS[kind];
      row.appendChild(
        costBtn(`Train ${UNIT_NAMES[kind]}`, spec.cost, s.gold[0], 'Q', () => {
          queueUnit(s, id, kind);
          game.uiDirty = true;
        }),
      );
    }
    panel.appendChild(row);
    const hint = document.createElement('div');
    hint.className = 'panel-hint';
    hint.textContent = b.kind === 'fortress' ? 'Q trains the Warden (hero)' : 'Right-click the map to set a rally point • Q trains';
    panel.appendChild(hint);
    return;
  }

  // 3. units selected
  if (game.selectedUnits.size > 0) {
    const us = [...game.selectedUnits]
      .map((id) => s.units.find((u) => u.id === id))
      .filter((u): u is Unit => u !== undefined && u.state !== 'dead');
    // regroup by kind for display
    const byKind = new Map<UnitKind, typeof us>();
    for (const u of us) {
      const arr = byKind.get(u.kind) ?? [];
      arr.push(u);
      byKind.set(u.kind, arr);
    }
    const title = document.createElement('div');
    title.className = 'panel-title';
    const parts: string[] = [];
    byKind.forEach((arr, kind) => parts.push(`${arr.length}× ${UNIT_NAMES[kind]}`));
    title.textContent = parts.join('  •  ');
    panel.appendChild(title);

    if (us.length === 1) {
      const u = us[0];
      const spec = UNITS[u.kind];
      const d = document.createElement('div');
      d.className = 'panel-hint';
      d.textContent = `HP ${Math.ceil(u.hp)}/${u.maxHp} • DMG ${spec.dmg} • Range ${spec.range}`;
      panel.appendChild(d);
      if (u.kind === 'hero') {
        const row = document.createElement('div');
        row.className = 'btn-row';
        const ab = document.createElement('button');
        ab.className = 'btn ability';
        const cd = Math.ceil(u.abilityCd);
        ab.innerHTML = cd > 0 ? `War-cry <span class="cost">${cd}s</span>` : `War-cry <span class="hk">T</span>`;
        if (cd > 0) ab.classList.add('disabled');
        ab.onclick = () => {
          if (useWarcry(s, u.id)) game.uiDirty = true;
        };
        row.appendChild(ab);
        panel.appendChild(row);
        const h = document.createElement('div');
        h.className = 'panel-hint';
        h.textContent = 'War-cry: nearby allies deal +40% damage for 8s';
        panel.appendChild(h);
      }
    }
    return;
  }

  // 4. nothing selected
  const hint = document.createElement('div');
  hint.className = 'panel-hint idle';
  hint.textContent =
    'Left-click: select • Drag: box-select • Double-click: select type • Right-click: move / attack • A + click: attack-move • Esc: deselect';
  panel.appendChild(hint);
}

let panelTimer = 0;

export function refreshUI(game: Game, dt: number): void {
  refreshTopbar(game);
  panelTimer += dt;
  if (game.uiDirty || panelTimer > 0.25) {
    panelTimer = 0;
    game.uiDirty = false;
    renderPanel(game);
  }

  // wave warning banner
  const alert = el('alert');
  const w = game.state.ai.waveNumber;
  if (w > game.lastWaveSeen) {
    game.lastWaveSeen = w;
    (game as unknown as { waveAlertT: number }).waveAlertT = 5;
    alert.textContent = `⚠ Enemy wave ${w} incoming!`;
    alert.classList.remove('hidden');
  }
  const wt = (game as unknown as { waveAlertT?: number }).waveAlertT ?? 0;
  if (wt > 0) {
    (game as unknown as { waveAlertT: number }).waveAlertT = wt - dt;
    if (wt - dt <= 0) alert.classList.add('hidden');
  }

  // end screen
  if (game.state.over && !game.endShown) {
    game.endShown = true;
    const win = game.state.over.winner === 0;
    el('end-title').textContent = win ? 'Victory!' : 'Defeat';
    el('end-title').className = win ? 'win' : 'lose';
    el('end-stats').textContent =
      `Battle lasted ${fmtTime(game.state.time)}. ` +
      `Units lost: you ${game.state.stats.lost[0]}, enemy ${game.state.stats.lost[1]}.`;
    el('end-screen').classList.remove('hidden');
    if (win) sfx.victory();
    else sfx.defeat();
  }
}
