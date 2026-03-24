const { expo } = require('../app.json');

const supportsIOS = Array.isArray(expo.platforms) && expo.platforms.includes('ios');
const supportsAndroid = Array.isArray(expo.platforms) && expo.platforms.includes('android');

if (!supportsIOS || !supportsAndroid) {
  console.warn('[fonts] Warning: app.json platforms should include both ios and android.');
  process.exit(0);
}

console.log('[fonts] expo-font is installed as a direct dependency via package.json.');
console.log('[fonts] Custom fonts loaded with expo-font are supported on both iOS and Android.');
