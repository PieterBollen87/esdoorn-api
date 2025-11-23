// check-versions.js
/**
 * Prints the actual installed version of each dependency.
 * Works for both direct and transitive packages.
 */

const depsDirect = ['express', 'cors', 'multer', 'sqlite3'];
const depsTransitive = [
  'rimraf',
  'glob',
  'are-we-there-yet',
  '@npmcli/move-file',
  'npmlog',
  'gauge',
  'promise-inflight'   // our replacement for inflight
];

function getVersion(pkgName) {
  try {
    // Some scoped packages need the full path, e.g. "@npmcli/move-file"
    // `require.resolve` finds the package folder, then we read its package.json.
    const pkgPath = require.resolve(`${pkgName}/package.json`);
    const pkg = require(pkgPath);
    return pkg.version || '???';
  } catch (e) {
    return 'NOT INSTALLED';
  }
}

console.log('--- Direct dependencies ---');
depsDirect.forEach(name => {
  console.log(`${name}: ${getVersion(name)}`);
});

console.log('\n--- Transitive (overridden) deps ---');
depsTransitive.forEach(name => {
  console.log(`${name}: ${getVersion(name)}`);
});