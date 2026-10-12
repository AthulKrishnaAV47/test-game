import './headless_env.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
await import(path.join(here, 'build/ssr_entry.js'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { game, services, ui } = globalThis.window.sticklab ?? {};
console.log('sticklab present:', Boolean(globalThis.window.sticklab));
console.log('isBooted', game?.isBooted, 'isRunning', game?.isRunning);
console.log('all scenes', (game?.scene?.getScenes(false) ?? []).map((s) => `${s.scene.key}:${s.sys.settings.status}`).join(', '));
console.log('renderer', game?.renderer?.type, 'loop running', game?.loop?.running, 'raf', typeof game?.loop?.raf?.start);
console.log('settings quality', services?.settings?.get('quality'), 'sfx audio', Boolean(services?.sfx?.audio));
await guard();
async function guard() {
  await wait(400);
  console.log('after 400ms active', (game?.scene?.getScenes(true) ?? []).map((s) => s.scene.key).join(', '));
  console.log('loading hidden?', globalThis.document.getElementById('loading-overlay')?.className);
  ui?.startMode?.('sandbox');
  await wait(800);
  console.log('after start active', (game?.scene?.getScenes(true) ?? []).map((s) => s.scene.key).join(', '));
  console.log('scene keys', Object.keys(game?.scene?.keys ?? {}).join(','));
}
