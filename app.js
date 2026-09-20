import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

/* ---------------- state ---------------- */
const state = { metal: 'yellow', profile: 'court', width: 2.8, size: '6.5', shape: 'round', carat: 1.0, setting: 'prong' };

const METALS = {
  yellow:   { label: 'Yellow gold', color: 0xe3b968, roughness: 0.13, css: '#e3b968' },
  white:    { label: 'White gold',  color: 0xeeece4, roughness: 0.11, css: '#eeece4' },
  rose:     { label: 'Rose gold',   color: 0xe0a284, roughness: 0.13, css: '#e0a284' },
  platinum: { label: 'Platinum',    color: 0xe2e3e0, roughness: 0.17, css: '#e2e3e0' },
};
const PROFILES = { flat: 'Flat', court: 'Court', bevel: 'Bevelled' };
const SETTINGS = { prong: 'Solitaire', halo: 'Halo', bezel: 'Bezel', pave: 'Pavé band' };
const SHAPES = { round: 'Round', oval: 'Oval', princess: 'Princess', emerald: 'Emerald', pear: 'Pear' };
const SIZES = ['4','4.5','5','5.5','6','6.5','7','7.5','8','8.5','9'];
const SIZE_MM = { '4':14.9,'4.5':15.3,'5':15.7,'5.5':16.1,'6':16.5,'6.5':16.9,'7':17.3,'7.5':17.7,'8':18.1,'8.5':18.5,'9':19.0 };
const SHAPE_WIDTH_1CT = { round: 6.5, oval: 5.5, princess: 5.5, emerald: 5.5, pear: 5.5 };
const BAND_T = 1.6;

function loadFromHash() {
  try {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('metal') && METALS[h.get('metal')]) state.metal = h.get('metal');
    if (h.get('profile') && PROFILES[h.get('profile')]) state.profile = h.get('profile');
    if (h.get('width')) state.width = Math.min(6, Math.max(1.5, parseFloat(h.get('width'))));
    if (h.get('size') && SIZE_MM[h.get('size')]) state.size = h.get('size');
    if (h.get('shape') && SHAPES[h.get('shape')]) state.shape = h.get('shape');
    if (h.get('carat')) state.carat = Math.min(3, Math.max(0.3, parseFloat(h.get('carat'))));
    if (h.get('setting') && SETTINGS[h.get('setting')]) state.setting = h.get('setting');
  } catch (e) {}
}
loadFromHash();

/* ---------------- renderer / scene ---------------- */
const container = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6f4ef);

// jewelry-studio environment: dark room, bright strip softboxes -> crisp facet fire
function studioEnv() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x0c0c0c);
  const geo = new THREE.PlaneGeometry(1, 1);
  function panel(w, h, x, y, z, i) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide }));
    m.scale.set(w, h, 1); m.position.set(x, y, z); m.lookAt(0, 0,0); s.add(m);
  }
  panel(30, 7, -20, 9, -6, 7.0);  // left strip softbox
  panel(30, 7,  20, 7,  8, 6.0);  // right strip softbox
  panel(26, 26,  0, 26, 2, 4.6);  // overhead softbox
  panel(18, 8,   0, 2, 22, 2.4);  // front fill card
  panel(14, 14,  -12, -16, 10, 1.8);
  panel(90, 45,  12, 14, 44, 1.7); // big bright wall behind camera
  panel(90, 90,  0, -24, 0, 1.5);  // pale studio floor bounce
  return s;
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(studioEnv(), 0.04).texture;

// dedicated stone environment: mid-gray field + many bright strips -> scintillation
function diamondEnv() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x3a3a3f);
  const geo = new THREE.PlaneGeometry(1, 1);
  function panel(w, h, x, y, z, i) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide }));
    m.scale.set(w, h, 1); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  }
  panel(40, 10, -24, 12, -8, 9.0);
  panel(40, 10,  24, 9, 10, 8.0);
  panel(26, 26,  0, 30, 0, 7.0);
  panel(20, 6,   0, -4, 26, 6.0);
  panel(20, 6,  -8, 20, 22, 5.0);
  panel(20, 6,  10, -18, -20, 4.0);
  panel(16, 16, -26, -10, 12, 4.5);
  panel(16, 16,  26, 22, -14, 4.5);
  return s;
}
const DIAMOND_ENV = pmrem.fromScene(diamondEnv(), 0.02).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 1, 500);
camera.position.set(33, 23, 53);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;
controls.minDistance = 20;
controls.maxDistance = 110;
controls.enablePan = false;

const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(8, 30, 14);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 10;
key.shadow.bias = -0.0004;
Object.assign(key.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 5, far: 80 });
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
scene.add(new THREE.AmbientLight(0xfff8ee, 0.32));

const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShadowMaterial({ opacity: 0.15 }));
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

/* ---------------- materials ---------------- */
function metalMaterial() {
  const m = METALS[state.metal];
  return new THREE.MeshPhysicalMaterial({ color: m.color, metalness: 1.0, roughness: m.roughness, envMapIntensity: 1.55 });
}
function stoneMaterial() {
  // thin transmissive shell
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.0,
    transmission: 1.0, thickness: 0.4, ior: 1.5,
    clearcoat: 1.0, clearcoatRoughness: 0.0,
    specularIntensity: 1.0, envMapIntensity: 2.4,
    flatShading: true,
  });
  if ('dispersion' in mat) mat.dispersion = 2.0;
  return mat;
}
function stoneCoreMaterial() {
  // fake total internal reflection: bright faceted metallic core
  return new THREE.MeshPhysicalMaterial({
    color: 0xf4f7fc, metalness: 1.0, roughness: 0.03,
    envMap: DIAMOND_ENV, envMapIntensity: 2.6, flatShading: true,
  });
}

/* ---------------- band ---------------- */
function bandOutline(profile, w, t) {
  const pts = [];
  const edge = Math.min(0.14, w * 0.06);
  pts.push([-w / 2, 0], [-w / 2 + edge, 0], [w / 2 - edge, 0], [w / 2, 0]);
  if (profile === 'flat') {
    const cr = Math.min(0.16, t * 0.22);
    for (let i = 1; i <= 3; i++) { const a = (i / 4) * Math.PI / 2; pts.push([w / 2 - cr + Math.sin(a) * cr, t - cr + (1 - Math.cos(a)) * cr]); }
    pts.push([w / 2, t], [-w / 2, t]);
    for (let i = 1; i <= 3; i++) { const a = (i / 4) * Math.PI / 2; pts.push([-w / 2 + cr - Math.sin(a) * cr, t - cr + (1 - Math.cos(a)) * cr]); }
    pts.push([-w / 2, 0]);
  } else if (profile === 'court') {
    const n = 24;
    for (let i = 1; i <= n; i++) { const y = w / 2 - (i / n) * w; const u = (2 * y) / w; pts.push([y, t * Math.sqrt(Math.max(0, 1 - u * u))]); }
  } else {
    const c = Math.min(w * 0.22, t * 0.45);
    pts.push([w / 2, t - c], [w / 2 - c, t], [-w / 2 + c, t], [-w / 2, t - c], [-w / 2, 0]);
  }
  return pts;
}
function buildBand() {
  const Ri = SIZE_MM[state.size] / 2;
  const pts = bandOutline(state.profile, state.width, BAND_T).map(([y, z]) => new THREE.Vector2(Ri + z, y));
  const geo = new THREE.LatheGeometry(pts, 180);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, metalMaterial());
  mesh.castShadow = true;
  return mesh;
}

/* ---------------- gem geometry ---------------- */
function outlineWarp(shape, x, y) { // normalized coords, returns warped normalized
  if (shape === 'oval') return [x * 1.45, y];
  if (shape === 'pear') {
    if (y < 0) { const k = -y; return [x * (1 - 0.62 * k * k), y * (1 + 0.8 * k)]; }
    return [x * (1 + 0.06 * y), y];
  }
  return [x, y];
}
function unitOutline(shape, per) { // array of [x,y], |.|~1
  const pts = [];
  if (shape === 'princess') {
    const corners = [[1,1],[-1,1],[-1,-1],[1,-1]];
    for (let s = 0; s < 4; s++) for (let i = 0; i < per; i++) {
      const u = i / per, [x0,y0] = corners[s], [x1,y1] = corners[(s+1)%4];
      pts.push([x0 + (x1-x0)*u, y0 + (y1-y0)*u]);
    }
  } else if (shape === 'emerald') {
    const W = 1.35, H = 1, c = 0.34;
    const corners = [[W-c,H],[W,H-c],[W,-H+c],[W-c,-H],[-W+c,-H],[-W,-H+c],[-W,H-c],[-W+c,H]];
    for (let s = 0; s < corners.length; s++) for (let i = 0; i < per; i++) {
      const u = i / per, [x0,y0] = corners[s], [x1,y1] = corners[(s+1)%corners.length];
      pts.push([x0 + (x1-x0)*u, y0 + (y1-y0)*u]);
    }
  }
  return pts;
}
function girdleOutline(shape, R) { // mm coords
  const pts = [];
  if (shape === 'princess') return unitOutline('princess', 10).map(([x,y]) => [x * R, y * R]);
  if (shape === 'emerald') return unitOutline('emerald', 4).map(([x,y]) => [x * R / 1.35, y * R / 1.35]);
  const N = 64;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const [wx, wy] = outlineWarp(shape, Math.cos(a), Math.sin(a));
    pts.push([wx * R, wy * R]);
  }
  return pts;
}

function buildBrilliantGeo(shape, R, hc, hp) {
  // true round-brilliant topology: table, 8 stars, 8 bezels, 16 upper girdle,
  // 16 lower girdle, 8 pavilion mains, culet. Oval/pear via outline warp.
  const rt = 0.55 * R, rm = 0.80 * R, zm = 0.5 * hc, rl = 0.42 * R, zl = -0.55 * hp;
  const pos = [];
  const W = (r, a, z) => { const [x, y] = outlineWarp(shape, Math.cos(a) * r / R, Math.sin(a) * r / R); return [x * R, z, y * R]; };
  const T = k => W(rt, k * Math.PI / 4, hc);
  const M = k => W(rm, k * Math.PI / 4 + Math.PI / 8, zm);
  const G = j => W(R, j * Math.PI / 8, 0);
  const L = k => W(rl, k * Math.PI / 4 + Math.PI / 8, zl);
  const C = [0, -hp, 0];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  for (let k = 0; k < 8; k++) {
    const k1 = (k + 1) % 8, km = (k + 7) % 8;
    tri([0, hc, 0], T(k1), T(k));                    // table
    tri(T(k), T(k1), M(k));                          // star
    tri(T(k), M(k), G(2 * k));                       // bezel 1/2
    tri(T(k), G(2 * k), M(km));                      // bezel 2/2
    tri(M(k), G(2 * k), G(2 * k + 1));               // upper girdle
    tri(M(k), G(2 * k + 1), G((2 * k + 2) % 16));    // upper girdle
    tri(G(2 * k), L(km), G(2 * k + 1));              // lower girdle
    tri(G(2 * k + 1), L(km), L(k));                  // wait - keep simple pairs below
  }
  // rebuild pavilion cleanly (lower girdle + mains) to avoid seam mistakes
  pos.length = 0;
  for (let k = 0; k < 8; k++) {
    const k1 = (k + 1) % 8, km = (k + 7) % 8;
    tri([0, hc, 0], T(k1), T(k));                    // table
    tri(T(k), T(k1), M(k));                          // star
    tri(T(k), M(k), G(2 * k));                       // bezel
    tri(T(k), G(2 * k), M(km));                      // bezel
    tri(M(k), G(2 * k), G(2 * k + 1));               // upper girdle
    tri(M(k), G(2 * k + 1), G((2 * k + 2) % 16));    // upper girdle
  }
  for (let j = 0; j < 16; j++) {
    const j1 = (j + 1) % 16;
    const lk = Math.floor(j / 2);                    // L apex nearest this girdle segment
    tri(G(j), G(j1), L(lk));                         // lower girdle
  }
  for (let k = 0; k < 8; k++) {
    tri(L(k), L((k + 1) % 8), C);                    // pavilion mains
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildRingStackGeo(outlineMM, rings) {
  // outlineMM: [[x,y]...] in mm at scale 1.0; rings: [scale, z]
  const N = outlineMM.length, pos = [];
  const pt = (ri, i) => { const [s, z] = rings[ri]; const [x, y] = outlineMM[i % N]; return [x * s, z, y * s]; };
  for (let ri = 0; ri < rings.length - 1; ri++) for (let i = 0; i < N; i++) {
    const a = pt(ri, i), b = pt(ri, i + 1), c = pt(ri + 1, i + 1), e = pt(ri + 1, i);
    pos.push(...a, ...b, ...c, ...a, ...c, ...e);
  }
  const topZ = rings[rings.length - 1][1], botZ = rings[0][1];
  for (let i = 0; i < N; i++) {
    pos.push(0, topZ, 0, ...pt(rings.length - 1, i + 1), ...pt(rings.length - 1, i));  // table cap
    pos.push(0, botZ, 0, ...pt(0, i), ...pt(0, i + 1));                                 // culet cap
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildStone() {
  const d = SHAPE_WIDTH_1CT[state.shape] * Math.cbrt(state.carat);
  const R = d / 2;
  let geo, hc, hp;
  if (state.shape === 'round' || state.shape === 'oval' || state.shape === 'pear') {
    hc = 0.15 * d; hp = 0.44 * d;
    geo = buildBrilliantGeo(state.shape, R, hc, hp);
  } else if (state.shape === 'princess') {
    hc = 0.16 * d; hp = 0.50 * d;
    const ol = unitOutline('princess', 2).map(([x,y]) => [x * R, y * R]);
    geo = buildRingStackGeo(ol, [[0.03,-hp],[0.40,-0.68*hp],[0.72,-0.34*hp],[1.0,0],[0.78,0.5*hc],[0.52,hc]]);
  } else { // emerald step cut
    hc = 0.13 * d; hp = 0.42 * d;
    const ol = unitOutline('emerald', 4).map(([x,y]) => [x * R / 1.35, y * R / 1.35]);
    geo = buildRingStackGeo(ol, [[0.12,-hp],[0.35,-0.85*hp],[0.60,-0.58*hp],[0.82,-0.28*hp],[1.0,0],[0.80,0.5*hc],[0.58,hc]]);
  }
  const mesh = new THREE.Mesh(geo, stoneMaterial());
  mesh.castShadow = true;
  const core = new THREE.Mesh(geo, stoneCoreMaterial());
  core.scale.setScalar(0.90);
  mesh.add(core);
  return { mesh, d, R, hc, hp, outline: girdleOutline(state.shape, R) };
}

function extentAt(shape, R, aDeg) {
  const over = { round: 1.0, oval: 1.16, pear: 1.05, princess: 1.30, emerald: 1.02 };
  return R * over[shape];
}
function maxExtent(outline) { return Math.max(...outline.map(([x,y]) => Math.hypot(x, y))); }

/* ---------------- settings ---------------- */
function buildSetting(stone, Ri) {
  const g = new THREE.Group();
  const metal = metalMaterial();
  const { mesh: stoneMesh, d, R, hc, hp, outline } = stone;
  const bandTopY = Ri + BAND_T;
  const gemMat = stoneMaterial();

  let gy;
  g.userData.gyLocal = 0;
  if (state.setting === 'prong' || state.setting === 'pave') {
    gy = bandTopY + 1.2 + hp;
    g.userData.gyLocal = gy;
    stoneMesh.position.y = gy;
    g.add(stoneMesh);
    const nProngs = (state.shape === 'round' && state.carat >= 1.5) ? 6 : 4;
    const prongR = Math.max(0.18, d * 0.028);
    const pr = extentAt(state.shape, R, 45);
    for (let i = 0; i < nProngs; i++) {
      const a = (i / nProngs) * Math.PI * 2 + Math.PI / nProngs;
      const ca = Math.cos(a), sa = Math.sin(a);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(ca * pr * 0.45, gy - hp * 0.8, sa * pr * 0.45),
        new THREE.Vector3(ca * pr * 1.06, gy - 0.01 * d, sa * pr * 1.06),
        new THREE.Vector3(ca * pr * 0.90, gy + 0.10 * d, sa * pr * 0.90)
      );
      const prong = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, prongR, 8, false), metal);
      prong.castShadow = true;
      g.add(prong);
    }
  } else if (state.setting === 'halo') {
    gy = bandTopY + 0.6 + hp * 0.8;
    g.userData.gyLocal = gy;
    stoneMesh.position.y = gy;
    g.add(stoneMesh);
    const ext = maxExtent(outline);
    const nH = 16, sr = Math.max(0.45, ext * 0.13);
    for (let i = 0; i < nH; i++) {
      const a = (i / nH) * Math.PI * 2;
      let hx, hy;
      if (state.shape === 'princess') { const ol = unitOutline('princess', 40); const idx = Math.floor((i / nH) * ol.length); [hx, hy] = ol[idx].map(v => v * R * 1.22); }
      else if (state.shape === 'emerald') { const ol = unitOutline('emerald', 40); const idx = Math.floor((i / nH) * ol.length); [hx, hy] = ol[idx].map(v => v * (R / 1.35) * 1.22); }
      else { const [wx, wy] = outlineWarp(state.shape, Math.cos(a), Math.sin(a)); hx = wx * R * 1.22; hy = wy * R * 1.22; }
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(sr, 1), gemMat);
      s.position.set(hx, gy - 0.06 * d, hy);
      s.scale.y = 0.7;
      g.add(s);
    }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(ext * 1.18 + sr * 0.6, ext * 0.6, 0.8, 48), metal);
    plate.position.y = gy - 0.06 * d - 0.4;
    plate.castShadow = true;
    g.add(plate);
  } else { // bezel
    gy = bandTopY + 0.3 + hp * 0.75;
    g.userData.gyLocal = gy;
    stoneMesh.position.y = gy;
    g.add(stoneMesh);
    const N = outline.length, pos = [];
    const loops = [
      outline.map(([x,y]) => [x * 1.09, y * 1.09, gy - 0.02 * d]),
      outline.map(([x,y]) => [x * 1.09, y * 1.09, gy + 0.085 * d]),
      outline.map(([x,y]) => [x * 0.965, y * 0.965, gy + 0.095 * d]),
    ];
    for (let li = 0; li < 2; li++) for (let i = 0; i < N; i++) {
      const [ax, ay, az] = loops[li][i], [bx, by, bz] = loops[li][(i + 1) % N];
      const [cx, cy, cz] = loops[li + 1][(i + 1) % N], [ex, ey, ez] = loops[li + 1][i];
      pos.push(ax, az, ay, bx, bz, by, cx, cz, cy, ax, az, ay, cx, cz, cy, ex, ez, ey);
    }
    const rimGeo = new THREE.BufferGeometry();
    rimGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rimGeo.computeVertexNormals();
    const rim = new THREE.Mesh(rimGeo, metal);
    rim.castShadow = true;
    g.add(rim);
    const ext = maxExtent(outline);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(ext * 0.9, ext * 0.55, hp * 0.7 + 0.6, 48), metal);
    cup.position.y = gy - hp * 0.45 - 0.2;
    cup.castShadow = true;
    g.add(cup);
  }

  if (state.setting === 'pave') {
    const count = Math.max(11, Math.round((2 * Math.PI * (Ri + BAND_T * 0.55)) / 2.4));
    const sr = state.width * 0.15;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const bead = new THREE.Mesh(new THREE.OctahedronGeometry(sr, 1), gemMat);
      const rad = Ri + BAND_T * 0.62;
      bead.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      bead.scale.y = 0.7;
      g.add(bead);
    }
  }
  return g;
}

/* ---------------- assemble ---------------- */
let ringGroup = null;
function rebuild() {
  if (ringGroup) {
    scene.remove(ringGroup);
    ringGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  const Ri = SIZE_MM[state.size] / 2;
  const inner = new THREE.Group();
  inner.add(buildBand());
  const stone = buildStone();
  const settingGroup = buildSetting(stone, Ri);
  inner.add(settingGroup);
  inner.rotation.x = Math.PI / 2;
  const wrap = new THREE.Group();
  wrap.add(inner);
  wrap.rotation.x = -0.52;
  wrap.rotation.y = 0.06;
  wrap.position.y = Ri + BAND_T + 0.25;
  ringGroup = wrap;
  scene.add(ringGroup);

  controls.target.set(0, Ri * 1.0, 1.5);
  key.target.position.set(0, Ri * 0.9, 0);
  key.target.updateMatrixWorld();
  if (bokehPass) {
    ringGroup.updateMatrixWorld(true);
    const head = new THREE.Vector3(0, settingGroup.userData.gyLocal || Ri + BAND_T + 2, 0).applyMatrix4(inner.matrixWorld);
    bokehPass.uniforms['focus'].value = camera.position.distanceTo(head);
  }

  const h = new URLSearchParams({ metal: state.metal, profile: state.profile, width: state.width, size: state.size, shape: state.shape, carat: state.carat, setting: state.setting });
  writingHash = true;
  history.replaceState(null, '', '#' + h.toString());
  setTimeout(() => writingHash = false, 0);

  updateSummary();
  updateVendors();
}

/* ---------------- UI ---------------- */
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function buildControls() {
  const metalWrap = document.getElementById('metal');
  Object.entries(METALS).forEach(([k, m]) => {
    const b = el('button', 'swatch' + (k === state.metal ? ' active' : ''));
    const dot = el('span', 'dot'); dot.style.background = m.css;
    b.appendChild(dot);
    b.appendChild(el('small', null, m.label.replace(' gold', '')));
    b.onclick = () => { state.metal = k; refreshActive(metalWrap, b); rebuild(); };
    metalWrap.appendChild(b);
  });
  const seg = (id, obj, key) => {
    const wrap = document.getElementById(id);
    Object.entries(obj).forEach(([k, label]) => {
      const b = el('button', k === state[key] ? 'active' : null, label);
      b.onclick = () => { state[key] = k; refreshActive(wrap, b); rebuild(); };
      wrap.appendChild(b);
    });
  };
  seg('profile', PROFILES, 'profile');
  seg('shape', SHAPES, 'shape');
  seg('setting', SETTINGS, 'setting');
  const sizeWrap = document.getElementById('ringsize');
  SIZES.forEach(s => {
    const b = el('button', s === state.size ? 'active' : null, s);
    b.onclick = () => { state.size = s; refreshActive(sizeWrap, b); rebuild(); };
    sizeWrap.appendChild(b);
  });
  const width = document.getElementById('width');
  width.oninput = () => { state.width = parseFloat(width.value); document.getElementById('widthVal').textContent = state.width.toFixed(1); rebuild(); };
  const carat = document.getElementById('carat');
  carat.oninput = () => { state.carat = parseFloat(carat.value); document.getElementById('caratVal').textContent = state.carat.toFixed(1); rebuild(); };
  width.value = state.width; carat.value = state.carat;
  document.getElementById('widthVal').textContent = state.width.toFixed(1);
  document.getElementById('caratVal').textContent = state.carat.toFixed(1);
}
function refreshActive(wrap, btn) { [...wrap.children].forEach(c => c.classList.remove('active')); btn.classList.add('active'); }

function updateSummary() {
  document.getElementById('summary').textContent =
    `${state.carat.toFixed(1)} ct ${SHAPES[state.shape].toLowerCase()} · ${METALS[state.metal].label} · ${PROFILES[state.profile].toLowerCase()} band ${state.width.toFixed(1)} mm · ${SETTINGS[state.setting].toLowerCase()}`;
}

/* ---------------- where to buy ---------------- */
const VENDOR_SHAPES = {
  round:    { ja: 'Round',    bn: 'round-cut',     be: 'Round' },
  oval:     { ja: 'Oval',     bn: 'oval-cut',      be: 'Oval' },
  princess: { ja: 'Princess', bn: 'princess-cut',  be: 'Princess' },
  emerald:  { ja: 'Emerald',  bn: 'emerald-cut',   be: 'Emerald' },
  pear:     { ja: 'Pear',     bn: 'pear-shaped',   be: 'Pear' },
};
const PRICE_BRACKETS = [
  { max: 0.6,  text: '$330 - $700' },
  { max: 1.1,  text: '$500 - $1,200' },
  { max: 1.6,  text: '$810 - $950' },
  { max: 2.1,  text: '$1,500 - $2,650' },
  { max: 3.1,  text: 'avg ~$2,200' },
];
function priceRange() {
  const b = PRICE_BRACKETS.find(b => state.carat <= b.max) || PRICE_BRACKETS[PRICE_BRACKETS.length - 1];
  return b.text;
}
function vendorLinks() {
  const v = VENDOR_SHAPES[state.shape];
  const lo = Math.max(0.2, state.carat - 0.15).toFixed(2);
  const hi = (state.carat + 0.15).toFixed(2);
  return [
    { name: 'James Allen', host: 'jamesallen.com',
      url: `https://www.jamesallen.com/loose-diamonds/all-diamonds/?Shape=${v.ja}&CaratFrom=${lo}&CaratTo=${hi}`,
      type: 'plain', typeLabel: 'Filtered deeplink (plain)' },
    { name: 'Blue Nile', host: 'bluenile.com',
      url: `https://www.bluenile.com/diamond-search?Shape=${v.bn}&CaratFrom=${lo}&CaratTo=${hi}`,
      type: 'ready', typeLabel: 'Affiliate-ready (a_aid params) - currently plain' },
    { name: 'Brilliant Earth', host: 'brilliantearth.com',
      url: `https://www.brilliantearth.com/loose-diamonds/search/?shapes=${v.be}&carat_min=${lo}&carat_max=${hi}`,
      type: 'ready', typeLabel: 'Affiliate program exists - currently plain' },
  ];
}
function updateVendors() {
  const tbody = document.querySelector('#vendorTable tbody');
  tbody.innerHTML = '';
  vendorLinks().forEach(v => {
    const tr = el('tr');
    const tdName = el('td');
    tdName.appendChild(el('div', 'vname', v.name));
    tdName.appendChild(el('div', 'vurl', v.host));
    tr.appendChild(tdName);
    tr.appendChild(el('td', null, `${SHAPES[state.shape]} ${state.carat.toFixed(1)} ct`));
    tr.appendChild(el('td', 'price', priceRange()));
    const tdT = el('td');
    tdT.appendChild(el('span', 'badge ' + (v.type === 'ready' ? 'ready' : 'plain'), v.typeLabel));
    tr.appendChild(tdT);
    const tdC = el('td');
    const a = el('a', 'cta', 'View stones →');
    a.href = v.url; a.target = '_blank'; a.rel = 'noopener';
    tdC.appendChild(a);
    tr.appendChild(tdC);
    tbody.appendChild(tr);
  });
}

/* ---------------- composer (cinematic DOF on desktop) ---------------- */
let composer = null, bokehPass = null;
const wantsDOF = !matchMedia('(max-width: 768px)').matches;
if (wantsDOF) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bokehPass = new BokehPass(scene, camera, { focus: 52, aperture: 0.00022, maxblur: 0.006 });
  composer.addPass(bokehPass);
  composer.addPass(new OutputPass());
}

/* ---------------- resize / loop ---------------- */
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function syncControls() {
  document.querySelectorAll('#metal .swatch').forEach((b, i) => b.classList.toggle('active', Object.keys(METALS)[i] === state.metal));
  const setSeg = (id, keys, cur) => document.querySelectorAll('#' + id + ' button').forEach((b, i) => b.classList.toggle('active', keys[i] === cur));
  setSeg('profile', Object.keys(PROFILES), state.profile);
  setSeg('shape', Object.keys(SHAPES), state.shape);
  setSeg('setting', Object.keys(SETTINGS), state.setting);
  setSeg('ringsize', SIZES, state.size);
  document.getElementById('width').value = state.width;
  document.getElementById('carat').value = state.carat;
  document.getElementById('widthVal').textContent = state.width.toFixed(1);
  document.getElementById('caratVal').textContent = state.carat.toFixed(1);
}
let writingHash = false;
window.addEventListener('hashchange', () => { if (writingHash) return; loadFromHash(); syncControls(); rebuild(); });

buildControls();
rebuild();
resize();
renderer.setAnimationLoop(() => { controls.update(); if (composer) composer.render(); else renderer.render(scene, camera); });
