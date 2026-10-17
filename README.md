# Emberhold

An original fantasy real-time strategy game that runs in your browser — no installs beyond Node, no assets to download, everything drawn in code on HTML5 Canvas.

**Emberhold** (blue) faces the **Ashen Horde** (red) in a single skirmish: raise an army from barracks, archery ranges and stables, capture gold mines across the riverlands, and raze the enemy fortress before yours falls. All factions, names, units and art are original creations inspired by classic RTS games.

## How to run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). Click **Start Battle**.

```bash
npm test        # unit tests (vitest)
npm run build   # typecheck + production build into dist/
```

## Controls

| Input | Action |
|---|---|
| Left-click | Select a unit / building / build plot |
| Drag | Box-select units |
| Double-click | Select all units of that type on screen |
| Right-click | Move, or attack the enemy under the cursor |
| A + left-click | Attack-move |
| WASD / arrow keys / screen edge | Pan camera |
| Click minimap | Jump camera |
| 1 / 2 / 3 | Build Barracks / Archery Range / Stables on selected plot |
| Q | Train unit at selected building |
| T | Warden's war-cry ability (hero) |
| Right-click (building selected) | Set rally point |
| Esc | Deselect |
| M | Mute |

## Game systems

- **Combat triangle** — Swordsmen beat Lancers, Lancers beat Archers, Archers beat Swordsmen (1.5× damage). The Warden (hero) is strong against everything and rallies nearby allies with War-cry (+40% damage, 8s).
- **Economy** — Each captured gold mine pays +8 gold/sec. Mines flip after a lone unit holds the ring for ~2.5s. Start: 600 gold, one mine each.
- **Command points** — Armies are capped at 60 points (swordsman/archer 1, lancer 2, Warden 4).
- **Buildings** — Fixed build plots near your fortress. Fortress trains the Warden; lose it and the battle is over.
- **Enemy AI** — Expands to nearby mines, builds a mixed army on a timer, and sends growing attack waves at your base every 90 seconds while keeping defenders home.

## Tech stack

- Vite + TypeScript, zero runtime dependencies
- HTML5 Canvas 2D rendering (terrain pre-rendered offscreen, all units/buildings drawn in code)
- Web Audio API sound effects (synthesized, no audio files)
- Vitest unit tests, GitHub Actions CI on Node 20

## Roadmap

- Second skirmish map and selectable difficulty
- Fog of war
- More unit abilities and a second hero
- Multiplayer (WebRTC)
