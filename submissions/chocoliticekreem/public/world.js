import * as THREE from "three";

const LAKE_RX = 52;
const LAKE_RZ = 35;
const WATER_Y = 0.05;
const CAMERA_FACE = new THREE.Vector3(0, 0, 60);

const C = (hex) => new THREE.Color(hex);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeLabel(text) {
  const tex = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = "rgba(22,18,34,0.75)";
    roundRect(g, 8, 16, w - 16, h - 32, 28);
    g.fill();
    g.strokeStyle = "rgba(255,214,160,0.95)";
    g.lineWidth = 4;
    g.stroke();
    g.font = "bold 52px system-ui, -apple-system, 'Segoe UI', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff6e8";
    g.fillText(text, w / 2, h / 2 + 2, w - 48);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(16, 4, 1);
  s.renderOrder = 10;
  return s;
}

function windowTextures(cols, rows, wall, glass) {
  const lit = Array.from({ length: cols * rows }, () => Math.random() < 0.6);
  const px = 32;
  const draw = (emissive) => (g, w, h) => {
    g.fillStyle = emissive ? "#000000" : wall;
    g.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const on = lit[r * cols + c];
        g.fillStyle = emissive ? (on ? "#ffd27a" : "#000000") : glass;
        g.fillRect(c * px + 6, r * px + 6, px - 12, px - 10);
      }
    }
  };
  return {
    map: canvasTexture(cols * px, rows * px, draw(false)),
    emissiveMap: canvasTexture(cols * px, rows * px, draw(true)),
  };
}

function coneGeoFar() {
  const g = new THREE.ConeGeometry(1.9, 5.5, 6);
  g.translate(0, 2.6, 0);
  return g;
}

function blobGeoFar() {
  const g = new THREE.IcosahedronGeometry(2.2, 0);
  g.translate(0, 2.0, 0);
  return g;
}

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...extra });
}

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

export function buildWorld(scene) {
  const state = { night: 0, lampOn: 0, flash: 0 };
  const keyMap = new Map();
  const targets = [];

  function addTarget(keys, label) {
    const t = { glow: 0, entries: [], label, labelScale: label ? label.scale.clone() : null };
    keys.forEach((k) => keyMap.set(k, t));
    targets.push(t);
    return t;
  }
  function glowMat(target, mat, base, amp) {
    target.entries.push({ mat, base, amp });
    return mat;
  }
  const zero = () => 0;

  // ---------- sky, fog, lights ----------
  const sky = {
    top: C("#3d8fe0"), horizon: C("#d4ecff"),
    topNight: C("#03061a"), horizonNight: C("#0b1030"),
    fog: C("#d4ecff"), fogNight: C("#0b1030"),
  };
  scene.background = sky.horizon.clone();
  scene.fog = new THREE.Fog(sky.fog.clone(), 150, 600);

  const skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: sky.top.clone() }, horizon: { value: sky.horizon.clone() } },
    vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vPos;
      void main(){ float h = clamp(vPos.y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0);
      #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  skyDome.renderOrder = -1;
  skyDome.frustumCulled = false;
  // follow the camera so the dome never crosses camera.far (600) wherever the duck swims
  skyDome.onBeforeRender = (_r, _s, cam) => {
    skyDome.position.copy(cam.position);
    skyDome.updateMatrixWorld();
  };
  scene.add(skyDome);

  const starPos = [];
  for (let i = 0; i < 400; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.42;
    starPos.push(Math.cos(th) * Math.sin(ph) * 300, Math.cos(ph) * 300, Math.sin(th) * Math.sin(ph) * 300);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  scene.add(new THREE.Points(starGeo, starMat));

  const hemi = new THREE.HemisphereLight(0xffffff, 0x6a8a4a, 1.3);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff6e5, 3.0);
  sun.position.set(-45, 110, 55);
  sun.target.position.set(0, 0, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -115, right: 115, top: 115, bottom: -115, near: 1, far: 360 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const flashLight = new THREE.AmbientLight(0xffffff, 0);
  scene.add(flashLight);

  // ---------- ground, hills ----------
  const groundGeo = new THREE.PlaneGeometry(420, 420, 70, 70);
  groundGeo.rotateX(-Math.PI / 2);
  const gCols = [];
  const base = C("#6a9a4a");
  const tmp = new THREE.Color();
  for (let i = 0; i < groundGeo.attributes.position.count; i++) {
    tmp.copy(base).offsetHSL((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.06);
    gCols.push(tmp.r, tmp.g, tmp.b);
  }
  groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(gCols, 3));
  const ground = new THREE.Mesh(groundGeo, std(0xffffff, { vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  const hillGeo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
    const r = 190 + Math.random() * 40;
    const hill = new THREE.Mesh(hillGeo, std(i % 2 ? "#5d8a40" : "#557f3c"));
    hill.position.set(Math.cos(a) * r, -4, Math.sin(a) * r);
    hill.scale.set(30 + Math.random() * 20, 10 + Math.random() * 10, 30 + Math.random() * 20);
    scene.add(hill);
  }

  // ---------- distant scenery to the horizon ----------
  const farGround = new THREE.Mesh(new THREE.CircleGeometry(1500, 48), std("#6a9a4a", { flatShading: false }));
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.y = -0.3;
  farGround.receiveShadow = true;
  scene.add(farGround);

  const fm4 = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fv = new THREE.Vector3();
  const fs = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const setInst = (mesh, i, x, y, z, sx, sy, sz, rot) => {
    fq.setFromAxisAngle(up, rot);
    fm4.compose(fv.set(x, y, z), fq, fs.set(sx, sy, sz));
    mesh.setMatrixAt(i, fm4);
  };
  const ringPoint = (rMin, rMax) => {
    const a = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    return [Math.cos(a) * r, Math.sin(a) * r];
  };

  const HILLS = 70;
  const farHills = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), std(0xffffff), HILLS);
  const hillCols = ["#5d8a40", "#557f3c", "#6a9648", "#4f7838", "#78a052"].map(C);
  for (let i = 0; i < HILLS; i++) {
    const [x, z] = ringPoint(190, 470);
    const w = 35 + Math.random() * 45;
    setInst(farHills, i, x, -6, z, w, 12 + Math.random() * 22, w * (0.6 + Math.random() * 0.6), Math.random() * Math.PI);
    farHills.setColorAt(i, hillCols[i % hillCols.length]);
  }
  scene.add(farHills);

  const FAR_TREES = 700;
  const farCones = new THREE.InstancedMesh(coneGeoFar(), std(0xffffff), FAR_TREES);
  const farBlobs = new THREE.InstancedMesh(blobGeoFar(), std(0xffffff), FAR_TREES);
  const farLeaf = ["#4f7a3a", "#5f8a3c", "#3f6a35", "#6b9442", "#c07a3a", "#d29a3f"].map(C);
  let nc = 0;
  let nb = 0;
  for (let c = 0; c < 90; c++) {
    const [cx, cz] = ringPoint(150, 420);
    const n = 6 + Math.floor(Math.random() * 10);
    for (let k = 0; k < n; k++) {
      const x = cx + (Math.random() - 0.5) * 30;
      const z = cz + (Math.random() - 0.5) * 30;
      if (Math.max(Math.abs(x), Math.abs(z)) < 95) continue;
      const s = 1.2 + Math.random() * 1.6;
      const useCone = Math.random() < 0.5;
      const mesh = useCone ? farCones : farBlobs;
      const i = useCone ? nc : nb;
      if (i >= FAR_TREES) continue;
      setInst(mesh, i, x, 0, z, s, s * (0.9 + Math.random() * 0.4), s, Math.random() * Math.PI);
      mesh.setColorAt(i, farLeaf[Math.floor(Math.random() * (useCone ? 4 : farLeaf.length))]);
      if (useCone) nc++;
      else nb++;
    }
  }
  farCones.count = nc;
  farBlobs.count = nb;
  scene.add(farCones, farBlobs);

  function stripeTex(wall, glass) {
    const t = canvasTexture(64, 128, (g, w, h) => {
      g.fillStyle = wall;
      g.fillRect(0, 0, w, h);
      g.fillStyle = glass;
      for (let y = 10; y < h; y += 16) g.fillRect(0, y, w, 7);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    return t;
  }
  const farBuildMats = [
    std(0xffffff, { map: stripeTex("#9c5a42", "#33465c"), flatShading: false }),
    std(0xffffff, { map: stripeTex("#c9c4b8", "#3d5670"), flatShading: false }),
    std(0xffffff, { map: stripeTex("#b8b2a6", "#2f4258"), flatShading: false }),
  ];
  const farBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  farBoxGeo.translate(0, 0.5, 0);
  const roofMat = std("#6f6a64");
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const r = 160 + Math.random() * 160;
    const w = 14 + Math.random() * 18;
    const h = 8 + Math.random() * (i % 5 === 0 ? 26 : 12);
    const d = 10 + Math.random() * 12;
    const b = new THREE.Mesh(farBoxGeo, farBuildMats[i % farBuildMats.length]);
    b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    b.scale.set(w, h, d);
    b.rotation.y = -a + Math.PI / 2;
    const roof = new THREE.Mesh(farBoxGeo, roofMat);
    roof.position.set(b.position.x, h, b.position.z);
    roof.scale.set(w + 0.8, 0.8, d + 0.8);
    roof.rotation.y = b.rotation.y;
    scene.add(b, roof);
  }

  const PUFFS = 5;
  const CLOUDS = 22;
  const clouds = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xdde8f5, emissiveIntensity: 0.45, flatShading: true }),
    CLOUDS * PUFFS,
  );
  for (let c = 0; c < CLOUDS; c++) {
    const [cx, cz] = ringPoint(120, 420);
    const cy = 75 + Math.random() * 55;
    const size = 9 + Math.random() * 8;
    for (let p = 0; p < PUFFS; p++) {
      const s = size * (0.6 + Math.random() * 0.6);
      setInst(clouds, c * PUFFS + p, cx + (p - 2) * size * 0.9, cy + Math.random() * size * 0.4,
        cz + (Math.random() - 0.5) * size, s * 1.3, s * 0.7, s, Math.random() * Math.PI);
    }
  }
  scene.add(clouds);

  function decal(geo, color, y, offset) {
    const m = new THREE.Mesh(geo, std(color, { polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // ---------- lake ----------
  const sand = decal(new THREE.CircleGeometry(1, 64), "#cdb48a", 0.02, -1);
  sand.scale.set(LAKE_RX * 1.1, LAKE_RZ * 1.14, 1);
  const bed = decal(new THREE.CircleGeometry(1, 64), "#2a6478", 0.025, -1);
  bed.scale.set(LAKE_RX * 1.01, LAKE_RZ * 1.01, 1);

  const waterGeo = new THREE.RingGeometry(0.0001, 1, 72, 14);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.scale(LAKE_RX, 1, LAKE_RZ);
  const waterBase = Float32Array.from(waterGeo.attributes.position.array);
  const waterMat = new THREE.MeshStandardMaterial({
    color: "#3f7fa6", roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.82, flatShading: true,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  scene.add(water);

  // ---------- paths ----------
  const pathRing = decal(new THREE.RingGeometry(1.22, 1.3, 96, 1), "#c8bba4", 0.035, -3);
  pathRing.scale.set(LAKE_RX, LAKE_RZ, 1);

  function pathStrip(x1, z1, x2, z2, w = 2.2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const geo = new THREE.PlaneGeometry(len, w);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, std("#c8bba4", { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.position.set((x1 + x2) / 2, 0.036, (z1 + z2) / 2);
    m.rotation.y = Math.atan2(-dz, dx);
    m.receiveShadow = true;
    scene.add(m);
  }
  const pathSegs = [];
  function pathToRing(x, z) {
    const a = Math.atan2(z / LAKE_RZ, x / LAKE_RX);
    const x1 = Math.cos(a) * LAKE_RX * 1.26;
    const z1 = Math.sin(a) * LAKE_RZ * 1.26;
    pathSegs.push([x1, z1, x, z]);
    pathStrip(x1, z1, x, z);
  }
  const nearPath = (x, z, pad) => pathSegs.some(([x1, z1, x2, z2]) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t)) < pad;
  });

  // ---------- landmarks ----------
  const avoid = [];
  const faceCamera = (g) => g.lookAt(CAMERA_FACE.x, g.position.y, CAMERA_FACE.z);
  const windowBase = () => 0.04 + state.lampOn * 1.2;

  function windowBox(target, w, h, d, cols, rows, wall, glass, roofColor) {
    const tex = windowTextures(cols, rows, wall, glass);
    const win = glowMat(target, std(0xffffff, { map: tex.map, emissive: C("#ffd27a"), emissiveMap: tex.emissiveMap, emissiveIntensity: 0, flatShading: false }), windowBase, 0.9);
    const roof = glowMat(target, std(roofColor, { emissive: C("#ffcc66"), emissiveIntensity: 0 }), zero, 0.7);
    return shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [win, win, roof, roof, win, win]));
  }

  function addLabel(group, text, y) {
    const label = makeLabel(text);
    label.position.set(group.position.x, y, group.position.z);
    scene.add(label);
    return label;
  }

  // Library
  {
    const g = new THREE.Group();
    g.position.set(-30, 0, -84);
    const label = addLabel(g, "Library", 32);
    const t = addTarget(["library"], label);
    const tower = windowBox(t, 12, 26, 12, 6, 13, "#d9d2c4", "#2d3b55", "#6f6a66");
    tower.position.y = 13;
    const podium = windowBox(t, 24, 7, 14, 12, 3, "#cfc6b6", "#2d3b55", "#6f6a66");
    podium.position.set(0, 3.5, 3);
    const cap = shadowed(new THREE.Mesh(new THREE.BoxGeometry(13, 1.2, 13), std("#4b4744")));
    cap.position.y = 26.6;
    g.add(tower, podium, cap);
    faceCamera(g);
    scene.add(g);
    avoid.push([g.position.x, g.position.z, 15]);
    pathToRing(g.position.x, g.position.z + 10);
  }

  // The Oculus
  {
    const g = new THREE.Group();
    g.position.set(50, 0, -66);
    const label = addLabel(g, "The Oculus", 15);
    const t = addTarget(["oculus"], label);
    const glass = glowMat(t, new THREE.MeshStandardMaterial({
      color: "#7fd6e6", roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.55,
      emissive: C("#3fd8ff"), emissiveIntensity: 0.15, side: THREE.DoubleSide,
    }), () => 0.12 + state.night * 0.35, 1.2);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 8, 32, 1, true), glass);
    drum.position.y = 4;
    const core = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 7.8, 24),
      glowMat(t, std("#e8e4dc", { emissive: C("#ffe0a0"), emissiveIntensity: 0 }), () => state.lampOn * 0.6, 0.8)));
    core.position.y = 3.9;
    const roof = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 0.6, 32), std("#f2efe8")));
    roof.position.y = 8.3;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.45, 8, 48),
      glowMat(t, std("#bff6ff", { emissive: C("#3fe3ff"), emissiveIntensity: 0.3 }), () => 0.3 + state.night * 1.2, 2));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 8.9;
    g.add(drum, core, roof, ring);
    scene.add(g);
    avoid.push([g.position.x, g.position.z, 11]);
    pathToRing(g.position.x - 4, g.position.z + 7);
  }

  // Warwick Arts Centre
  {
    const g = new THREE.Group();
    g.position.set(-86, 0, -36);
    const label = addLabel(g, "Warwick Arts Centre", 18);
    const t = addTarget(["warwick"], label);
    const body = windowBox(t, 26, 7, 14, 13, 3, "#9a6a50", "#2b2f45", "#4a3f55");
    body.position.y = 3.5;
    const shape = new THREE.Shape();
    shape.moveTo(-7, 0);
    shape.lineTo(7, 0);
    shape.lineTo(7, 2);
    shape.lineTo(-2, 7.5);
    shape.lineTo(-7, 4);
    shape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 26, bevelEnabled: false });
    roofGeo.translate(0, 0, -13);
    roofGeo.rotateY(Math.PI / 2);
    const roof = shadowed(new THREE.Mesh(roofGeo, glowMat(t, std("#4a3f55", { emissive: C("#ffcc66"), emissiveIntensity: 0 }), zero, 0.8)));
    roof.position.y = 7;
    const foyer = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 3), glowMat(t, new THREE.MeshStandardMaterial({
      color: "#8fdcef", roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.6, emissive: C("#ffd9a0"), emissiveIntensity: 0,
    }), () => state.lampOn * 0.9, 1));
    foyer.position.set(0, 2.5, 8.4);
    g.add(body, roof, foyer);
    faceCamera(g);
    scene.add(g);
    avoid.push([g.position.x, g.position.z, 18]);
    pathToRing(g.position.x + 10, g.position.z + 8);
  }

  // CS building (CompSoc)
  {
    const g = new THREE.Group();
    g.position.set(84, 0, -21);
    const label = addLabel(g, "CS Building (CompSoc)", 17);
    const t = addTarget(["compsoc"], label);
    const body = windowBox(t, 14, 11, 12, 7, 5, "#b9c2c9", "#24304a", "#555c63");
    body.position.y = 5.5;
    const signTex = canvasTexture(512, 160, (g2, w, h) => {
      g2.fillStyle = "#0b1410";
      g2.fillRect(0, 0, w, h);
      g2.font = "bold 120px 'Courier New', monospace";
      g2.textAlign = "center";
      g2.textBaseline = "middle";
      g2.shadowColor = "#39ff88";
      g2.shadowBlur = 24;
      g2.fillStyle = "#39ff88";
      g2.fillText("DCS", w / 2, h / 2 + 6);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5), glowMat(t, new THREE.MeshStandardMaterial({
      map: signTex, emissive: C("#ffffff"), emissiveMap: signTex, emissiveIntensity: 0.7,
    }), () => 0.7 + state.night * 1.3, 1.8));
    sign.position.set(0, 8.6, 6.02);
    g.add(body, sign);
    faceCamera(g);
    scene.add(g);
    avoid.push([g.position.x, g.position.z, 12]);
    pathToRing(g.position.x - 8, g.position.z + 2);
  }

  // Piazza / Rootes
  const piazza = new THREE.Vector3(12, 0.1, -54);
  {
    const g = new THREE.Group();
    g.position.set(piazza.x, 0, piazza.z);
    const label = addLabel(g, "Piazza / Rootes", 11);
    const t = addTarget(["hack", "whack", "piazza", "rootes"], label);
    const tileTex = canvasTexture(128, 128, (g2, w, h) => {
      g2.fillStyle = "#bcae99";
      g2.fillRect(0, 0, w, h);
      g2.strokeStyle = "#9d8f7b";
      g2.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        g2.beginPath(); g2.moveTo(i * 32, 0); g2.lineTo(i * 32, h); g2.stroke();
        g2.beginPath(); g2.moveTo(0, i * 32); g2.lineTo(w, i * 32); g2.stroke();
      }
    });
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(5, 5);
    const paving = new THREE.Mesh(new THREE.CircleGeometry(9.5, 8), glowMat(t, std(0xffffff, {
      map: tileTex, emissive: C("#ffcc66"), emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    }), zero, 0.5));
    paving.rotation.x = -Math.PI / 2;
    paving.position.y = 0.04;
    paving.receiveShadow = true;
    g.add(paving);
    const fountain = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.7, 10), std("#9a948a")));
    fountain.position.y = 0.35;
    g.add(fountain);
    ["#d9483b", "#f2c14e", "#3b7dd8", "#4caf50"].forEach((col, i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const kiosk = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2), std("#efe6d6")));
      kiosk.position.set(Math.cos(a) * 6, 1.1, Math.sin(a) * 6);
      const awning = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.2, 4),
        glowMat(t, std(col, { emissive: C(col), emissiveIntensity: 0 }), () => state.lampOn * 0.25, 1.4)));
      awning.position.set(kiosk.position.x, 2.8, kiosk.position.z);
      awning.rotation.y = Math.PI / 4;
      g.add(kiosk, awning);
    });
    const rootes = windowBox(t, 18, 6, 7, 9, 3, "#d4c7b0", "#2d3b55", "#6a625a");
    rootes.position.set(0, 3, -13);
    g.add(rootes);
    scene.add(g);
    avoid.push([g.position.x, g.position.z, 12], [g.position.x, g.position.z - 13, 11]);
    pathToRing(g.position.x, g.position.z + 9);
  }

  // ---------- sponsor billboards ----------
  const sponsors = [
    { name: "Marshall Wace", keys: ["marshall", "wace"], pos: [-69, 10.5], bg: "#0f2a4a", fg: "#ffffff" },
    { name: "Brevan Howard", keys: ["brevan", "howard"], pos: [-66, -25.5], bg: "#161616", fg: "#d8b45a" },
    { name: "Capital One", keys: ["capital", "one"], pos: [69, 10.5], bg: "#004977", fg: "#ffffff" },
    { name: "Bloomberg", keys: ["bloomberg"], pos: [69, -28.5], bg: "#000000", fg: "#ff9a1a" },
    { name: "Netcraft", keys: ["netcraft"], pos: [-45, 43.5], bg: "#1d3c6e", fg: "#ffffff" },
    { name: "incident.io", keys: ["incident", "io", "incident.io"], pos: [45, 43.5], bg: "#f25533", fg: "#ffffff" },
  ];
  const postGeo = new THREE.CylinderGeometry(0.15, 0.18, 5.2, 6);
  const postMat = std("#3a3a40");
  for (const s of sponsors) {
    const t = addTarget(s.keys, null);
    const tex = canvasTexture(1024, 440, (g2, w, h) => {
      g2.fillStyle = s.bg;
      g2.fillRect(0, 0, w, h);
      g2.strokeStyle = "rgba(255,255,255,0.25)";
      g2.lineWidth = 10;
      g2.strokeRect(18, 18, w - 36, h - 36);
      g2.font = "bold 132px system-ui, -apple-system, 'Segoe UI', sans-serif";
      g2.textAlign = "center";
      g2.textBaseline = "middle";
      g2.fillStyle = s.fg;
      g2.fillText(s.name, w / 2, h / 2 + 6, w - 90);
    });
    const face = glowMat(t, new THREE.MeshStandardMaterial({
      map: tex, emissive: C("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.2, roughness: 0.6,
    }), () => 0.2 + state.night * 0.5, 1.3);
    const side = std("#2a2a30");
    const frame = glowMat(t, std("#2a2a30", { emissive: C("#ffd27a"), emissiveIntensity: 0 }), zero, 2.5);
    const g = new THREE.Group();
    g.position.set(s.pos[0], 0, s.pos[1]);
    const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(7, 3, 0.3), [side, side, side, side, face, side]));
    board.position.y = 4.6;
    const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.5, 0.2), frame));
    back.position.set(0, 4.6, -0.2);
    const p1 = shadowed(new THREE.Mesh(postGeo, postMat));
    p1.position.set(-2.6, 2.6, -0.3);
    const p2 = p1.clone();
    p2.position.x = 2.6;
    g.add(board, back, p1, p2);
    faceCamera(g);
    scene.add(g);
    avoid.push([s.pos[0], s.pos[1], 5]);
  }

  // ---------- lamps (<= 8 PointLights total) ----------
  const bulbMat = new THREE.MeshStandardMaterial({ color: "#fff1d0", emissive: C("#ffc27a"), emissiveIntensity: 0.2 });
  const lampPostGeo = new THREE.CylinderGeometry(0.1, 0.14, 4, 6);
  const bulbGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const pointLights = [];
  const nearAvoid = (x, z, pad) => avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r + pad);
  const LAMPS = 16;
  for (let i = 0; i < LAMPS; i++) {
    const a = (i / LAMPS) * Math.PI * 2 + 0.1;
    const x = Math.cos(a) * LAKE_RX * 1.35;
    const z = Math.sin(a) * LAKE_RZ * 1.35;
    if (nearAvoid(x, z, 1)) continue;
    const post = shadowed(new THREE.Mesh(lampPostGeo, postMat), true, false);
    post.position.set(x, 2, z);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x, 4.25, z);
    scene.add(post, bulb);
    if (pointLights.length < 7 && i % 2 === 0) {
      const pl = new THREE.PointLight(0xffc27a, 0, 24, 1.6);
      pl.position.set(x, 4.4, z);
      scene.add(pl);
      pointLights.push(pl);
    }
  }
  const piazzaLight = new THREE.PointLight(0xffc88a, 0, 26, 1.6);
  piazzaLight.position.set(piazza.x, 5, piazza.z);
  scene.add(piazzaLight);
  pointLights.push(piazzaLight);

  // ---------- trees ----------
  const treeSpots = [];
  for (let tries = 0; treeSpots.length < 80 && tries < 2000; tries++) {
    const x = (Math.random() * 2 - 1) * 125;
    const z = (Math.random() * 2 - 1) * 125;
    const f = Math.sqrt((x / LAKE_RX) ** 2 + (z / LAKE_RZ) ** 2);
    if (f < 1.6 || nearAvoid(x, z, 3) || nearPath(x, z, 3)) continue;
    if (treeSpots.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 4.5)) continue;
    treeSpots.push([x, z, 0.8 + Math.random() * 0.7, Math.random() < 0.5]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.38, 2.2, 6);
  trunkGeo.translate(0, 1.1, 0);
  const coneGeo = new THREE.ConeGeometry(1.9, 4.2, 7);
  coneGeo.translate(0, 4, 0);
  const blobGeo = new THREE.IcosahedronGeometry(2, 0);
  blobGeo.translate(0, 3.6, 0);
  const cones = treeSpots.filter((s) => s[3]);
  const blobs = treeSpots.filter((s) => !s[3]);
  const trunks = shadowed(new THREE.InstancedMesh(trunkGeo, std("#6b4a32"), treeSpots.length));
  const coneMesh = shadowed(new THREE.InstancedMesh(coneGeo, std(0xffffff), Math.max(1, cones.length)));
  const blobMesh = shadowed(new THREE.InstancedMesh(blobGeo, std(0xffffff), Math.max(1, blobs.length)));
  const leafCols = ["#4f7a3a", "#5f8a3c", "#3f6a35", "#c07a3a", "#a5552f", "#d29a3f"].map(C);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const place = (mesh, i, x, z, s) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
    m4.compose(v.set(x, 0, z), q, sc.set(s, s, s));
    mesh.setMatrixAt(i, m4);
  };
  treeSpots.forEach(([x, z, s], i) => place(trunks, i, x, z, s));
  cones.forEach(([x, z, s], i) => {
    place(coneMesh, i, x, z, s);
    coneMesh.setColorAt(i, leafCols[i % 3]);
  });
  blobs.forEach(([x, z, s], i) => {
    place(blobMesh, i, x, z, s);
    blobMesh.setColorAt(i, leafCols[(i * 7) % leafCols.length]);
  });
  coneMesh.count = cones.length;
  blobMesh.count = blobs.length;
  scene.add(trunks, coneMesh, blobMesh);

  // ---------- reeds & rocks ----------
  const stalkGeo = new THREE.CylinderGeometry(0.035, 0.06, 1, 4);
  stalkGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.4, 5);
  const reedSpots = [];
  for (let c = 0; c < 24; c++) {
    const a = Math.random() * Math.PI * 2;
    const f = 0.96 + Math.random() * 0.07;
    const cx = Math.cos(a) * LAKE_RX * f;
    const cz = Math.sin(a) * LAKE_RZ * f;
    for (let k = 0; k < 9; k++) {
      reedSpots.push([cx + (Math.random() - 0.5) * 2.2, cz + (Math.random() - 0.5) * 1.6, 1.3 + Math.random() * 1.3, (Math.random() - 0.5) * 0.25]);
    }
  }
  const stalks = new THREE.InstancedMesh(stalkGeo, std("#6b7d3a"), reedSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, std("#5a3a22"), reedSpots.length);
  const e = new THREE.Euler();
  reedSpots.forEach(([x, z, h, tilt], i) => {
    q.setFromEuler(e.set(tilt, 0, tilt * 0.7));
    m4.compose(v.set(x, 0, z), q, sc.set(1, h, 1));
    stalks.setMatrixAt(i, m4);
    const top = new THREE.Vector3(0, h * 0.9, 0).applyQuaternion(q);
    m4.compose(v.set(x + top.x, top.y, z + top.z), q, sc.set(1, 1, 1));
    heads.setMatrixAt(i, m4);
  });
  stalks.castShadow = true;
  scene.add(stalks, heads);

  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMats = [std("#8b8a86"), std("#a29f97"), std("#76736d")];
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const f = 1.0 + Math.random() * 0.08;
    const rock = shadowed(new THREE.Mesh(rockGeo, rockMats[i % 3]));
    const s = 0.4 + Math.random() * 0.9;
    rock.scale.set(s * 1.3, s * 0.7, s);
    rock.rotation.set(Math.random(), Math.random() * 3, Math.random());
    rock.position.set(Math.cos(a) * LAKE_RX * f, s * 0.2, Math.sin(a) * LAKE_RZ * f);
    scene.add(rock);
  }

  // ---------- API ----------
  function isInLake(x, z) {
    return (x / LAKE_RX) ** 2 + (z / LAKE_RZ) ** 2 < 1;
  }
  function randomLakePoint() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.88;
    return new THREE.Vector3(Math.cos(a) * LAKE_RX * r, WATER_Y, Math.sin(a) * LAKE_RZ * r);
  }
  function randomShorePoint() {
    const a = Math.random() * Math.PI * 2;
    const f = 1.12 + Math.random() * 0.33;
    return new THREE.Vector3(Math.cos(a) * LAKE_RX * f, 0, Math.sin(a) * LAKE_RZ * f);
  }
  function highlight(word) {
    if (typeof word !== "string") return;
    const k = word.toLowerCase().trim();
    const t = keyMap.get(k) || keyMap.get(k.replace(/[^a-z0-9.]/g, "")) || keyMap.get(k.replace(/[^a-z0-9]/g, ""));
    if (t) t.glow = Math.min(1.6, Math.max(1, t.glow + 0.6));
  }

  const sunDusk = C("#fff6e5");
  const sunNight = C("#7d8fd0");
  const hemiSkyDusk = C("#ffffff");
  const hemiSkyNight = C("#2a3a70");
  const hemiGroundDusk = C("#6a8a4a");
  const hemiGroundNight = C("#10180f");
  function setNight(t) {
    const n = Math.min(1, Math.max(0, Number(t) || 0));
    state.night = n;
    state.lampOn = smoothstep(0.15, 0.55, n);
    skyMat.uniforms.top.value.copy(sky.top).lerp(sky.topNight, n);
    skyMat.uniforms.horizon.value.copy(sky.horizon).lerp(sky.horizonNight, n);
    scene.background.copy(sky.horizon).lerp(sky.horizonNight, n);
    scene.fog.color.copy(sky.fog).lerp(sky.fogNight, n);
    sun.color.copy(sunDusk).lerp(sunNight, n);
    sun.intensity = 3.0 + (0.3 - 3.0) * n;
    hemi.color.copy(hemiSkyDusk).lerp(hemiSkyNight, n);
    hemi.groundColor.copy(hemiGroundDusk).lerp(hemiGroundNight, n);
    hemi.intensity = 1.3 + (0.3 - 1.3) * n;
    starMat.opacity = smoothstep(0.4, 1, n);
    bulbMat.emissiveIntensity = 0.2 + state.lampOn * 3;
    pointLights.forEach((pl) => (pl.intensity = state.lampOn * 40));
  }
  function flash(color) {
    try {
      flashLight.color.set(color ?? 0xffffff);
    } catch {
      flashLight.color.set(0xffffff);
    }
    state.flash = 1;
  }

  const wpos = waterGeo.attributes.position;
  function update(dt, time) {
    for (let i = 0; i < wpos.count; i++) {
      const x = waterBase[i * 3];
      const z = waterBase[i * 3 + 2];
      const r2 = (x / LAKE_RX) ** 2 + (z / LAKE_RZ) ** 2;
      const edge = Math.min(1, (1 - r2) * 4);
      const wave = Math.sin(x * 0.35 + time * 1.3) * 0.05 + Math.cos(z * 0.45 - time * 1.1) * 0.04
        + Math.sin((x + z) * 0.8 + time * 2.1) * 0.02;
      wpos.setY(i, 0.14 + wave * Math.max(0, edge));
    }
    wpos.needsUpdate = true;
    waterGeo.computeVertexNormals();

    for (const t of targets) {
      if (t.glow > 0) t.glow = Math.max(0, t.glow - dt / 1.5);
      const pulse = t.glow > 0 ? t.glow * (0.7 + 0.3 * Math.sin(time * 14)) : 0;
      for (const en of t.entries) en.mat.emissiveIntensity = en.base() + pulse * en.amp;
      if (t.label) t.label.scale.copy(t.labelScale).multiplyScalar(1 + 0.25 * pulse);
    }

    clouds.rotation.y = time * 0.004;

    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt / 0.4);
    flashLight.intensity = state.flash * state.flash * 5;
  }

  setNight(0);

  return {
    lake: { center: new THREE.Vector3(0, WATER_Y, 0), radiusX: LAKE_RX, radiusZ: LAKE_RZ, waterY: WATER_Y },
    isInLake,
    randomLakePoint,
    randomShorePoint,
    piazza,
    highlight,
    setNight,
    flash,
    update,
  };
}
