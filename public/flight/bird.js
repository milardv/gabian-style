import * as T from '../vendor/three/three.core.js';
const white = new T.MeshStandardMaterial({ color: '#f5f3e9', roughness: .8 });
const grey = new T.MeshStandardMaterial({ color: '#aeb5b6', roughness: .85, side: T.DoubleSide });
const black = new T.MeshStandardMaterial({ color: '#252c30', roughness: .9, side: T.DoubleSide });
const gold = new T.MeshStandardMaterial({ color: '#d8ae38', roughness: .65 });
function wingSurface(points, material) {
  const shape = new T.Shape(points.map(p => new T.Vector2(...p)));
  const geometry = new T.ShapeGeometry(shape);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) { const x = position.getX(i), z = position.getY(i); position.setXYZ(i, x, Math.sin(x * 5) * .025, z); }
  geometry.computeVertexNormals();
  return new T.Mesh(geometry, material);
}
export function createGabian() {
  const root = new T.Group();
  root.scale.setScalar(1.65);
  function ellipsoid(material, scale, position) {
    const mesh = new T.Mesh(new T.SphereGeometry(1, 24, 16), material); mesh.scale.set(...scale); mesh.position.set(...position); root.add(mesh); return mesh;
  }
  ellipsoid(white, [.084, .10, .25], [0, 0, 0]);
  ellipsoid(grey, [.081, .055, .2], [0, .073, .015]);
  ellipsoid(white, [.055, .065, .082], [0, .07, -.265]);
  for (const side of [-1, 1]) {
    ellipsoid(gold, [.004, .009, .009], [side * .048, .085, -.286]);
    ellipsoid(black, [.0045, .005, .005], [side * .051, .085, -.289]);
  }
  const beak = new T.Mesh(new T.ConeGeometry(.021, .105, 12), gold); beak.rotation.x = -Math.PI / 2; beak.position.set(0, .057, -.369); root.add(beak);
  const wings = [];
  for (const side of [-1, 1]) {
    const shoulder = new T.Group(); shoulder.position.set(side * .055, .05, -.04); shoulder.scale.x = side; root.add(shoulder);
    shoulder.add(wingSurface([[0,-.115],[.18,-.10],[.32,-.03],[.34,.08],[.13,.12],[0,.075]], grey));
    const hand = new T.Group(); hand.position.set(.30, 0, .015); shoulder.add(hand);
    hand.add(wingSurface([[0,-.05],[.16,-.012],[.33,.07],[.39,.20],[.24,.21],[.07,.14],[0,.08]], grey));
    for (let feather = 0; feather < 6; feather++) {
      const x = .16 + feather * .035, z = .07 + feather * .018;
      hand.add(wingSurface([[x,z],[x+.06,z+.017],[x+.11,z+.095],[x+.08,z+.13],[x+.022,z+.10]], feather > 1 ? black : grey));
    }
    wings.push({ shoulder, hand, side });
    const leg = new T.Mesh(new T.CylinderGeometry(.006, .005, .07, 6), gold); leg.rotation.x = -.6; leg.position.set(side * .035, -.075, .12); root.add(leg);
  }
  const tail = wingSurface([[-.06,.18],[.06,.18],[.11,.37],[-.11,.37]], white); root.add(tail);
  return { root, scatterFeathers(scene) {
    const plume = [];
    const materials = [white, grey, black];
    for (let i = 0; i < 16; i++) {
      const feather = new T.Mesh(new T.PlaneGeometry(.055, .22), materials[i % materials.length].clone());
      feather.position.copy(root.position).add(new T.Vector3((Math.random() - .5) * .48, (Math.random() - .5) * .28, (Math.random() - .5) * .5));
      feather.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(feather);
      plume.push({ mesh: feather, vx: (Math.random() - .5) * 5, vy: 2 + Math.random() * 5, vz: (Math.random() - .5) * 5, spin: (Math.random() - .5) * 9, age: 0 });
    }
    return plume;
  }, animate(state) {
    root.position.set(state.x, state.altitude, state.z);
    root.rotation.set(state.pitch, -state.heading, -state.roll, 'YXZ');
    const phase = state.time * Math.PI * 2 * 3.4;
    for (const { shoulder, hand, side } of wings) {
      shoulder.rotation.z = side * (.065 + state.flap * Math.sin(phase) * .62);
      hand.rotation.z = side * (state.flap * Math.sin(phase - .6) * .24);
      hand.rotation.y = -.04 - state.flap * (1 + Math.cos(phase)) * .06;
    }
  } };
}
