module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: [
    'dist/**',
    'android/**',
    '.expo/**',
    'node_modules/**',
    'coverage/**',
  ],
  rules: {
    'react/display-name': 'off',
    'import/namespace': 'off',
    'import/no-duplicates': 'off',
    'react/no-unescaped-entities': 'off',
    'import/no-unresolved': [
      'off',
      {
        ignore: ['^@env$'],
      },
    ],
  },
};
