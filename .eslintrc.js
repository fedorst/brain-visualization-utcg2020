module.exports = {
  "env": {
    "browser": true,
    "es2021": true,
  },
  "extends": [
    "plugin:react/recommended",
    "google",
  ],
  "parserOptions": {
    "ecmaFeatures": {
      "jsx": true,
    },
    "ecmaVersion": 12,
    "sourceType": "module",
  },
  "plugins": [
    "react",
  ],
  "rules": {
    "react/prop-types": 0,
    "quotes": ["error", "double"],
    "max-len": ["error", 120],
    "require-jsdoc": 0,
    "linebreak-style": 0,
    "no-invalid-this": 0,
    "func-style": ["error", "declaration", {"allowArrowFunctions": true}],
  },
};
