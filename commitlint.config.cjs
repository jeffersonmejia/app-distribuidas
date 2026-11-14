module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (commit) => commit.subject === 'Promover develop a main (#58)',
  ],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'chore']],
  },
};
