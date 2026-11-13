const stage = document.getElementById('suitStage');
const canvas = document.getElementById('suitCanvas');
const hotspotLayer = document.getElementById('suitHotspots');
const infoCard = document.getElementById('suitInfo');
const hintEl = document.getElementById('suitHint');
const swatchRow = document.getElementById('suitSwatches');
const fabricNameEl = document.getElementById('suitFabricName');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const COLORWAYS = [
  { name: 'Indigo vat',    hex: 0x26324b },
  { name: 'Sage leaf',     hex: 0x6b7a5e },
  { name: 'Madder root',   hex: 0xc9603f },
  { name: 'Saffron dusk',  hex: 0xd99a34 },
  { name: 'Rose madder',   hex: 0xb98a86 }
];

const HOTSPOTS = [
  { id: 'lapel',   tag: 'Notch lapel',  title: 'Hand-rolled lapel',  copy: 'Turned and stitched by hand, so the roll sits soft on the chest instead of pressing flat.', pos: [0.34, 1.52, 0.30] },
  { id: 'buttons', tag: 'Placket',      title: 'Corozo buttons',      copy: 'Cut from tagua nut, polished with wax. Each one keeps the grain of its own seed.',          pos: [0.12, 0.92, 0.34] },
  { id: 'cuff',    tag: 'Sleeve',       title: 'Working cuffs',       copy: 'Real buttonholes on every cuff — the quiet sign of a jacket cut by a tailor, not a line.',  pos: [1.02, 0.28, 0.20] },
  { id: 'hem',     tag: 'Fabric',       title: 'Handloom weave',      copy: 'Woven on a pit loom in Rajasthan at a pace the cloth chooses. Small slubs are the signature.', pos: [0.42, 0.02, 0.28] }
];

let renderer, scene, camera, suit, fabricMats, trimMats;
let dragging = false, dragDX = 0, dragDY = 0, lastX = 0, lastY = 0, lastPinch = 0;
let zoom = 7.4, zoomTarget = 7.4, spinVel = 0, spinBase = 0.5;
let visible = true, activeSpot = -1, colorIndex = 0, colorMix = 0, targetMix = 1;
let clock = 0, prevT = 0;

function fallback() {
  stage.classList.add('suit3d--no3d');
  hintEl.querySelector('span').textContent = '3D unavailable — explore the dye vats below';
  canvas.remove();
}

function makeWeave(T) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    g.fillStyle = 'rgba(0,0,0,.16)';
    g.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 4) {
    g.fillStyle = 'rgba(0,0,0,.09)';
    g.fillRect(x, 0, 1, 256);
  }
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.12)';
    g.fillRect(Math.random() * 256 | 0, Math.random() * 256 | 0, 2, 2);
  }
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function panelShape(mirror) {
  const s = new THREE.Shape();
  const m = mirror ? -1 : 1;
  s.moveTo(0.04 * m, 1.60);
  s.bezierCurveTo(0.16 * m, 1.66, 0.34 * m, 1.72, 0.52 * m, 1.74);
  s.bezierCurveTo(0.55 * m, 1.55, 0.50 * m, 1.42, 0.52 * m, 1.30);
  s.bezierCurveTo(0.56 * m, 1.00, 0.60 * m, 0.50, 0.64 * m, 0.06);
  s.bezierCurveTo(0.42 * m, 0.00, 0.16 * m, 0.00, 0.04 * m, 0.02);
  s.lineTo(0.04 * m, 0.02);
  s.bezierCurveTo(0.05 * m, 0.40, 0.04 * m, 1.00, 0.04 * m, 1.60);
  return s;
}

function backShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.52, 1.74);
  s.bezierCurveTo(-0.2, 1.64, 0.2, 1.64, 0.52, 1.74);
  s.bezierCurveTo(0.55, 1.55, 0.50, 1.42, 0.52, 1.30);
  s.bezierCurveTo(0.56, 1.00, 0.60, 0.50, 0.64, 0.06);
  s.bezierCurveTo(0.2, -0.02, -0.2, -0.02, -0.64, 0.06);
  s.bezierCurveTo(-0.60, 0.50, -0.56, 1.00, -0.52, 1.30);
  s.bezierCurveTo(-0.50, 1.42, -0.55, 1.55, -0.52, 1.74);
  return s;
}

function lapelShape() {
  const s = new THREE.Shape();
  s.moveTo(0.05, 1.62);
  s.bezierCurveTo(0.18, 1.60, 0.36, 1.54, 0.46, 1.42);
  s.lineTo(0.30, 1.28);
  s.bezierCurveTo(0.20, 1.34, 0.10, 1.42, 0.05, 1.44);
  return s;
}

function buildSuit(tex) {
  suit = new THREE.Group();

  const cloth = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.03, roughness: 0.92, metalness: 0.02, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide });
  fabricMats = [cloth];
  trimMats = [trim];

  const clothDark = cloth.clone();
  clothDark.color = new THREE.Color(0x777777);
  fabricMats.push(clothDark);

  const bevel = { depth: 0.15, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 18 };

  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(backShape(), bevel), cloth);
  back.position.z = -0.20;
  suit.add(back);

  const frontR = new THREE.Mesh(new THREE.ExtrudeGeometry(panelShape(false), bevel), cloth);
  frontR.position.z = 0.10;
  suit.add(frontR);

  const frontL = new THREE.Mesh(new THREE.ExtrudeGeometry(panelShape(true), bevel), cloth);
  frontL.position.z = 0.16;
  suit.add(frontL);

  const lapelGeo = new THREE.ExtrudeGeometry(lapelShape(), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 14 });
  const lapelR = new THREE.Mesh(lapelGeo, trim);
  lapelR.position.z = 0.34;
  lapelR.rotation.x = -0.08;
  suit.add(lapelR);

  const lapelL = new THREE.Mesh(lapelGeo, trim);
  lapelL.scale.x = -1;
  lapelL.position.z = 0.34;
  lapelL.rotation.x = -0.08;
  suit.add(lapelL);

  const shoulderGeo = new THREE.SphereGeometry(0.22, 18, 12);
  const shoulderR = new THREE.Mesh(shoulderGeo, cloth);
  shoulderR.scale.set(1.5, 0.55, 1.1);
  shoulderR.position.set(0.46, 1.72, 0);
  suit.add(shoulderR);

  const shoulderL = shoulderR.clone();
  shoulderL.position.x *= -1;
  suit.add(shoulderL);

  const sleeveCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.52, 1.66, 0.02),
    new THREE.Vector3(0.86, 1.42, 0.10),
    new THREE.Vector3(1.00, 0.90, 0.14),
    new THREE.Vector3(1.00, 0.30, 0.12)
  ]);
  const sleeveGeo = new THREE.TubeGeometry(sleeveCurve, 24, 0.155, 14, false);
  const sleeveR = new THREE.Mesh(sleeveGeo, cloth);
  suit.add(sleeveR);

  const sleeveL = sleeveR.clone();
  sleeveL.scale.x = -1;
  suit.add(sleeveL);

  const cuffR = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.035, 10, 18), trim);
  cuffR.position.set(1.00, 0.34, 0.12);
  cuffR.rotation.x = Math.PI / 2;
  suit.add(cuffR);

  const cuffL = cuffR.clone();
  cuffL.position.x *= -1;
  suit.add(cuffL);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.085, 12, 24, Math.PI), trim);
  collar.position.set(0, 1.70, 0.02);
  collar.rotation.set(1.35, 0, 0);
  suit.add(collar);

  const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.36, 0.9, 20), new THREE.MeshStandardMaterial({ color: 0xfaf3e8, roughness: 0.8 }));
  shirt.position.set(0, 1.28, -0.02);
  suit.add(shirt);

  const shirtV = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.4, 14), shirt.material);
  shirtV.position.set(0, 0.75, -0.02);
  suit.add(shirtV);

  const btnMat = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.4, metalness: 0.1 });
  [1.22, 0.95, 0.68].forEach((y, i) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), btnMat);
    b.rotation.x = Math.PI / 2;
    b.position.set(0.10, y, 0.30 + i * 0.01);
    suit.add(b);
  });

  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.6 });
  const woodBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.30, 10), wood);
  woodBar.rotation.z = Math.PI / 2;
  woodBar.position.set(0, 1.98, -0.05);
  suit.add(woodBar);

  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 10, 24, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.35, metalness: 0.6 }));
  hook.position.set(0, 2.14, -0.05);
  hook.rotation.z = Math.PI * 0.75;
  suit.add(hook);

  [-0.62, 0.62].forEach(x => {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), wood);
    strut.position.set(x * 0.85, 2.14, -0.05);
    strut.rotation.z = -x * 0.55;
    suit.add(strut);
  });

  suit.position.y = -1.0;
  suit.rotation.y = spinBase;
  return suit;
}

function buildHotspots() {
  HOTSPOTS.forEach((h, i) => {
    const dot = document.createElement('button');
    dot.className = 'hotspot';
    dot.dataset.index = i;
    dot.setAttribute('aria-label', h.title);
    dot.innerHTML = '<i></i><span>' + h.tag + '</span>';
    dot.addEventListener('click', () => openSpot(i));
    hotspotLayer.appendChild(dot);
  });
}

function openSpot(i) {
  activeSpot = activeSpot === i ? -1 : i;
  const dots = hotspotLayer.children;
  [...dots].forEach(d => d.classList.toggle('is-active', +d.dataset.index === activeSpot));
  if (activeSpot === -1) { infoCard.classList.remove('is-open'); return; }
  const h = HOTSPOTS[activeSpot];
  infoCard.querySelector('.suit3d__info-tag').textContent = h.tag;
  infoCard.querySelector('.suit3d__info-title').textContent = h.title;
  infoCard.querySelector('.suit3d__info-copy').textContent = h.copy;
  infoCard.classList.add('is-open');
}

function buildSwatches() {
  COLORWAYS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === 0 ? ' is-active' : '');
    b.style.setProperty('--sw', '#' + c.hex.toString(16).padStart(6, '0'));
    b.setAttribute('aria-label', c.name);
    b.addEventListener('click', () => {
      colorIndex = i;
      targetMix = 1;
      fabricNameEl.textContent = c.name;
      [...swatchRow.children].forEach((s, j) => s.classList.toggle('is-active', i === j));
    });
    swatchRow.appendChild(b);
  });
}

function pointerDown(x, y) { dragging = true; lastX = x; lastY = y; hintEl.classList.add('is-done'); }
function pointerMove(x, y) {
  if (!dragging) return;
  dragDX = (x - lastX) * 0.011;
  dragDY = (y - lastY) * 0.004;
  lastX = x; lastY = y;
}
function pointerUp() { dragging = false; }

function bindInput() {
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); if (e.isPrimary) pointerDown(e.clientX, e.clientY); });
  canvas.addEventListener('pointermove', e => { if (e.isPrimary) pointerMove(e.clientX, e.clientY); });
  canvas.addEventListener('pointerup', () => pointerUp());
  canvas.addEventListener('pointercancel', () => pointerUp());
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomTarget = Math.min(10.5, Math.max(5.2, zoomTarget + e.deltaY * 0.004)); }, { passive: false });

  const touch = e => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastPinch) zoomTarget = Math.min(10.5, Math.max(5.2, zoomTarget - (d - lastPinch) * 0.02));
      lastPinch = d;
      dragging = false;
    } else { lastPinch = 0; }
  };
  canvas.addEventListener('touchstart', touch, { passive: true });
  canvas.addEventListener('touchmove', touch, { passive: true });
  canvas.addEventListener('touchend', () => { lastPinch = 0; });
}

function pinch(e) {
  const t = e.touches;
  if (t && t.length === 2) {
    const d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    if (lastPinch) zoomTarget = Math.min(10.5, Math.max(5.2, zoomTarget - (d - lastPinch) * 0.02));
    lastPinch = d;
  }
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function applyColor() {
  const target = new THREE.Color(COLORWAYS[colorIndex].hex);
  if (colorMix < 1) colorMix = Math.min(1, colorMix + 0.05);
  const base = new THREE.Color(COLORWAYS[prevColorIndex].hex).lerp(target, colorMix);
  const dark = base.clone().multiplyScalar(0.72);
  fabricMats.forEach(m => m.color.copy(base));
  trimMats.forEach(m => m.color.copy(dark));
}

let prevColorIndex = 0;

function projectHotspots() {
  const v = new THREE.Vector3();
  const dots = hotspotLayer.children;
  HOTSPOTS.forEach((h, i) => {
    v.set(h.pos[0], h.pos[1] - 1.0, h.pos[2]).applyMatrix4(suit.matrixWorld).project(camera);
    const x = (v.x * 0.5 + 0.5) * stage.clientWidth;
    const y = (-v.y * 0.5 + 0.5) * stage.clientHeight;
    const dot = dots[i];
    dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    dot.classList.toggle('is-hidden', v.z > 1);
  });
}

function tick(t) {
  requestAnimationFrame(tick);
  if (!visible || document.hidden) return;
  const dt = Math.min(0.05, (t - prevT) / 1000 || 0.016);
  prevT = t;
  clock += dt;

  if (!dragging) { dragDX *= 0.90; dragDY *= 0.90; }
  spinVel = spinVel * 0.92 + dragDX * 0.5;
  spinBase += spinVel;
  suit.rotation.y = spinBase + (reducedMotion ? 0 : Math.sin(clock * 0.45) * 0.14);
  suit.rotation.x = THREE.MathUtils.clamp(suit.rotation.x + dragDY, -0.25, 0.35);
  suit.rotation.x *= 0.985;
  suit.position.y = -1.0 + (reducedMotion ? 0 : Math.sin(clock * 0.8) * 0.02);

  zoom += (zoomTarget - zoom) * 0.08;
  camera.position.set(0, 1.15, zoom);
  camera.lookAt(0, 0.85, 0);

  if (colorMix < 1) applyColor();
  else prevColorIndex = colorIndex;

  renderer.render(scene, camera);
  projectHotspots();
}

async function init() {
  if (!stage || !canvas) return;
  buildSwatches();
  buildHotspots();

  try {
    const THREElib = await import('three');
    window.__THREE = THREElib;
  } catch (e) { fallback(); return; }
  const T = window.__THREE;
  window.THREE = T;

  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { fallback(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  scene = new T.Scene();
  camera = new T.PerspectiveCamera(34, 1, 0.1, 60);

  scene.add(new T.HemisphereLight(0xfff6e8, 0xd8c2a8, 1.0));
  const key = new T.DirectionalLight(0xffffff, 1.6);
  key.position.set(3.5, 5.5, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new T.DirectionalLight(0xffe4c0, 0.7);
  rim.position.set(-4, 2.5, -3);
  scene.add(rim);

  const floor = new T.Mesh(new T.PlaneGeometry(30, 30), new T.ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.35;
  floor.receiveShadow = true;
  scene.add(floor);

  suit = buildSuit(makeWeave(T));
  suit.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  scene.add(suit);

  bindInput();
  resize();
  addEventListener('resize', resize);

  new IntersectionObserver(en => { visible = en[0].isIntersecting; }, { threshold: 0.05 }).observe(stage);

  prevT = performance.now();
  requestAnimationFrame(tick);
}

init();
