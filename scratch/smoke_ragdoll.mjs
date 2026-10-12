import Matter from 'matter-js';
import { Ragdoll } from '../src/entities/Ragdoll.js';
import { JOINT_LAYOUT } from '../src/physics/RagdollFactory.js';

const engine = Matter.Engine.create();
engine.gravity.y = 1;
const world = engine.world;
Matter.Composite.add(world, Matter.Bodies.rectangle(2100, 2100, 4000, 200, { isStatic: true }));

const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1800, scale: 1, def: {id:'ragdollLight', name:'Ragdoll'} });
Matter.Composite.add(world, rd.parts.map(p => p.body));
Matter.Composite.add(world, rd.constraints);

let maxGap = 0;
for (let i = 0; i < 300; i++) {
  rd.step(1/60);
  Matter.Engine.update(engine, 1000/60);
  // measure gaps
  for (const j of rd.joints) {
    const a = rd.byName.get(j.a), b = rd.byName.get(j.b);
    const pa = Matter.Constraint.pointAWorld(j.constraint);
    const pb = Matter.Constraint.pointBWorld(j.constraint);
    const d = Matter.Vector.magnitude(Matter.Vector.sub(pa, pb));
    if (d > maxGap) maxGap = d;
  }
}
const chest = rd.chest;
console.log('after 5s: chest y=', chest.position.y.toFixed(1), 'angle(deg)=', (chest.angle*180/Math.PI).toFixed(1));
console.log('max joint gap:', maxGap.toFixed(2), '(limit', 9, ')');
const finite = rd.parts.every(p => Number.isFinite(p.body.position.x) && Number.isFinite(p.body.position.y));
console.log('all positions finite:', finite);
console.log('bounds:', JSON.stringify(rd.bounds()));
