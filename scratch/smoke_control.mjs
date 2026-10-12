import Matter from 'matter-js';
import { Ragdoll } from '../src/entities/Ragdoll.js';

function makeWorld() {
  const engine = Matter.Engine.create();
  const world = engine.world;
  Matter.Composite.add(world, Matter.Bodies.rectangle(2100, 2100, 4000, 200, { isStatic: true }));
  return { engine, world };
}

// --- balance test: standing still -----------------------------------------
{
  const { engine, world } = makeWorld();
  const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1700, def: { id: 'ragdollLight' } });
  Matter.Composite.add(world, rd.parts.map((p) => p.body));
  Matter.Composite.add(world, rd.constraints);
  rd.setControlInput({ left: false, right: false, jump: false });
  const x0 = rd.chest.position.x;
  for (let i = 0; i < 180; i++) { rd.groundTimer = 0.14; rd.step(1 / 60); Matter.Engine.update(engine, 1000 / 60); }
  const deg = (rd.chest.angle * 180) / Math.PI;
  console.log('balance: chest angle', deg.toFixed(1), 'drift', (rd.chest.position.x - x0).toFixed(1), 'height', (rd.pelvis.position.y - rd.head.position.y).toFixed(1));
}

// --- walk test -------------------------------------------------------------
{
  const { engine, world } = makeWorld();
  const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1700, def: { id: 'ragdollLight' } });
  Matter.Composite.add(world, rd.parts.map((p) => p.body));
  Matter.Composite.add(world, rd.constraints);
  for (let i = 0; i < 60; i++) { rd.groundTimer = 0.14; rd.step(1 / 60); Matter.Engine.update(engine, 1000 / 60); }
  const x0 = rd.chest.position.x;
  rd.setControlInput({ right: true, left: false, jump: false });
  for (let i = 0; i < 180; i++) { rd.groundTimer = 0.14; rd.step(1 / 60); Matter.Engine.update(engine, 1000 / 60); }
  console.log('walk: moved', (rd.chest.position.x - x0).toFixed(1), 'px in 3s, angle', ((rd.chest.angle * 180) / Math.PI).toFixed(1));
}

// --- jump test -------------------------------------------------------------
{
  const { engine, world } = makeWorld();
  const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1900, def: { id: 'ragdollLight' } });
  Matter.Composite.add(world, rd.parts.map((p) => p.body));
  Matter.Composite.add(world, rd.constraints);
  for (let i = 0; i < 120; i++) { rd.groundTimer = 0.14; rd.step(1 / 60); Matter.Engine.update(engine, 1000 / 60); }
  const y0 = rd.pelvis.position.y;
  rd.setControlInput({ jump: true, left: false, right: false });
  let peak = y0;
  for (let i = 0; i < 120; i++) { rd.groundTimer = i < 3 ? 0.14 : 0; rd.step(1 / 60); Matter.Engine.update(engine, 1000 / 60); peak = Math.min(peak, rd.pelvis.position.y); }
  console.log('jump: pelvis rose', (y0 - peak).toFixed(1), 'px');
}
