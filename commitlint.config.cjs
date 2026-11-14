module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (commit) => commit.header.split(/\r?\n/, 1)[0] === 'Promover develop a main (#58)',
  ],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'chore']],
  },
};
