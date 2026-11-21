module.exports = {
  extends: ['@commitlint/config-conventional'],

  ignores: [
    (message) => {
      const title = message.split(/\r?\n/, 1)[0].trim();

      const mergeTitle = /^(?:[a-z]+(?:\([^)]+\))?: )?Merge (?:pull request #[0-9]+ from \S+|branch .+|remote-tracking branch .+|tag .+)$/i;

      return mergeTitle.test(title);
    },
  ],

  rules: {
    'body-max-line-length': [0],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'chore', 'test'],
    ],
  },
};
