import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ---------------- state ---------------- */
const state = {
  metal: 'yellow',      // yellow | white | rose | platinum
  profile: 'court',     // flat | court | bevel
  width: 2.8,           // mm
  size: '6.5',          // US ring size
  shape: 'round',       // round | oval | princess | emerald | pear
  carat: 1.0,
  setting: 'prong',     // prong | halo | bezel | pave
};

const METALS = {
  yellow:   { label: 'Yellow gold', color: 0xe6c26a, roughness: 0.14, css: '#e6c26a' },
  white:    { label: 'White gold',  color: 0xeceae2, roughness: 0.12, css: '#eceae2' },
  rose:     { label: 'Rose gold',   color: 0xe2a98b, roughness: 0.14, css: '#e2a98b' },
  platinum: { label: 'Platinum',    color: 0xdfe0dd, roughness: 0.18, css: '#dfe0dd' },
};
const PROFILES = { flat: 'Flat', court: 'Court', bevel: 'Bevelled' };
const SETTINGS = { prong: 'Solitaire prong', halo: 'Halo', bezel: 'Bezel', pave: 'Pavé band' };
const SHAPES = { round: 'Round', oval: 'Oval', princess: 'Princess', emerald: 'Emerald', pear: 'Pear' };
const SIZES = ['4','4.5','5','5.5','6','6.5','7','7.5','8','8.5','9'];
const SIZE_MM = { '4':14.9,'4.5':15.3,'5':15.7,'5.5':16.1,'6':16.5,'6.5':16.9,'7':17.3,'7.5':17.7,'8':18.1,'8.5':18.5,'9':19.0 };

// girdle width (mm) of a 1ct stone, scaled by cbrt(carat)
const SHAPE_WIDTH_1CT = { round: 6.5, oval: 6.0, princess: 5.5, emerald: 5.5, pear: 5.7 };

const BAND_T = 1.6; // band thickness mm

/* ---------------- renderer / scene ---------------- */
const container = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f2ee);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 1, 500);
camera.position.set(26, 20, 34);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.1;
controls.minDistance = 18;
controls.maxDistance = 90;

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(14, 22, 10);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 8;
key.shadow.bias = -0.0004;
scene.add(key);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.ShadowMaterial({ opacity: 0.16 })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

/* ---------------- materials ---------------- */
function metalMaterial() {
  const m = METALS[state.metal];
  return new THREE.MeshPhysicalMaterial({
    color: m.color, metalness: 1.0, roughness: m.roughness, envMapIntensity: 1.15,
  });
}
function stoneMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.02,
    transmission: 1.0, thickness: 4.0, ior: 2.417,
    clearcoat: 1.0, clearcoatRoughness: 0.02,
    specularIntensity: 1.0, envMapIntensity: 2.2,
    flatShading: true,
  });
  if ('dispersion' in mat) mat.dispersion = 4.0; // subtle rainbow fire where supported
  return mat;
}

/* ---------------- band geometry ---------------- */
function bandOutline(profile, Ri, w, t) {
  // returns array of [y, z]: y = along band axis (-w/2..w/2), z = radial offset outward (0..t)
  const pts = [];
  const edge = Math.min(0.14, w * 0.06); // soft edge rounding on inside face
  // inside face (bottom edge -> top edge)
  pts.push([-w / 2, 0]);
  pts.push([-w / 2 + edge, 0]);
  pts.push([w / 2 - edge, 0]);
  pts.push([w / 2, 0]);
  if (profile === 'flat') {
    const cr = Math.min(0.16, t * 0.22);
    for (let i = 1; i <= 3; i++) { const a = (i / 4) * Math.PI / 2; pts.push([w / 2 - cr + Math.sin(a) * cr, t - cr + (1 - Math.cos(a)) * cr]); }
    pts.push([w / 2, t]);
    pts.push([-w / 2, t]);
    for (let i = 1; i <= 3; i++) { const a = (i / 4) * Math.PI / 2; pts.push([-w / 2 + cr - Math.sin(a) * cr, t - cr + (1 - Math.cos(a)) * cr]); }
  } else if (profile === 'court') {
    const n = 24;
    for (let i = 1; i <= n; i++) {
      const y = w / 2 - (i / n) * w;
      const u = (2 * y) / w;
      const z = t * Math.sqrt(Math.max(0, 1 - u * u));
      pts.push([y, z]);
    }
  } else { // bevel: octagonal chamfers
    const c = Math.min(w * 0.22, t * 0.45);
    pts.push([w / 2, t - c]);
    pts.push([w / 2 - c, t]);
    pts.push([-w / 2 + c, t]);
    pts.push([-w / 2, t - c]);
  }
  return pts;
}

function buildBand() {
  const Ri = SIZE_MM[state.size] / 2;
  const outline = bandOutline(state.profile, Ri, state.width, BAND_T);
  const pts = outline.map(([y, z]) => new THREE.Vector2(Ri + z, y));
  const geo = new THREE.LatheGeometry(pts, 160);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, metalMaterial());
  mesh.castShadow = true;
  return mesh;
}

/* ---------------- stone geometry ---------------- */
function outlinePoints(shape) {
  const pts = [];
  if (shape === 'round' || shape === 'oval') {
    const N = 48, a = shape === 'oval' ? 1.35 : 1;
    for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2; pts.push([Math.cos(t) * a, Math.sin(t)]); }
  } else if (shape === 'princess') {
    const per = 8;
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < per; i++) {
        const u = i / per; // walk each side of the unit square (rotated 45 deg look is fine)
        const corners = [[1,1],[-1,1],[-1,-1],[1,-1]];
        const [x0,y0] = corners[s], [x1,y1] = corners[(s+1)%4];
        pts.push([x0 + (x1-x0)*u, y0 + (y1-y0)*u]);
      }
    }
  } else if (shape === 'emerald') {
    const W = 1.35, H = 1, c = 0.34;
    const corners = [[W-c,H],[W,H-c],[W,-H+c],[W-c,-H],[-W+c,-H],[-W,-H+c],[-W,H-c],[-W+c,H]];
    const per = 4;
    for (let s = 0; s < corners.length; s++) {
      for (let i = 0; i < per; i++) {
        const u = i / per;
        const [x0,y0] = corners[s], [x1,y1] = corners[(s+1)%corners.length];
        pts.push([x0 + (x1-x0)*u, y0 + (y1-y0)*u]);
      }
    }
  } else { // pear
    const N = 48;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      let x = Math.sin(t), y = Math.cos(t);
      if (y < 0) { const k = -y; x *= (1 - 0.62 * k); y = -Math.pow(k, 0.9) * 1.35; }
      else { y = y * 1.0; }
      pts.push([x, y]);
    }
  }
  return pts;
}

function buildStone() {
  const w1 = SHAPE_WIDTH_1CT[state.shape];
  const d = w1 * Math.cbrt(state.carat); // girdle width mm
  const r = d / 2;
  const outline = outlinePoints(state.shape);
  const N = outline.length;
  // rings: [radiusScale, height] from culet (bottom) to table (top)
  const rings = [
    [0.001, -0.50 * d],
    [0.62,  -0.26 * d],
    [1.0,   -0.015 * d],
    [1.0,    0.015 * d],
    [0.80,   0.10 * d],
    [0.56,   0.17 * d],
  ];
  const pos = [];
  const ringPt = (ring, i) => {
    const [s, h] = rings[ring];
    const [x, y] = outline[i % N];
    return [x * s * r, h, y * s * r];
  };
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let i = 0; i < N; i++) {
      const a = ringPt(ri, i), b = ringPt(ri, i + 1), c = ringPt(ri + 1, i + 1), e = ringPt(ri + 1, i);
      pos.push(...a, ...b, ...c, ...a, ...c, ...e);
    }
  }
  // table cap (fan from center)
  const topZ = rings[rings.length - 1][1];
  for (let i = 0; i < N; i++) {
    const c = ringPt(rings.length - 1, i + 1), e = ringPt(rings.length - 1, i);
    pos.push(0, topZ, 0, ...c, ...e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, stoneMaterial());
  mesh.castShadow = true;
  return { mesh, d, r };
}

/* ---------------- setting geometry ---------------- */
function buildSetting(stone, Ri) {
  const g = new THREE.Group();
  const metal = metalMaterial();
  const { mesh: stoneMesh, d, r } = stone;
  const bandTopY = Ri + BAND_T;
  const gemMat = stoneMaterial();

  if (state.setting === 'prong' || state.setting === 'pave') {
    const lift = 1.5;
    stoneMesh.position.y = bandTopY + lift + 0.50 * d;
    g.add(stoneMesh);
    const nProngs = (state.shape === 'round' && state.carat >= 1.5) ? 6 : 4;
    const prongR = Math.max(0.26, d * 0.045);
    for (let i = 0; i < nProngs; i++) {
      const a = (i / nProngs) * Math.PI * 2 + Math.PI / nProngs;
      const bottom = new THREE.Vector3(Math.cos(a) * r * 0.35, bandTopY + lift - 0.9, Math.sin(a) * r * 0.35);
      const top = new THREE.Vector3(Math.cos(a) * r * 0.97, stoneMesh.position.y + 0.13 * d, Math.sin(a) * r * 0.97);
      const len = bottom.distanceTo(top);
      const prong = new THREE.Mesh(new THREE.CylinderGeometry(prongR * 0.75, prongR, len, 10), metal);
      prong.position.copy(bottom).add(top).multiplyScalar(0.5);
      prong.lookAt(top);
      prong.rotateX(Math.PI / 2);
      prong.castShadow = true;
      g.add(prong);
    }
    const seat = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, 0.32, 12, 48), metal);
    seat.rotation.x = Math.PI / 2;
    seat.position.y = bandTopY + lift - 0.2;
    seat.castShadow = true;
    g.add(seat);
  } else if (state.setting === 'halo') {
    stoneMesh.position.y = bandTopY + 0.5 + 0.50 * d;
    g.add(stoneMesh);
    const nH = 14, hr = r * 1.3, sr = Math.max(0.5, r * 0.16);
    for (let i = 0; i < nH; i++) {
      const a = (i / nH) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(sr, 1), gemMat);
      s.position.set(Math.cos(a) * hr, stoneMesh.position.y - 0.34 * d, Math.sin(a) * hr);
      s.scale.y = 0.75;
      g.add(s);
    }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(hr + sr * 0.7, r * 0.5, 0.9, 48), metal);
    plate.position.y = stoneMesh.position.y - 0.34 * d - 0.45;
    plate.castShadow = true;
    g.add(plate);
  } else { // bezel
    stoneMesh.position.y = bandTopY + 0.2 + 0.44 * d;
    g.add(stoneMesh);
    const rimPts = [
      new THREE.Vector2(r * 0.75, -0.30 * d),
      new THREE.Vector2(r + 0.55, -0.06 * d),
      new THREE.Vector2(r + 0.5, 0.06 * d),
      new THREE.Vector2(r * 0.99, 0.075 * d),
    ];
    const rim = new THREE.Mesh(new THREE.LatheGeometry(rimPts, 96), metal);
    rim.position.y = stoneMesh.position.y;
    rim.castShadow = true;
    g.add(rim);
  }

  if (state.setting === 'pave') {
    const count = Math.max(9, Math.round((2 * Math.PI * (Ri + BAND_T * 0.55)) / 2.6));
    const sr = state.width * 0.16;
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
  ringGroup = new THREE.Group();
  const Ri = SIZE_MM[state.size] / 2;
  const band = buildBand();
  ringGroup.add(band);
  const stone = buildStone();
  ringGroup.add(buildSetting(stone, Ri));

  // stand the ring on the shadow plane, slight tilt for depth
  ringGroup.position.y = Ri + BAND_T;
  const wrap = new THREE.Group();
  wrap.add(ringGroup);
  wrap.rotation.x = -0.22;
  ringGroup = wrap;
  scene.add(ringGroup);

  controls.target.set(0, Ri + BAND_T, 0);
  key.target.position.set(0, Ri + BAND_T, 0);
  key.target.updateMatrixWorld();

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
    const lbl = el('small', null, m.label.replace(' gold', ''));
    b.appendChild(lbl);
    b.onclick = () => { state.metal = k; refreshActive(metalWrap, b); rebuild(); };
    metalWrap.appendChild(b);
  });
  const profileWrap = document.getElementById('profile');
  Object.entries(PROFILES).forEach(([k, label]) => {
    const b = el('button', k === state.profile ? 'active' : null, label);
    b.onclick = () => { state.profile = k; refreshActive(profileWrap, b); rebuild(); };
    profileWrap.appendChild(b);
  });
  const sizeWrap = document.getElementById('ringsize');
  SIZES.forEach(s => {
    const b = el('button', s === state.size ? 'active' : null, s);
    b.onclick = () => { state.size = s; refreshActive(sizeWrap, b); rebuild(); };
    sizeWrap.appendChild(b);
  });
  const shapeWrap = document.getElementById('shape');
  Object.entries(SHAPES).forEach(([k, label]) => {
    const b = el('button', k === state.shape ? 'active' : null, label);
    b.onclick = () => { state.shape = k; refreshActive(shapeWrap, b); rebuild(); };
    shapeWrap.appendChild(b);
  });
  const settingWrap = document.getElementById('setting');
  Object.entries(SETTINGS).forEach(([k, label]) => {
    const b = el('button', k === state.setting ? 'active' : null, label);
    b.onclick = () => { state.setting = k; refreshActive(settingWrap, b); rebuild(); };
    settingWrap.appendChild(b);
  });

  const width = document.getElementById('width');
  width.oninput = () => { state.width = parseFloat(width.value); document.getElementById('widthVal').textContent = state.width.toFixed(1); rebuild(); };
  const carat = document.getElementById('carat');
  carat.oninput = () => { state.carat = parseFloat(carat.value); document.getElementById('caratVal').textContent = state.carat.toFixed(1); rebuild(); };
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
// indicative lab-grown stone price ranges (USD), per carat bracket, G/VS1-quality guide figures
const PRICE_BRACKETS = [
  { max: 0.6,  low: 250,  high: 600 },
  { max: 1.1,  low: 500,  high: 1200 },
  { max: 1.6,  low: 800,  high: 1900 },
  { max: 2.1,  low: 1000, high: 2600 },
  { max: 3.1,  low: 1500, high: 4200 },
];
function priceRange() {
  const b = PRICE_BRACKETS.find(b => state.carat <= b.max) || PRICE_BRACKETS[PRICE_BRACKETS.length - 1];
  return `$${b.low.toLocaleString()} - $${b.high.toLocaleString()}`;
}

function vendorLinks() {
  const v = VENDOR_SHAPES[state.shape];
  const lo = Math.max(0.2, state.carat - 0.15).toFixed(2);
  const hi = (state.carat + 0.15).toFixed(2);
  return [
    {
      name: 'James Allen', host: 'jamesallen.com',
      url: `https://www.jamesallen.com/loose-diamonds/all-diamonds/?Shape=${v.ja}&CaratFrom=${lo}&CaratTo=${hi}`,
      type: 'plain', typeLabel: 'Filtered deeplink (plain)',
    },
    {
      name: 'Blue Nile', host: 'bluenile.com',
      url: `https://www.bluenile.com/diamond-search?Shape=${v.bn}&CaratFrom=${lo}&CaratTo=${hi}`,
      type: 'ready', typeLabel: 'Affiliate-ready (a_aid params) - currently plain',
    },
    {
      name: 'Brilliant Earth', host: 'brilliantearth.com',
      url: `https://www.brilliantearth.com/loose-diamonds/search/?shapes=${v.be}&carat_min=${lo}&carat_max=${hi}`,
      type: 'ready', typeLabel: 'Affiliate program exists - currently plain',
    },
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
    tr.appendChild(el('td', null, priceRange()));
    const tdT = el('td');
    tdT.appendChild(el('span', 'badge ' + (v.type === 'ready' ? 'ready' : 'plain'), v.typeLabel));
    tr.appendChild(tdT);
    const tdC = el('td');
    const a = el('a', 'cta', 'View stones');
    a.href = v.url; a.target = '_blank'; a.rel = 'noopener';
    tdC.appendChild(a);
    tr.appendChild(tdC);
    tbody.appendChild(tr);
  });
  document.getElementById('priceSource').textContent =
    '*Indicative range for a lab-grown stone of this size (G color, VS clarity, excellent cut) based on 2026 online-retail guides; natural diamonds and finished settings cost more. Filter deeplinks use each vendor\'s public URL parameters; affiliate parameters can be added once enrolled.';
}

/* ---------------- resize / loop ---------------- */
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

buildControls();
rebuild();
resize();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
