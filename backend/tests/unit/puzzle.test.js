const test = require('node:test');
const assert = require('node:assert/strict');
const { DIFFICULTIES, generatePuzzle, parseAnswer, createPuzzleStore } = require('../../src/puzzle');
const { ValidationError } = require('../../src/errors');

// Small deterministic RNG (mulberry32) so failures can be reproduced from the seed.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Independent check: recompute the answer from the question text alone.
function solve({ kind, question }) {
  const num = (s) => Number(s);
  if (kind === 'missing') {
    const [, a, op, c] = question.match(/^(\d+) ([+−×÷]) \? = (\d+)$/);
    return { '+': num(c) - num(a), '−': num(a) - num(c), '×': num(c) / num(a), '÷': num(a) / num(c) }[op];
  }
  if (kind === 'sequence') {
    const t = question.replace(', ?', '').split(', ').map(num);
    const step = t[1] - t[0];
    if (t.every((v, i) => i === 0 || v - t[i - 1] === step)) return t[t.length - 1] + step;
    const factor = t[1] / t[0];
    assert.ok(t.every((v, i) => i === 0 || v / t[i - 1] === factor), `not a sequence: ${question}`);
    return t[t.length - 1] * factor;
  }
  const [, a, op, b, c] = question.match(/^(\d+) ([+−]) (\d+) × (\d+) = \?$/);
  return op === '+' ? num(a) + num(b) * num(c) : num(a) - num(b) * num(c);
}

test('every generated puzzle has the answer its question implies', () => {
  for (const difficulty of DIFFICULTIES) {
    const rng = seeded(42);
    for (let i = 0; i < 300; i++) {
      const puzzle = generatePuzzle(difficulty, rng);
      assert.equal(solve(puzzle), puzzle.answer, `${difficulty}: ${puzzle.question}`);
      assert.ok(Number.isInteger(puzzle.answer) && puzzle.answer >= 0, puzzle.question);
      assert.ok(puzzle.explanation.includes(String(puzzle.answer)), puzzle.explanation);
    }
  }
});

test('easy puzzles skip order-of-operations; harder levels include every kind', () => {
  const kinds = (difficulty) => {
    const rng = seeded(7);
    return new Set(Array.from({ length: 200 }, () => generatePuzzle(difficulty, rng).kind));
  };
  assert.deepEqual([...kinds('easy')].sort(), ['missing', 'sequence']);
  assert.deepEqual([...kinds('hard')].sort(), ['missing', 'precedence', 'sequence']);
});

test('unknown difficulty is rejected', () => {
  assert.throws(() => generatePuzzle('impossible'), ValidationError);
});

test('parseAnswer accepts whole numbers as number or text only', () => {
  assert.equal(parseAnswer({ answer: 6 }), 6);
  assert.equal(parseAnswer({ answer: ' 12 ' }), 12);
  for (const answer of [undefined, '', 'six', 2.5, '2.5', null, [3]]) {
    assert.throws(() => parseAnswer({ answer }), ValidationError, String(answer));
  }
});

test('the store never reveals the answer before it is submitted', () => {
  const store = createPuzzleStore({ rng: seeded(1) });
  const puzzle = store.create({ difficulty: 'medium' });
  assert.deepEqual(Object.keys(puzzle).sort(), ['difficulty', 'id', 'kind', 'question']);
});

test('a correct answer is confirmed, and each puzzle can be answered only once', () => {
  const rng = seeded(3);
  const expected = generatePuzzle('easy', seeded(3)).answer;
  const store = createPuzzleStore({ rng });
  const { id } = store.create({ difficulty: 'easy' });

  assert.deepEqual(store.answer(id, { answer: expected }).correct, true);
  assert.equal(store.answer(id, { answer: expected }), null);
});

test('a wrong answer returns the solution and explanation', () => {
  const store = createPuzzleStore({ rng: seeded(5) });
  const { id } = store.create({});
  const result = store.answer(id, { answer: -1 });
  assert.equal(result.correct, false);
  assert.ok(Number.isInteger(result.solution));
  assert.ok(result.explanation);
});

test('puzzles expire and the number kept open is capped', () => {
  let clock = 0;
  let n = 0;
  const store = createPuzzleStore({ now: () => clock, ttlMs: 1000, maxOpen: 3, newId: () => `id-${n++}` });

  const first = store.create({});
  clock = 2000;
  assert.equal(store.answer(first.id, { answer: 1 }), null, 'expired');

  for (let i = 0; i < 10; i++) store.create({});
  assert.equal(store.size, 3);
});
