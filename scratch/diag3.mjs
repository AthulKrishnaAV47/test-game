import Matter from 'matter-js';
import { Ragdoll } from '../src/entities/Ragdoll.js';

const engine = Matter.Engine.create();
Matter.Composite.add(engine.world, Matter.Bodies.rectangle(2100, 2100, 4000, 200, { isStatic: true }));
const rd = new Ragdoll({ M: Matter, presetId: 'lightweight', x: 2000, y: 1900, def: { id: 'ragdollLight' } });
Matter.Composite.add(engine.world, rd.parts.map((p) => p.body));
Matter.Composite.add(engine.world, rd.constraints);
const parts = rd.parts.map((p) => p.body);
const show = (label) => console.log(label, parts.slice(0, 4).map((b) => `${b.partName} av=${b.angularVelocity.toFixed(3)} v=${b.velocity.x.toFixed(2)},${b.velocity.y.toFixed(2)}`).join(' | '));

rd.setControlInput({ right: true });
show('start      ');
rd.groundTimer = 0.14;
// isolate each pass
rd.enforceJointGaps(); show('after gaps ');
rd.applyJointLimits(); show('after limits');
rd.applyControl(1 / 60); show('after control');
rd.clampDynamics(); show('after clamp');
Matter.Engine.update(engine, 1000 / 60);
show('after update');
