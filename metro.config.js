const path = require('path');
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
  // Redirect native-only packages to web stubs so the web bundle doesn't crash
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'web') {
      if (moduleName === 'react-native-maps') {
        return { filePath: path.resolve(__dirname, 'src/shims/react-native-maps-web.js'), type: 'sourceFile' };
      }
      // react-native-svg and its QR wrapper crash the web bundle — redirect to stubs
      if (moduleName === 'react-native-svg') {
        return { filePath: path.resolve(__dirname, 'src/shims/react-native-svg-web.js'), type: 'sourceFile' };
      }
      if (moduleName === 'react-native-qrcode-svg') {
        return { filePath: path.resolve(__dirname, 'src/shims/react-native-qrcode-svg-web.js'), type: 'sourceFile' };
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
