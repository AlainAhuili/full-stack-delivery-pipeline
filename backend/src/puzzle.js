// "Number Quest": arithmetic puzzles generated and checked on the server. The client only
// receives the question; the answer stays in the store until the player submits a guess.
const crypto = require('node:crypto');
const { ValidationError } = require('./errors');

const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Number ranges and puzzle kinds per difficulty.
const LEVELS = {
  easy: { max: 10, kinds: ['missing', 'sequence'] },
  medium: { max: 20, kinds: ['missing', 'sequence', 'precedence'] },
  hard: { max: 50, kinds: ['missing', 'sequence', 'precedence'] },
};

const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// "a op ? = c": find the hidden right operand. Division always comes out even.
function missingOperand(rng, max) {
  const op = pick(rng, ['+', '−', '×', '÷']);
  const a = randInt(rng, 2, max);
  const b = randInt(rng, 1, op === '×' || op === '÷' ? Math.min(max, 12) : max);
  switch (op) {
    case '+':
      return { question: `${a} + ? = ${a + b}`, answer: b, explanation: `${a + b} − ${a} = ${b}` };
    case '−':
      return { question: `${a + b} − ? = ${a}`, answer: b, explanation: `${a + b} − ${a} = ${b}` };
    case '×':
      return { question: `${a} × ? = ${a * b}`, answer: b, explanation: `${a * b} ÷ ${a} = ${b}` };
    default:
      return { question: `${a * b} ÷ ? = ${a}`, answer: b, explanation: `${a * b} ÷ ${a} = ${b}` };
  }
}

// Arithmetic (constant step) or geometric (constant factor) sequence: find the next term.
function sequence(rng, max) {
  const length = 4;
  if (rng() < 0.5) {
    const start = randInt(rng, 1, max);
    const step = randInt(rng, 2, Math.max(3, Math.floor(max / 2)));
    const terms = Array.from({ length }, (_, i) => start + i * step);
    const answer = start + length * step;
    return { question: `${terms.join(', ')}, ?`, answer, explanation: `Each term adds ${step}: ${terms[length - 1]} + ${step} = ${answer}` };
  }
  const start = randInt(rng, 1, Math.max(2, Math.floor(max / 5)));
  const factor = randInt(rng, 2, max > 20 ? 4 : 3);
  const terms = Array.from({ length }, (_, i) => start * factor ** i);
  const answer = start * factor ** length;
  return { question: `${terms.join(', ')}, ?`, answer, explanation: `Each term is multiplied by ${factor}: ${terms[length - 1]} × ${factor} = ${answer}` };
}

// "a + b × c = ?": multiplication comes before addition or subtraction.
function precedence(rng, max) {
  const a = randInt(rng, 1, max);
  const b = randInt(rng, 2, Math.min(max, 12));
  const c = randInt(rng, 2, Math.min(max, 12));
  if (rng() < 0.5) {
    return { question: `${a} + ${b} × ${c} = ?`, answer: a + b * c, explanation: `${b} × ${c} = ${b * c} first, then ${a} + ${b * c} = ${a + b * c}` };
  }
  const big = a + b * c; // keeps the result positive
  return { question: `${big} − ${b} × ${c} = ?`, answer: big - b * c, explanation: `${b} × ${c} = ${b * c} first, then ${big} − ${b * c} = ${big - b * c}` };
}

const GENERATORS = { missing: missingOperand, sequence, precedence };

function generatePuzzle(difficulty, rng = Math.random) {
  const level = LEVELS[difficulty];
  if (!level) {
    throw new ValidationError(`Difficulty must be one of: ${DIFFICULTIES.join(', ')}`);
  }
  const kind = pick(rng, level.kinds);
  return { kind, difficulty, ...GENERATORS[kind](rng, level.max) };
}

function parseAnswer(input) {
  const raw = input?.answer;
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError('Answer must be a whole number');
  }
  return value;
}

// Open puzzles, each answerable once. Old and surplus entries are dropped so the memory used
// stays bounded no matter how many puzzles are requested.
function createPuzzleStore({ rng = Math.random, now = Date.now, ttlMs = 10 * 60 * 1000, maxOpen = 1000, newId = crypto.randomUUID } = {}) {
  const open = new Map();

  function prune() {
    const cutoff = now() - ttlMs;
    for (const [id, puzzle] of open) {
      if (puzzle.createdAt < cutoff || open.size > maxOpen) open.delete(id);
      else break; // Map keeps insertion order, so the rest are newer
    }
  }

  return {
    create(input) {
      const difficulty = input?.difficulty ?? 'easy';
      const puzzle = generatePuzzle(difficulty, rng);
      const id = newId();
      open.set(id, { ...puzzle, createdAt: now() });
      prune();
      return { id, kind: puzzle.kind, difficulty: puzzle.difficulty, question: puzzle.question };
    },

    // Returns null when the puzzle is unknown, already answered or expired.
    answer(id, input) {
      const guess = parseAnswer(input);
      prune();
      const puzzle = open.get(id);
      if (!puzzle) return null;
      open.delete(id);
      return { correct: guess === puzzle.answer, solution: puzzle.answer, explanation: puzzle.explanation };
    },

    get size() {
      return open.size;
    },
  };
}

module.exports = { DIFFICULTIES, generatePuzzle, parseAnswer, createPuzzleStore };
