/**
 * `server-only` throws on import unless the bundler sets the `react-server`
 * export condition. Vitest doesn't, so it is aliased to this no-op.
 *
 * The guard still does its real job — Next resolves the genuine package and
 * fails the build if a client component reaches a server module. This only
 * stops a unit test from tripping over a check aimed at the bundler.
 */
export {};
