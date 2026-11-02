// Visualia Pool's shared code (plans/pool.md, plans/worker-app.md; the app is apps/pool-app).
//   core    decisions only, no I/O (also builds for wasm32)
//   native  the talking: pool, Ollama, macmon (meter)
pub mod core;
#[cfg(feature = "native")]
pub mod meter;
#[cfg(feature = "native")]
pub mod native;
