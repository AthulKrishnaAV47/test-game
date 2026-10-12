import Matter from 'matter-js';
import { Ragdoll } from '../src/entities/Ragdoll.js';

const engine = Matter.Engine.create();
Matter.Composite.add(engine.world, Matter.Bodies.rectangle(2100, 2100, 4000, 200, { isStatic: true }));
const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1900, def: { id: 'ragdollLight' } });
Matter.Composite.add(engine.world, rd.parts.map((p) => p.body));
Matter.Composite.add(engine.world, rd.constraints);
rd.setControlInput({ right: false });
const fL = rd.byName.get('footL'), fR = rd.byName.get('footR');
for (let i = 1; i <= 240; i++) {
  rd.groundTimer = 0.14;
  rd.step(1/60);
  Matter.Engine.update(engine, 1000/60);
  if (i % 30 === 0 || i < 4) {
    const feetY = (fL.position.y + fR.position.y) / 2;
    const pelvis = rd.pelvis;
    console.log(i, 'pelvisY', pelvis.position.y.toFixed(1), 'feetY', feetY.toFixed(1), 'stand gap', (feetY - pelvis.position.y).toFixed(1),
      'thighL angle', (rd.byName.get('thighL').angle * 180 / Math.PI).toFixed(0), 'v', pelvis.velocity.y.toFixed(3));
  }
}
