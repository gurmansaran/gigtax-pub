const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add PDF support to assets
config.resolver.assetExts.push('pdf');

// Ensure PDFs are not treated as source files
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== 'pdf');

module.exports = config;
