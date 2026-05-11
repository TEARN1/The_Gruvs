const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drop console.* calls in production builds to reduce noise and bundle size
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    compress: {
      drop_console: process.env.NODE_ENV === 'production',
    },
  },
};

// Resolve .web.js before .js for web-specific overrides
config.resolver = {
  ...config.resolver,
  platforms: ['ios', 'android', 'web'],
};

module.exports = config;
