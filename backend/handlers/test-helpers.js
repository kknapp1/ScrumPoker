/**
 * Test helper — handlers (and lib/broadcast.js, which itself destructures
 * deleteConnection from lib/db.js) capture their imports at module-load
 * time, so mocking a module's exported methods only takes effect for code
 * required AFTER the mock is set up. freshRequire clears the cache for
 * the given path (and any extra paths whose own destructuring needs to
 * pick up a fresh mock) before requiring it again.
 *
 * Never pass lib/db.js or lib/broadcast.js itself as the *target* here —
 * those are the modules tests call t.mock.method on directly, and must
 * stay the same object instance for the mock to be visible to anything
 * that imports them without being cache-cleared.
 */
function freshRequire(modulePath, extraCacheClears = []) {
  delete require.cache[require.resolve(modulePath)]
  for (const p of extraCacheClears) {
    delete require.cache[require.resolve(p)]
  }
  return require(modulePath)
}

module.exports = { freshRequire }
