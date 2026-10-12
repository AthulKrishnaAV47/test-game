/**
 * Deterministic-ish unique id generation for entities, constraints and saves.
 */

let counter = 0;

export function uid(prefix = 'id') {
  counter += 1;
  const rand = Math.floor(Math.random() * 0xfffff).toString(36);
  return `${prefix}_${counter.toString(36)}${rand}`;
}

/** Stable numeric-ish id for constraint bookkeeping. */
export const nextCounter = () => (counter += 1);

export const resetCounter = () => {
  counter = 0;
};
