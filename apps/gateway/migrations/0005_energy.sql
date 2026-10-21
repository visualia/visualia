-- Measured energy, when the worker can measure it (m1-1: macmon on Apple Silicon).
--   energy_j      chip energy during the call (CPU + GPU + Neural Engine + memory)
--   energy_net_j  the same minus the chip's idle baseline: what the model used
--   sys_energy_j  whole-machine energy during the call
ALTER TABLE usage ADD COLUMN energy_j REAL;
ALTER TABLE usage ADD COLUMN energy_net_j REAL;
ALTER TABLE usage ADD COLUMN sys_energy_j REAL;
ALTER TABLE usage ADD COLUMN energy_source TEXT;
