import assert from 'node:assert/strict';
import test from 'node:test';
import { addPermutations, addStake, parseFreeBaht, permutations } from './slip-lines';

test('tapping 50 three times on 123 accumulates to 150', () => {
  let lines = addStake([], 'TOP_3', '123', '50.0000');
  lines = addStake(lines, 'TOP_3', '123', '50.0000');
  lines = addStake(lines, 'TOP_3', '123', '50.0000');
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.amount, '150.0000');
  const other = addStake(lines, 'TOP_3', '456', '100.0000');
  assert.equal(other.find((line) => line.number === '123')?.amount, '150.0000');
  assert.equal(other.find((line) => line.number === '456')?.amount, '100.0000');
});

test('123 expands once to six unique permutations and repeated digits stay unique', () => {
  assert.deepEqual(permutations('123'), ['123', '132', '213', '231', '312', '321']);
  assert.deepEqual(permutations('12'), ['12', '21']);
  assert.deepEqual(permutations('11'), ['11']);
  assert.deepEqual(permutations('112'), ['112', '121', '211']);
  assert.deepEqual(permutations('7'), []);
  const lines = addPermutations([], 'TOP_3', '123', '50.0000');
  assert.equal(lines.length, 6);
  assert.equal(lines.every((line) => line.amount === '50.0000'), true);
});

test('a free amount keeps two decimal places', () => {
  assert.equal(parseFreeBaht('123.5'), '123.5000');
  assert.equal(parseFreeBaht('123.50'), '123.5000');
  assert.equal(parseFreeBaht('123.501'), null);
  assert.equal(parseFreeBaht(''), null);
});
