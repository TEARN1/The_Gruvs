// Standard Expo Babel config. Metro already applies babel-preset-expo by
// default; making it explicit here is what Jest's babel-jest transform needs
// to parse React Native / JSX / Flow syntax. App build behaviour is unchanged.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
