// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

/**
 * `three` resuelve su build CommonJS (`three.cjs`) para `require('three')` —lo que usa
 * @react-three/fiber/native— y ese build llama a `process.emitWarning`, que no existe en React
 * Native. Se fuerza el build ESM, que es el mismo código sin el aviso.
 */
const THREE_ESM = path.join(__dirname, 'node_modules/three/build/three.module.js');
const upstream = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: THREE_ESM };
  return upstream
    ? upstream(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
