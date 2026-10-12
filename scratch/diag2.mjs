import Matter from 'matter-js';
import { Ragdoll } from '../src/entities/Ragdoll.js';

const engine = Matter.Engine.create();
Matter.Composite.add(engine.world, Matter.Bodies.rectangle(2100, 2100, 4000, 200, { isStatic: true }));
const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1900, def: { id: 'ragdollLight' } });
Matter.Composite.add(engine.world, rd.parts.map((p) => p.body));
Matter.Composite.add(engine.world, rd.constraints);

const dump = (label, bodies) => {
  console.log(label, bodies.map((b) => `${b.partName}:${b.position.x.toFixed(1)},${b.position.y.toFixed(1)} v=${b.velocity.x.toFixed(2)},${b.velocity.y.toFixed(2)} av=${b.angularVelocity.toFixed(3)}`).join(' | '));
};
const partBodies = rd.parts.map((p) => p.body);
dump('BEFORE', partBodies);
// 1. plain engine update, no ragdoll code at all
Matter.Engine.update(engine, 1000 / 60);
dump('AFTER-PLAIN', partBodies);
