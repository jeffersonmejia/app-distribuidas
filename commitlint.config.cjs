module.exports = {
  extends: ['@commitlint/config-conventional'],

  ignores: [
    (message) => {
      const title = message.split(/\r?\n/, 1)[0].trim();

      return /^Merge pull request #\d+ from [^\s]+$/.test(title);
    },
  ],

  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'chore'],
    ],
  },
};
