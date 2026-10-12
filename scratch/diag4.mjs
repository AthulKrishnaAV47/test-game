import Matter from 'matter-js';
import { Ragdoll } from '../src/entities/Ragdoll.js';

const engine = Matter.Engine.create();
Matter.Composite.add(engine.world, Matter.Bodies.rectangle(2100, 2100, 4000, 200, { isStatic: true }));
const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1900, def: { id: 'ragdollLight' } });
Matter.Composite.add(engine.world, rd.parts.map((p) => p.body));
Matter.Composite.add(engine.world, rd.constraints);
rd.setControlInput({ right: false });
for (let i = 0; i < 240; i++) { rd.groundTimer = 0.14; rd.step(1/60); Matter.Engine.update(engine, 1000/60); }
console.log('pose after 4s (x,y):');
for (const p of rd.parts) console.log(' ', p.name.padEnd(10), p.body.position.x.toFixed(1), p.body.position.y.toFixed(1), 'angle(deg)', (p.body.angle*180/Math.PI).toFixed(1));
console.log('chest y', rd.chest.position.y.toFixed(1), 'pelvis y', rd.pelvis.position.y.toFixed(1));
// now walk
const x0 = rd.chest.position.x;
rd.setControlInput({ right: true });
for (let i = 0; i < 300; i++) { rd.groundTimer = 0.14; rd.step(1/60); Matter.Engine.update(engine, 1000/60); }
console.log('walk 5s: moved', (rd.chest.position.x - x0).toFixed(1), 'px =', ((rd.chest.position.x-x0)/5).toFixed(0), 'px/s (target 144)');
for (const p of rd.parts) console.log(' ', p.name.padEnd(10), p.body.position.x.toFixed(1), p.body.position.y.toFixed(1), 'angle(deg)', (p.body.angle*180/Math.PI).toFixed(1));
