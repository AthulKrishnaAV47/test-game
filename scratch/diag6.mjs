import Matter from 'matter-js';
import { Ragdoll } from '../src/entities/Ragdoll.js';

function run(label, opts) {
  const engine = Matter.Engine.create();
  const { withConstraints = true, compensation = 0.98, springK = 0.06, lift = 0.02 } = opts;
  Matter.Composite.add(engine.world, Matter.Bodies.rectangle(2100, 2100, 4000, 200, { isStatic: true }));
  const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1900, def: { id: 'ragdollLight' } });
  Matter.Composite.add(engine.world, rd.parts.map((p) => p.body));
  if (withConstraints) Matter.Composite.add(engine.world, rd.constraints);
  // monkeypatch stance params for the experiment
  const origControl = rd.applyControl.bind(rd);
  rd.gravityAccel = { x: 0, y: 0.2778 };
  rd.setControlInput({ right: false });
  for (let i = 1; i <= 240; i++) {
    // inline stance (mirrors Ragdoll.applyControl)
    const M = Matter, pelvis = rd.pelvis, chest = rd.chest;
    for (const part of rd.parts) {
      const b = part.body, layout = part.layout;
      M.Body.applyForce(b, b.position, { x: 0, y: (-0.2778 * compensation * b.mass) / 277.78 });
      if (!layout) continue;
      const tx = pelvis.position.x + layout.x, ty = pelvis.position.y + (layout.y - 25);
      const ax = Math.max(-0.6, Math.min(0.6, (tx - b.position.x) * springK));
      const ay = Math.max(-0.6, Math.min(0.6, (ty - b.position.y) * springK));
      M.Body.applyForce(b, b.position, { x: (ax * b.mass) / 277.78, y: (ay * b.mass) / 277.78 });
      M.Body.setAngularVelocity(b, b.angularVelocity * 0.9);
    }
    const feetY = (rd.byName.get('footL').position.y + rd.byName.get('footR').position.y) / 2;
    const err = feetY - 67 - pelvis.position.y;
    if (err < -1) {
      const l = Math.max(0, Math.min(0.3, -err * lift));
      M.Body.applyForce(pelvis, pelvis.position, { x: 0, y: (-l * pelvis.mass) / 277.78 });
      M.Body.applyForce(chest, chest.position, { x: 0, y: (-l * 0.5 * chest.mass) / 277.78 });
    }
    Matter.Engine.update(engine, 1000 / 60);
    if (i % 60 === 0) {
      console.log(label, i, 'pelvisY', pelvis.position.y.toFixed(1), 'feetY', feetY.toFixed(1), 'gap', (feetY - pelvis.position.y).toFixed(1));
    }
  }
}
run('no-constraints ', { withConstraints: false });
run('with-constraints', { withConstraints: true });
