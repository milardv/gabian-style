export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export function createFlight(x = 0, z = 0, altitude = 120, heading = Math.PI / 2) {
  return { x, z, altitude, heading, speed: 14, roll: 0, gamma: 0, pitch: 0, flap: 0, thrust: 0, boost:false, nitro:false, stalled: false, collided: false, boundaryHit: false, time: 0, climb: 0 };
}
// A point-mass flight model with automatic pitch trim. Parameters are illustrative
// gull-scale values, not measurements of a specific Larus michahellis individual.
export function stepFlight(s, input, dt, environment = {}) {
  const mass = 1.0, gravity = 9.81, density = 1.225, wingArea = 0.25;
  s.time += dt;
  s.roll = approach(s.roll, clamp(input.turn || 0, -1, 1) * 1.02, 3.5, dt);
  const q = 0.5 * density * s.speed * s.speed;
  const desiredGamma = (input.climb || 0) * 0.43 + (input.glide ? -0.065 : 0);
  const gammaRate = clamp((desiredGamma - s.gamma) * 1.1, -0.35, 0.35);
  const requiredCl = (mass * gravity * Math.cos(s.gamma) + mass * s.speed * gammaRate) / Math.max(0.5, q * wingArea * Math.cos(s.roll));
  const cl = clamp(requiredCl, 0.005, 1.6);
  const lift = q * wingArea * cl;
  const drag = q * wingArea * (0.035 + 0.06 * cl * cl) + 0.001 * s.speed * s.speed;
  const nitro = !!input.nitro;
  const targetSpeed = nitro ? 100 : clamp(input.targetSpeed || 14, 6, input.boost ? 62 : 28);
  const maxThrust = nitro ? 140 : input.boost ? 42 : 6;
  s.nitro = nitro;
  s.boost = !!input.boost;
  s.thrust = input.glide && !nitro ? 0 : clamp(drag + mass * gravity * Math.sin(s.gamma) + (targetSpeed - s.speed) * 0.9, 0, maxThrust);
  const speedCeiling = nitro ? 110 : input.boost ? Math.max(70, s.speed) : Math.max(34, s.speed);
  s.speed = clamp(s.speed + (s.thrust - drag - mass * gravity * Math.sin(s.gamma)) / mass * dt, 3, speedCeiling);
  s.gamma = clamp(s.gamma + (lift * Math.cos(s.roll) - mass * gravity * Math.cos(s.gamma)) / (mass * Math.max(s.speed, 3)) * dt, -0.75, 0.6);
  s.heading += lift * Math.sin(s.roll) / (mass * Math.max(s.speed * Math.cos(s.gamma), 3)) * dt;
  s.pitch = s.gamma + cl / 6.2;
  s.stalled = requiredCl > 1.6 || s.speed < 6.5;
  s.flap = approach(s.flap, input.glide && !nitro ? 0 : clamp(s.thrust / 3.5, 0, 1), 2.5, dt);
  const wind = environment.wind || [0, 0];
  const horizontal = s.speed * Math.cos(s.gamma);
  const nextX = s.x + (Math.sin(s.heading) * horizontal + wind[0]) * dt;
  const nextZ = s.z + (-Math.cos(s.heading) * horizontal + wind[1]) * dt;
  s.boundaryHit = !!environment.contains && !environment.contains(nextX, nextZ);
  if (s.boundaryHit) { s.heading += Math.PI; s.roll = 0; }
  else { s.x = nextX; s.z = nextZ; }
  s.climb = s.speed * Math.sin(s.gamma) + (environment.updraft || 0);
  s.altitude += s.climb * dt;
  const surface = environment.surface?.(s.x, s.z) ?? -1000;
  if (s.altitude < surface + 1.2) { s.altitude = surface + 1.2; s.collided = true; }
  return s;
}
