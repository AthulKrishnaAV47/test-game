import Matter from 'matter-js';
import { Ragdoll } from '../src/entities/Ragdoll.js';

const M = Matter;
const engine = M.Engine.create();
M.Composite.add(engine.world, M.Bodies.rectangle(2100, 2100, 4000, 200, { isStatic: true }));
const rd = new Ragdoll({ M, presetId: 'lightweight', x: 2000, y: 1900, def: { id: 'ragdollLight' } });
M.Composite.add(engine.world, rd.parts.map((p) => p.body));
M.Composite.add(engine.world, rd.constraints);
rd.gravityAccel = { x: 0, y: 0.2778 };
for (let i = 1; i <= 120; i++) {
  for (const part of rd.parts) {
    const b = part.body;
    M.Body.applyForce(b, b.position, { x: 0, y: (-0.2778 * 0.98 * b.mass) / 277.78 });
    if (part.layout) {
      const tx = rd.pelvis.position.x + part.layout.x, ty = rd.pelvis.position.y + (part.layout.y - 25);
      const ax = Math.max(-0.6, Math.min(0.6, (tx - b.position.x) * 0.06));
      const ay = Math.max(-0.6, Math.min(0.6, (ty - b.position.y) * 0.06));
      M.Body.applyForce(b, b.position, { x: (ax * b.mass) / 277.78, y: (ay * b.mass) / 277.78 });
    }
  }
  M.Engine.update(engine, 1000 / 60);
  if (i % 30 === 0) {
    console.log('step', i, 'pelvis y', rd.pelvis.position.y.toFixed(0), 'chest y', rd.chest.position.y.toFixed(0));
    for (const j of rd.joints) {
      const len = M.Constraint.currentLength(j.constraint);
      console.log('   ', j.name.padEnd(10), 'len', len.toFixed(2), 'rel angle(deg)', ((j.constraint.bodyB.angle - j.constraint.bodyA.angle) * 180 / Math.PI).toFixed(0));
    }
  }
}
