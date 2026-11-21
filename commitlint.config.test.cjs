const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('@commitlint/load').default;
const lint = require('@commitlint/lint').default;
const config = require('./commitlint.config.cjs');

const isIgnored = (message) => config.ignores.some((ignore) => ignore(message));

test('ignores GitHub merge commit headers, including historical conventional prefixes', () => {
  assert.equal(isIgnored('Merge pull request #63 from jeffersonmejia/develop'), true);
  assert.equal(isIgnored('chore: Merge pull request #63 from jeffersonmejia/develop'), true);
});

test('ignores standard Git merge commit headers', () => {
  assert.equal(isIgnored("Merge branch 'develop' into feature"), true);
  assert.equal(isIgnored("Merge remote-tracking branch 'origin/develop'"), true);
  assert.equal(isIgnored("Merge tag 'v1.2.3'"), true);
});

test('does not ignore partial or unrelated merge-title matches', () => {
  assert.equal(isIgnored('fix: referencia a Merge pull request #63 from example/repo'), false);
  assert.equal(isIgnored('Merge pull request #63 from'), false);
  assert.equal(isIgnored('chore: merge cleanup'), false);
});

test('accepts conventional commits and rejects invalid types and subject case', async () => {
  const loaded = await load({}, { cwd: process.cwd() });
  const valid = await lint('feat(crm): agrega clientes', loaded.rules, { plugins: loaded.plugins });
  const validTest = await lint('test(identity): agrega pruebas de sesion', loaded.rules, { plugins: loaded.plugins });
  const longFooter = await lint(`chore: prueba\n\nCo-authored-by: ${'a'.repeat(120)}`, loaded.rules, { plugins: loaded.plugins });
  const invalidType = await lint('build: agrega clientes', loaded.rules, { plugins: loaded.plugins });
  const invalidSubjectCase = await lint('feat(crm): Agrega clientes', loaded.rules, { plugins: loaded.plugins });

  assert.equal(valid.valid, true);
  assert.equal(validTest.valid, true);
  assert.equal(longFooter.valid, true);
  assert.equal(invalidType.valid, false);
  assert.equal(invalidSubjectCase.valid, false);
  assert.deepEqual(config.rules['body-max-line-length'], [0]);
  assert.deepEqual(config.rules['footer-max-line-length'], [0]);
});
