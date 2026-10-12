import Matter from 'matter-js';
import { Ragdoll } from '../src/entities/Ragdoll.js';

const engine = Matter.Engine.create();
const world = engine.world;
Matter.Composite.add(world, Matter.Bodies.rectangle(2100, 2100, 4000, 200, { isStatic: true }));
const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1900, def: { id: 'ragdollLight' } });
Matter.Composite.add(world, rd.parts.map((p) => p.body));
Matter.Composite.add(world, rd.constraints);
rd.setControlInput({ right: true });
for (let i = 1; i <= 90; i++) {
  rd.groundTimer = 0.14;
  rd.step(1 / 60);
  Matter.Engine.update(engine, 1000 / 60);
  if (i <= 6 || i % 10 === 0) {
    const c = rd.chest;
    const thigh = rd.byName.get('thighR');
    console.log(i, 'chestAngle(deg)', (c.angle * 180 / Math.PI).toFixed(1), 'chestAV', c.angularVelocity.toFixed(4),
      'thighAV', thigh.angularVelocity.toFixed(4), 'chestVx', c.velocity.x.toFixed(2), 'y', c.position.y.toFixed(0));
  }
}
