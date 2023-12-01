module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: 'standard',
  plugins: ['jest'],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [
        '.eslintrc.{js,cjs}',
      ],
      parserOptions: {
        sourceType: 'script'
      }
    },
    {
      env: {
        jest: true
      },
      files: [
        '**/*.test.js'
      ],
      plugins: ['jest'],
      extends: ['plugin:jest/recommended']
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {}
}
