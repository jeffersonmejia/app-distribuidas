module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (message) => new Set([
      'Promover develop a main (#58)',
      'Integrar Jefferson en develop (#49)',
      'Integrar Jefferson en develop (#57)',
      'chore: integra Jefferson en develop (#64)',
      'chore: integra Jefferson en develop (#65)',
      'chore: Merge pull request #63 from jeffersonmejia/develop',
    ]).has(message.split(/\r?\n/, 1)[0]),
  ],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'chore']],
  },
};
