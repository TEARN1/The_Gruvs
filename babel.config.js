// Standard Expo Babel config. Metro already applies babel-preset-expo by
// default; making it explicit here is what Jest's babel-jest transform needs
// to parse React Native / JSX / Flow syntax. App build behaviour is unchanged.
module.exports = function (api) {
  const isProd = api.env('production');
  api.cache.using(() => isProd);
  return {
    presets: ['babel-preset-expo'],
    // Prod-only: drop console.log/debug/info (keep warn/error so real
    // failures still surface in the browser console / crash reports).
    plugins: isProd
      ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
      : [],
  };
};
