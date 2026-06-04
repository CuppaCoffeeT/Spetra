const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = config.resolver.assetExts || [];
config.resolver.sourceExts = config.resolver.sourceExts || [];

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

if (config.resolver.sourceExts.includes('wasm')) {
  config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== 'wasm');
}

// The standalone Vite web viewer lives in /web with its own node_modules.
// Keep Metro out of it to avoid haste/module collisions.
config.resolver.blockList = [/\/web\/.*/];

module.exports = config;
