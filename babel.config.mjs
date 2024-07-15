export default (api) => {
  const development = api.env(['development', 'test']);

  return {
    presets: [
      //'@babel/preset-env', --> this is set by webpack.config.mjs
      '@babel/preset-typescript',
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
