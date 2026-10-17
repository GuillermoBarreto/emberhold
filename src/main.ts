import './style.css';
import { Game, STEP } from './game/game';
import { attachInput } from './game/input';
import { initAudio } from './game/audio';
import { initUI, refreshUI } from './game/ui';
import { prerenderTerrain, renderMinimap, renderWorld } from './game/render';

const canvas = document.getElementById('world') as HTMLCanvasElement;
const mini = document.getElementById('minimap') as HTMLCanvasElement;
const g = canvas.getContext('2d')!;
const mg = mini.getContext('2d')!;

const game = new Game(window.innerWidth, window.innerHeight);
prerenderTerrain(game.terrain);

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.cam.w = canvas.width;
  game.cam.h = canvas.height;
  game.centerCamera(
    Math.min(Math.max(game.cam.x + game.cam.w / 2, 0), 2560),
    Math.min(Math.max(game.cam.y + game.cam.h / 2, 0), 1600),
  );
}
window.addEventListener('resize', resize);
resize();

attachInput(game, canvas, mini, () => {});
initUI(game);

let running = false;
let acc = 0;
let last = performance.now();

// Called by the Start button (user gesture → audio allowed).
(window as unknown as { __emberholdStart: () => void }).__emberholdStart = () => {
  initAudio();
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
};

function loop(now: number): void {
  if (!running) return;
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 8) {
    game.update(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 8) acc = 0;

  renderWorld(g, game.state, game.cam, game.selectedUnits, game.selectedBuildings, game.dragRect);
  renderMinimap(mg, game.state, game.cam, mini.width, mini.height);
  refreshUI(game, dt);
  requestAnimationFrame(loop);
}

// Render one idle frame behind the start screen so it doesn't sit black.
renderWorld(g, game.state, game.cam, game.selectedUnits, game.selectedBuildings, null);
renderMinimap(mg, game.state, game.cam, mini.width, mini.height);
