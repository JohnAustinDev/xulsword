export default (api) => {
  const development = api.env(['development', 'test']);

  return {
    presets: [
      //'@babel/preset-env', --> this is set by webpack.config.mjs
      // Babel 8 defaults onlyRemoveTypeImports to true, which keeps imports
      // of type-only names unless they use `import type`. This code base
      // doesn't use verbatimModuleSyntax, so remove them as Babel 7 did.
      ['@babel/preset-typescript', { onlyRemoveTypeImports: false }],
    ],
    plugins: [
      ...(development
        ? ['@babel/plugin-transform-runtime']
        : [
            // production
            '@babel/plugin-transform-react-constant-elements',
            '@babel/plugin-transform-react-inline-elements',
            'babel-plugin-transform-react-remove-prop-types',
          ]),
    ],
  };
};
