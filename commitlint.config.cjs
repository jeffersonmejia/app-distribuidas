module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs']],
  },
  ignores: [(message) => /^Integrar .+ en develop \(#\d+\)(?:\r?\n|$)/.test(message)],
};
