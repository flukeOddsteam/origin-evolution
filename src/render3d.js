// Three.js renderer: the same living world as the 2D map, as a low-poly 3D landscape.
// Terrain uses the 2D renderer's biome texture; every creature is assembled from shared
// primitives and drawn with GPU instancing so thousands can be on screen at once.
/* global THREE */
import { WORLD_W, WORLD_H, CELL, GW, GH, B, BIOMES, hash } from "./sim/world.js";
import { archetypeOf } from "./sim/archetypes.js";
import { paletteFor } from "./creatures.js";
import { MODELS, farPart, animate, PLACEMENT, BOB } from "./models3d.js";
import { DAY_TICKS } from "./render.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const LAND_SCALE = 360, SEA_SCALE = 170; // vertical exaggeration above / below sea level
const CAP = { sph: 16000, ico: 12000, cone: 10000, cyl: 20000, box: 8000, tet: 3000, torus: 600 };
// creatures use their own smooth-shaded, higher-resolution primitives
const CCAP = { sph: 32000, ico: 3000, cone: 12000, cyl: 12000, tcyl: 30000, box: 9000, tet: 3000, torus: 2000, ring: 8000 };
// planet ("globe") mode: the flat world is wrapped round a small sphere floating in space
export const PLANET_R = WORLD_W / TAU;          // equator length = world width, so x keeps its scale
const LAT_SPAN = Math.PI * 0.86;               // the map covers this band of latitude; ice caps close the poles
const GLOBE_VS = 0.12;                         // relief exaggeration on the planet (mountains stay readable from orbit)
const SOUTH_K = (PLANET_R * LAT_SPAN) / WORLD_H; // surface distance per world unit north-south
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapDX = (dx) => (dx > WORLD_W / 2 ? dx - WORLD_W : dx < -WORLD_W / 2 ? dx + WORLD_W : dx);

const ATMO_VS = `varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
vW = normalize((modelMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * mv; }`;
const ATMO_FS = `uniform vec3 col; uniform vec3 sun; uniform float pw; uniform float k; uniform float inner; uniform float gain;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ float d = dot(vN, vV);
float f = inner > 0.5 ? pow(clamp(1.0 - d, 0.0, 1.0), pw) : pow(clamp(-d / k, 0.0, 1.0), pw);
float lit = 0.18 + 0.82 * smoothstep(-0.3, 0.45, dot(vW, sun));
vec3 c = mix(vec3(1.0, 0.55, 0.35), col, smoothstep(-0.1, 0.35, dot(vW, sun)));
gl_FragColor = vec4(c * f * lit * gain, f * lit * gain); }`;

export function webglAvailable() {
  if (typeof THREE === "undefined") return false;
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

export class Renderer3D {
  constructor(canvas, sim, map2d) {
    this.canvas = canvas;
    this.map2d = map2d; // supplies the biome texture and minimap
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 2, 8000);
    this.cam = { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 1, yaw: 0.35, pitch: 0.95 };
    this.selected = null; this.follow = false; this.effects = true; this.weather = true;
    this.frame = 0;
    this._m = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._l = new THREE.Matrix4(); this._t = new THREE.Matrix4();
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._one = new THREE.Vector3(1, 1, 1);
    this._c = new THREE.Color(); this._anim = { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 };
    this._fm = new THREE.Matrix4(); this._fq = new THREE.Quaternion(); this._gp = new THREE.Vector3(); this._n = new THREE.Vector3();
    this._e1 = new THREE.Vector3(); this._u1 = new THREE.Vector3(); this._s1 = new THREE.Vector3(); this._h1 = new THREE.Vector3(); this._d1 = new THREE.Vector3();
    this.globe = false; this.vs = 1; this.sunDir = new THREE.Vector3(1, 0.2, 0).normalize();
    this.raycaster = new THREE.Raycaster();
    this.buildStatic();
    this.setSim(sim);
    this.resize();
  }

  // ------------------------------------------------------------ scene setup
  buildStatic() {
    const S = this.scene;
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x4a3b28, 0.75); S.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 0.9); S.add(this.sun); S.add(this.sun.target);
    S.fog = new THREE.Fog(0x8fb8d8, 1500, 5200);

    this.geos = {
      sph: new THREE.IcosahedronGeometry(1, 1), ico: new THREE.IcosahedronGeometry(1, 0), cone: new THREE.ConeGeometry(1, 2, 6), cyl: new THREE.CylinderGeometry(1, 1, 2, 6),
      box: new THREE.BoxGeometry(2, 2, 2), tet: new THREE.TetrahedronGeometry(1), torus: new THREE.TorusGeometry(1, 0.45, 5, 9),
    };
    const mat = new THREE.MeshPhongMaterial({ flatShading: true, shininess: 12 });
    this.inst = {};
    for (const k of Object.keys(this.geos)) {
      const m = new THREE.InstancedMesh(this.geos[k], mat, CAP[k]);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      m.frustumCulled = false; m.count = 0;
      S.add(m); this.inst[k] = m;
    }
    const cgeo = {
      sph: new THREE.SphereGeometry(1, 14, 10), ico: new THREE.IcosahedronGeometry(1, 1), cone: new THREE.ConeGeometry(1, 2, 12), cyl: new THREE.CylinderGeometry(1, 1, 2, 10),
      tcyl: new THREE.CylinderGeometry(1, 0.6, 2, 10), box: new THREE.BoxGeometry(2, 2, 2), tet: new THREE.TetrahedronGeometry(1), torus: new THREE.TorusGeometry(1, 0.45, 8, 18), ring: new THREE.TorusGeometry(1, 0.09, 5, 26),
    };
    const cmat = new THREE.MeshPhongMaterial({ shininess: 22, specular: 0x1c1c1c });
    this.cinst = {};
    for (const k of Object.keys(cgeo)) {
      const m = new THREE.InstancedMesh(cgeo[k], cmat, CCAP[k]);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1));
      m.frustumCulled = false; m.count = 0; S.add(m); this.cinst[k] = m;
    }
    // glowing things that ignore lighting: windows, fires, rockets
    this.glow = new THREE.InstancedMesh(this.geos.box, new THREE.MeshBasicMaterial({ color: 0xffd27a }), 4000);
    this.glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.glow.frustumCulled = false; this.glow.count = 0; S.add(this.glow);

    this.water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W * 3, WORLD_H * 3, 1, 1), new THREE.MeshPhongMaterial({ color: 0x2c7fb3, transparent: true, opacity: 0.6, shininess: 90, specular: 0x88bbdd }));
    this.water.rotation.x = -Math.PI / 2; this.water.position.set(WORLD_W / 2, 0, WORLD_H / 2); S.add(this.water);

    this.cloudMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 7), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x3a4250, transparent: true, opacity: 0.82 }), 3200);
    this.cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.cloudMesh.frustumCulled = false; this.cloudMesh.count = 0; S.add(this.cloudMesh);

    const rg = new THREE.BufferGeometry(); this.rainPos = new Float32Array(1800 * 3); rg.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xcfe2ff, size: 2.2, transparent: true, opacity: 0.7, sizeAttenuation: true }));
    this.rain.frustumCulled = false; S.add(this.rain);
    this.rainSeed = Array.from({ length: 1800 }, () => [Math.random(), Math.random(), Math.random()]);

    this.ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
    this.ring.renderOrder = 10; this.ring.visible = false; this.ring.matrixAutoUpdate = false; S.add(this.ring);
    this.buildSpace();
  }

  /** Planet-mode scenery: ocean sphere, ice caps, atmosphere glow, stars, sun and moon. */
  buildSpace() {
    const S = this.scene, R = PLANET_R;
    this.space = new THREE.Group(); this.space.visible = false; S.add(this.space);
    this.ocean = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshPhongMaterial({ color: 0x2a86c8, transparent: true, opacity: 0.74, shininess: 160, specular: 0x30506a }));
    this.space.add(this.ocean);
    const capT = Math.PI / 2 - LAT_SPAN / 2 + 0.03, iceM = new THREE.MeshPhongMaterial({ color: 0xeef6ff, flatShading: true, shininess: 30 });
    const north = new THREE.Mesh(new THREE.SphereGeometry(R + 1.6, 64, 6, 0, TAU, 0, capT), iceM);
    const south = new THREE.Mesh(new THREE.SphereGeometry(R + 1.6, 64, 6, 0, TAU, Math.PI - capT, capT), iceM);
    this.space.add(north, south);
    const atmo = (radius, side, inner, pw, k, gain) => new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Color(0x6cc8ff) }, sun: { value: this.sunDir }, pw: { value: pw }, k: { value: k }, inner: { value: inner }, gain: { value: gain } },
      vertexShader: ATMO_VS, fragmentShader: ATMO_FS, side, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.atmoOuter = atmo(R * 1.17, THREE.BackSide, 0, 2.2, Math.sqrt(1 - 1 / (1.17 * 1.17)), 1.15);
    this.atmoInner = atmo(R + 2.4, THREE.FrontSide, 1, 3.2, 1, 0.9);
    this.space.add(this.atmoOuter, this.atmoInner);
    // starfield on a far shell
    const N = 2600, sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) {
      const u = hash(k, 1, 91) * 2 - 1, a = hash(k, 2, 91) * TAU, r = Math.sqrt(1 - u * u), d = 5200;
      sp[k * 3] = Math.cos(a) * r * d; sp[k * 3 + 1] = u * d; sp[k * 3 + 2] = Math.sin(a) * r * d;
      const t = hash(k, 3, 91), b = 0.45 + hash(k, 4, 91) * 0.55;
      sc[k * 3] = b * (t > 0.8 ? 0.75 : 1); sc[k * 3 + 1] = b * (t > 0.8 ? 0.85 : t < 0.15 ? 0.85 : 1); sc[k * 3 + 2] = b * (t < 0.15 ? 0.7 : 1);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("color", new THREE.BufferAttribute(sc, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    this.space.add(this.stars);
    // a distant sun with a halo and a small moon on an inclined orbit
    this.sunBall = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff2c4 }));
    this.sunHalo = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.moon = new THREE.Mesh(new THREE.IcosahedronGeometry(34, 1), new THREE.MeshPhongMaterial({ color: 0xb9b4ad, flatShading: true, shininess: 2 }));
    this.space.add(this.sunBall, this.sunHalo, this.moon);
  }

  /** Switch between the flat 3D landscape and the round planet. */
  setGlobe(on) {
    on = !!on;
    if (on === this.globe && this.terrain) return;
    this.globe = on; this.vs = on ? GLOBE_VS : 1;
    this.space.visible = on; this.water.visible = !on;
    this.camera.near = on ? 0.8 : 2; this.camera.far = on ? 12000 : 8000; this.camera.updateProjectionMatrix();
    if (on) { this.hemi.color.setHex(0x8fa8d8); this.hemi.groundColor.setHex(0x8fa8d8); }
    else { this.hemi.color.setHex(0xcfe6ff); this.hemi.groundColor.setHex(0x4a3b28); }
    if (this.sim) this.setSim(this.sim);
    this.clampCam();
  }

  // ------------------------------------------------------------ planet mapping
  /** Unit surface normal for world point (x, z). */
  globeN(x, z, out) {
    const lon = (x / WORLD_W) * TAU, lat = (0.5 - z / WORLD_H) * LAT_SPAN, cl = Math.cos(lat);
    return out.set(cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon));
  }
  /** Local frame at (x, z): east, up, south — the planet versions of the flat +x, +y, +z. */
  globeFrame(x, z) {
    const lon = (x / WORLD_W) * TAU, lat = (0.5 - z / WORLD_H) * LAT_SPAN, cl = Math.cos(lat), sl = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
    this._e1.set(co, 0, -so); this._u1.set(cl * so, sl, cl * co); this._s1.set(sl * so, -cl, sl * co);
    return cl;
  }
  /** Flat world coordinates (x, height, z) to scene position. */
  point(x, y, z, out) {
    if (!this.globe) return out.set(x, y, z);
    return this.globeN(x, z, out).multiplyScalar(PLANET_R + y);
  }
  /** Matrix4.compose that respects the planet: p is flat (x, height, z), q and s are in the local frame. */
  compose(m, p, q, s) {
    if (!this.globe) return m.compose(p, q, s);
    this.globeFrame(p.x, p.z);
    this._fm.makeBasis(this._e1, this._u1, this._s1); this._fq.setFromRotationMatrix(this._fm).multiply(q);
    this._gp.copy(this._u1).multiplyScalar(PLANET_R + p.y);
    return m.compose(this._gp, this._fq, s);
  }
  /** Is the surface point (x, z) on the side of the planet facing the camera? */
  facing(x, z, margin = 0.02) {
    const C = this.camera.position, n = this.globeN(x, z, this._n);
    return n.dot(C) > (PLANET_R * PLANET_R) / Math.max(PLANET_R + 1, C.length()) - margin * PLANET_R;
  }
  toFlat(v) {
    const r = v.length() || 1;
    let lon = Math.atan2(v.x, v.z); if (lon < 0) lon += TAU;
    const lat = Math.asin(clamp(v.y / r, -1, 1));
    return { x: (lon / TAU) * WORLD_W, y: clamp((0.5 - lat / LAT_SPAN) * WORLD_H, 0, WORLD_H) };
  }

  setSim(sim) {
    this.sim = sim;
    if (this.terrain) { this.scene.remove(this.terrain); this.terrain.geometry.dispose(); }
    if (this.riverGroup) { this.scene.remove(this.riverGroup); this.riverGroup.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.buildTerrain();
    this.buildRivers();
    this.floraAt = null; this.civAt = -1;
  }

  heightAt(x, z) {
    const w = this.sim.world, H = w.height;
    const gx = clamp(x / CELL - 0.5, 0, GW - 1.001), gy = clamp(z / CELL - 0.5, 0, GH - 1.001);
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const i = y0 * GW + x0;
    const h = (H[i] * (1 - fx) + H[i + 1] * fx) * (1 - fy) + (H[i + GW] * (1 - fx) + H[i + GW + 1] * fx) * fy;
    const d = h - w.sea;
    return (d >= 0 ? d * LAND_SCALE : d * SEA_SCALE) * this.vs;
  }

  buildTerrain() {
    const geo = new THREE.PlaneGeometry(WORLD_W, WORLD_H, GW * 4, GH * 4);
    geo.rotateX(-Math.PI / 2); geo.translate(WORLD_W / 2, 0, WORLD_H / 2);
    const pos = geo.attributes.position, v = this._p;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      this.point(x, this.heightAt(x, z), z, v); pos.setXYZ(k, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    this.texture = new THREE.CanvasTexture(this.map2d.tex);
    this.texture.anisotropy = 8; this.texture.magFilter = THREE.LinearFilter; this.texture.minFilter = THREE.LinearFilter; this.texture.generateMipmaps = false;
    this.terrain = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: this.texture, flatShading: true, shininess: 4 }));
    this.scene.add(this.terrain);
    if (this.globe) return;
    // a skirt under the map edges so the world reads as a solid island block
    const base = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, 60, WORLD_H), new THREE.MeshPhongMaterial({ color: 0x0b1a2e }));
    base.position.set(WORLD_W / 2, -SEA_SCALE * 0.4 - 30, WORLD_H / 2); this.terrain.add(base);
  }

  buildRivers() {
    this.riverGroup = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0x3a86b8, shininess: 80, flatShading: true });
    for (const path of this.sim.world.rivers) {
      const pts = path.map((i) => { const x = (i % GW + 0.5) * CELL + (hash(i, 3, 1) - 0.5) * 8, z = (((i / GW) | 0) + 0.5) * CELL + (hash(i, 4, 1) - 0.5) * 8; return new THREE.Vector3(x, Math.max(0.6, this.heightAt(x, z) + 0.8), z); });
      if (pts.length < 2) continue;
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 4, 2.4, 4, false);
      tube.scale(1, 0.25, 1);
      tube.translate(0, 0, 0);
      const m = new THREE.Mesh(tube, mat);
      this.riverGroup.add(m);
    }
    // tube was flattened around y=0, lift each vertex back onto its own path height
    const v = this._p, lift = this.globe ? 0.35 : 0.7;
    this.riverGroup.children.forEach((m) => {
      const p = m.geometry.attributes.position;
      for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k); this.point(x, Math.max(lift * 0.7, this.heightAt(x, z) + lift), z, v); p.setXYZ(k, v.x, v.y, v.z); }
      m.geometry.computeVertexNormals();
    });
    this.scene.add(this.riverGroup);
  }

  // ------------------------------------------------------------ camera
  get distance() { return 1100 / this.cam.zoom; }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    this.fit = 0.5;
    this.cam.zoom = clamp(this.cam.zoom, this.minZoom(), this.maxZoom());
  }
  minZoom() { return this.globe ? 0.42 : 0.45; }
  maxZoom() { return this.globe ? 12 : 8; }
  /** 0 = standing on the surface, 1 = looking at the whole planet from orbit. */
  orbitT() { return this.globe ? smooth(220, 1250, this.distance) : 0; }
  clampCam() {
    const c = this.cam;
    if (this.globe) { c.x = ((c.x % WORLD_W) + WORLD_W) % WORLD_W; c.y = clamp(c.y, 20, WORLD_H - 20); c.pitch = clamp(c.pitch, 0.3, 1.5); }
    else { c.x = clamp(c.x, 0, WORLD_W); c.y = clamp(c.y, 0, WORLD_H); c.pitch = clamp(c.pitch, 0.25, 1.45); }
    c.zoom = clamp(c.zoom, this.minZoom(), this.maxZoom());
  }
  placeCamera() {
    if (this.globe) return this.placeGlobeCamera();
    this.camera.up.set(0, 1, 0);
    const c = this.cam, d = this.distance, ty = Math.max(0, this.heightAt(c.x, c.y));
    this.camera.position.set(c.x + Math.sin(c.yaw) * Math.cos(c.pitch) * d, ty + Math.sin(c.pitch) * d, c.y + Math.cos(c.yaw) * Math.cos(c.pitch) * d);
    this.camera.lookAt(c.x, ty, c.y);
  }
  placeGlobeCamera() {
    const c = this.cam, d = this.distance, t = this.orbitT();
    this.globeFrame(c.x, c.y);
    const ground = PLANET_R + Math.max(0, this.heightAt(c.x, c.y));
    const pe = c.pitch + (Math.PI / 2 - 0.001 - c.pitch) * t; // zoomed out, the camera swings to look straight down at the planet
    const h = this._h1.copy(this._s1).multiplyScalar(Math.cos(c.yaw)).addScaledVector(this._e1, Math.sin(c.yaw));
    const dir = this._d1.copy(this._u1).multiplyScalar(Math.sin(pe)).addScaledVector(h, Math.cos(pe));
    const target = this._gp.copy(this._u1).multiplyScalar(ground * (1 - t));
    this.camera.position.copy(target).addScaledVector(dir, d + PLANET_R * t * 0.25);
    this.camera.up.copy(this._u1).multiplyScalar(Math.cos(pe)).addScaledVector(h, -Math.sin(pe));
    this.camera.lookAt(target);
  }
  pan(dx, dy) {
    const c = this.cam, t = this.orbitT();
    const k = ((this.globe ? this.distance - (PLANET_R - 40) * t : this.distance) * 1.1) / this.h;
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw); // screen up = forward on the ground
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    let ex = (dx * rx - dy * fx) * k, ez = (dx * rz - dy * fz) * k;
    if (this.globe) { const cl = Math.cos((0.5 - c.y / WORLD_H) * LAT_SPAN); ex /= Math.max(0.25, cl); ez /= SOUTH_K; }
    c.x -= ex; c.y -= ez;
    this.follow = false; this.clampCam();
  }
  rotate(dyaw, dpitch) { this.cam.yaw += dyaw; this.cam.pitch += dpitch; this.clampCam(); }
  zoomAt(sx, sy, factor) {
    const p = this.toWorld(sx, sy);
    this.cam.zoom = clamp(this.cam.zoom * factor, this.minZoom(), this.maxZoom());
    if (p && p.hit && factor > 1) { const t = 1 - 1 / factor; this.cam.x += (this.globe ? wrapDX(p.x - this.cam.x) : p.x - this.cam.x) * t; this.cam.y += (p.y - this.cam.y) * t; }
    this.clampCam();
  }
  /** Turn the planet so the morning side faces the camera. */
  faceSun() {
    const p = (this.sim.tick % DAY_TICKS) / DAY_TICKS, lon = Math.PI - (p - 0.25) * TAU - 0.6;
    this.cam.x = (((lon / TAU) % 1) + 1) % 1 * WORLD_W;
  }
  focus(x, y, zoom) { this.cam.x = x; this.cam.y = y; if (zoom) this.cam.zoom = clamp(zoom, this.minZoom(), this.maxZoom()); this.clampCam(); }
  fitWorld() {
    if (this.globe) { this.cam.zoom = 0.85; this.cam.y = WORLD_H * 0.45; this.cam.pitch = 0.9; this.follow = false; return; }
    this.cam.zoom = this.minZoom(); this.cam.x = WORLD_W / 2; this.cam.y = WORLD_H / 2; this.cam.pitch = 0.95; this.follow = false;
  }
  toWorld(sx, sy) {
    this.placeCamera(); this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera({ x: (sx / this.w) * 2 - 1, y: -(sy / this.h) * 2 + 1 }, this.camera);
    const hits = this.raycaster.intersectObjects(this.globe ? [this.terrain, this.ocean] : [this.terrain, this.water], false);
    if (!hits.length) return { x: this.cam.x, y: this.cam.y, hit: false };
    const p = hits[0].point;
    if (this.globe) return { ...this.toFlat(p), hit: true };
    return { x: p.x, y: p.z, hit: true };
  }
  /** Rough ground footprint of the view, for culling and the minimap rectangle. */
  view() { const r = this.globe ? Math.min(700, this.distance * 0.6) : this.distance * 0.9; return { x0: this.cam.x - r, x1: this.cam.x + r, y0: this.cam.y - r * 0.7, y1: this.cam.y + r * 0.7 }; }

  // ------------------------------------------------------------ day / night (shared clock with 2D)
  night() { const p = (this.sim.tick % DAY_TICKS) / DAY_TICKS; return clamp(0.15 - Math.sin(p * TAU) * 1.3, 0, 1); }
  dayLabel() { const p = (this.sim.tick % DAY_TICKS) / DAY_TICKS; const h = (6 + p * 24) % 24; return `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`; }

  // ------------------------------------------------------------ instancing helpers
  resetInstances() { for (const k in this.inst) this.inst[k].count = this.base?.[k] || 0; for (const k in this.cinst) this.cinst[k].count = 0; this.glow.count = this.glowBase || 0; }
  /** Add one creature part (smooth primitives, separate from scenery). */
  pushC(geo, matrix, color) {
    const m = this.cinst[geo] || this.cinst.sph;
    if (m.count >= CCAP[geo]) return;
    m.setMatrixAt(m.count, matrix); m.setColorAt(m.count, color); m.count++;
  }
  push(geo, matrix, color) {
    const m = this.inst[geo];
    if (m.count >= CAP[geo]) return;
    m.setMatrixAt(m.count, matrix); m.setColorAt(m.count, color); m.count++;
  }
  /** Compose one part's world matrix: base · T(p) · R(rot+anim) · T(pivot) · S(scale). */
  partMatrix(base, part, anim) {
    const e = this._e, a = anim;
    e.set(part.rx + (a ? a.x : 0), part.ry + (a ? a.y : 0), part.rz + (a ? a.z : 0));
    this._q.setFromEuler(e);
    this._p.set(part.px + (a ? a.px : 0), part.py + (a ? a.py : 0), part.pz + (a ? a.pz : 0));
    if (!part.pivot) { this._s.set(part.sx, part.sy, part.sz); this._l.compose(this._p, this._q, this._s); }
    else {
      this._l.compose(this._p, this._q, this._one);
      const box = part.g === "box";
      const ox = part.pivot === "x" && box ? -part.sx : 0;
      const oy = part.pivot === "y" ? -part.sy : !box ? part.sy + (part.off || 0) : 0;
      const oz = box && part.pivot === "z+" ? part.sz + (part.off || 0) : box && part.pivot === "z-" ? -part.sz - (part.off || 0) : 0;
      this._t.makeScale(part.sx, part.sy, part.sz); this._t.setPosition(ox, oy, oz);
      this._l.multiply(this._t);
    }
    return this._m.multiplyMatrices(base, this._l);
  }

  colorsFor(sp, arch) {
    const P = paletteFor(sp, arch);
    if (sp._c3Src === P && sp._c3) return sp._c3;
    const mk = (css) => new THREE.Color().setStyle(css.replace(/hsla\(([^,]+),([^,]+),([^,]+),[^)]+\)/, "hsl($1,$2,$3)"));
    sp._c3 = { b: mk(P.base), d: mk(P.dark), l: mk(P.light), e: new THREE.Color(0x14161c), w: new THREE.Color(0xf2ece0), k: new THREE.Color(0x1b1712) };
    sp._c3Src = P;
    return sp._c3;
  }

  // ------------------------------------------------------------ flora & settlements (rebuilt occasionally)
  buildFlora() {
    const w = this.sim.world, c = this.cam, G = this.globe, R = G ? Math.min(1100, this.distance * 1.6) : Math.min(900, this.distance * 1.3);
    let cx0 = Math.floor((c.x - R) / CELL), cx1 = Math.floor((c.x + R) / CELL);
    if (!G) { cx0 = Math.max(0, cx0); cx1 = Math.min(GW - 1, cx1); } else if (cx1 - cx0 >= GW) { cx0 = 0; cx1 = GW - 1; }
    const cy0 = Math.max(0, ((c.y - R) / CELL) | 0), cy1 = Math.min(GH - 1, ((c.y + R) / CELL) | 0);
    const col = this._c, m = this._m, q = this._q, p = this._p, s = this._s;
    const put = (geo, x, y, z, sx, sy, sz, hex, rx = 0, rz = 0) => { this._e.set(rx, 0, rz); q.setFromEuler(this._e); p.set(x, y, z); s.set(sx, sy, sz); this.compose(m, p, q, s); col.setHex(hex); this.push(geo, m, col); };
    const dense = this.distance < (G ? 450 : 700), orbit = G && this.distance > 900;
    for (let cy = cy0; cy <= cy1; cy++) for (let cxr = cx0; cxr <= cx1; cxr++) {
      const cx = ((cxr % GW) + GW) % GW;
      if (G && !this.facing((cx + 0.5) * CELL, (cy + 0.5) * CELL, 0.06)) continue;
      const i = cy * GW + cx, b = w.biome[i], max = BIOMES[b].plant || 1;
      const water = w.isWater(i);
      const dens = clamp(w.bio[i] / (max * 0.9), 0, 1) * (water ? 1 : w.green[i]);
      const n = Math.round(dens * (dense ? 4 : orbit ? 1.4 : 2));
      for (let k = 0; k < n; k++) {
        const x = cx * CELL + hash(i, k, 17) * CELL, z = cy * CELL + hash(i, k, 29) * CELL, h3 = hash(i, k, 43), y = this.heightAt(x, z), sc = 0.8 + h3 * 0.7;
        if (w.farm[i]) { put("box", x, y + 1, z, 2.5, 1, 0.4, h3 > 0.5 ? 0xd9b44a : 0x9cbf4a); continue; }
        switch (b) {
          case B.JUNGLE:
            if (k % 3 === 0) { put("cyl", x, y + 6 * sc, z, 0.5, 6 * sc, 0.5, 0x7a5a34); for (let f = 0; f < 5; f++) { const a = f / 5 * TAU + h3; put("box", x + Math.cos(a) * 3 * sc, y + 12 * sc, z + Math.sin(a) * 3 * sc, 3.2 * sc, 0.25, 0.9 * sc, 0x3f8f3a, 0, 0); } }
            else { put("cyl", x, y + 3 * sc, z, 0.7, 3 * sc, 0.7, 0x6b4e2e); put("ico", x, y + 8 * sc, z, 5 * sc, 4 * sc, 5 * sc, k % 2 ? 0x1f6a30 : 0x2a7d38); }
            break;
          case B.FOREST:
            put("cyl", x, y + 2.5 * sc, z, 0.6, 2.5 * sc, 0.6, 0x6b5232); put("ico", x, y + 7 * sc, z, 4.2 * sc, 4 * sc, 4.2 * sc, h3 > 0.5 ? 0x3b8a3e : 0x5a9a3a);
            break;
          case B.TAIGA: case B.TUNDRA:
            if (b === B.TUNDRA && k % 2) { put("ico", x, y + 0.5, z, 1.4, 0.8, 1.4, 0x8a8f7a); break; }
            put("cyl", x, y + 1.5, z, 0.5, 1.5, 0.5, 0x5a4026); put("cone", x, y + 6 * sc, z, 2.8 * sc, 4.5 * sc, 2.8 * sc, 0x1e4a3a); put("cone", x, y + 9.5 * sc, z, 2 * sc, 3 * sc, 2 * sc, w.temp[i] < 0.2 ? 0xe8f0f6 : 0x245a44);
            break;
          case B.GRASS:
            put("cone", x, y + 1, z, 0.9, 1.2, 0.9, 0x6aa042);
            if (h3 > 0.65) put("sph", x + 1.5, y + 1.6, z, 0.6, 0.6, 0.6, [0xf4d35e, 0xee6c9d, 0xffffff, 0xb388eb][(h3 * 40 | 0) % 4]);
            if (k === 0 && h3 > 0.75) { put("cyl", x, y + 2.5, z, 0.6, 2.5, 0.6, 0x6b5232); put("ico", x, y + 7, z, 4, 3.6, 4, 0x4a8f3e); }
            break;
          case B.SAVANNA:
            if (k === 0 && h3 > 0.4) { put("cyl", x, y + 3.5, z, 0.5, 3.5, 0.5, 0x6b5232); put("ico", x, y + 7.5, z, 6, 1.4, 6, 0x6f8f3a); }
            else put("cone", x, y + 1, z, 0.9, 1.3, 0.9, 0xb8a35a);
            break;
          case B.DESERT:
            if (h3 > 0.6) { put("cyl", x, y + 3, z, 0.8, 3, 0.8, 0x4f8a46); put("cyl", x + 1.4, y + 3.5, z, 0.5, 1.4, 0.5, 0x4f8a46); put("cyl", x - 1.3, y + 4, z, 0.5, 1.2, 0.5, 0x4f8a46); }
            else put("ico", x, y + 0.5, z, 1.4, 0.8, 1.2, 0xb59a6a);
            break;
          case B.BEACH:
            if (w.temp[i] > 0.6 && h3 > 0.5) { put("cyl", x, y + 5, z, 0.45, 5, 0.45, 0x7a5a34, 0, 0.15); for (let f = 0; f < 5; f++) { const a = f / 5 * TAU; put("box", x + 0.75 + Math.cos(a) * 2.6, y + 10, z + Math.sin(a) * 2.6, 2.8, 0.2, 0.8, 0x3f8f3a); } }
            break;
          case B.REEF:
            put(k % 2 ? "ico" : "cone", x, y + 1.2, z, 1.4 * sc, 1.6 * sc, 1.4 * sc, [0xe8806f, 0xe5a65a, 0xb68ad8, 0xe07aa0, 0xd9c470][(h3 * 50 | 0) % 5]);
            break;
          case B.KELP:
            put("cyl", x, y + (-y) / 2, z, 0.35, Math.max(1, -y / 2), 0.35, 0x6d6a2c, 0.1 * Math.sin(h3 * 9), 0.1);
            break;
          default:
            if (!water && h3 > 0.8) put("ico", x, y + 0.6, z, 1.5, 1, 1.5, 0x8b8378);
        }
      }
      if (!water && w.decay[i] > 0.25 && dense) for (let k = 0; k < Math.min(3, Math.ceil(w.decay[i] * 2)); k++) {
        const x = cx * CELL + hash(i, k, 61) * CELL, z = cy * CELL + hash(i, k, 67) * CELL, y = this.heightAt(x, z);
        put("cyl", x, y + 0.6, z, 0.25, 0.6, 0.25, 0xefe6d6); put("sph", x, y + 1.3, z, 0.9, 0.45, 0.9, 0xc8452f);
      }
    }
  }

  buildCivilization() {
    const sim = this.sim, col = this._c, m = this._m, q = this._q, p = this._p, s = this._s;
    const put = (geo, x, y, z, sx, sy, sz, hex, ry = 0) => { this._e.set(0, ry, 0); q.setFromEuler(this._e); p.set(x, y, z); s.set(sx, sy, sz); this.compose(m, p, q, s); col.setHex(hex); this.push(geo, m, col); };
    this.windows = [];
    for (const st of sim.settlements) {
      const L = st.level, n = Math.min(40, 3 + L * 6 + Math.floor(Math.sqrt(st.pop) / 2.5)), R = 8 + L * 9 + Math.sqrt(st.pop) * 0.35;
      for (let k = 0; k < n; k++) {
        const a = k * 2.399 + st.id, d = Math.sqrt((k + 0.5) / n) * R, x = st.x + Math.cos(a) * d, z = st.y + Math.sin(a) * d, y = Math.max(0, this.heightAt(x, z));
        const hs = hash(st.id, k, 3), ry = a;
        if (L === 0) { put("cone", x, y + 2.2, z, 2.2, 2.2, 2.2, 0x8a6a45, ry); }
        else if (L <= 2 && hs < 0.8 - L * 0.15) { put("box", x, y + 1.6, z, 2.2, 1.6, 1.8, 0xc9a77a, ry); put("cone", x, y + 4.2, z, 2.6, 1.2, 2.6, 0x8a3b2a, ry + 0.78); }
        else {
          const hgt = 3 + hs * L * 6 * (1 - d / R * 0.6);
          put("box", x, y + hgt, z, 2.2 + L * 0.4, hgt, 2.2 + L * 0.4, sim.era >= 8 ? 0x8ea3bd : 0xa9a49a, ry);
          if (L >= 2) this.windows.push([x, y + hgt * (0.5 + hs * 0.6), z, 2.3 + L * 0.4]);
        }
      }
      if (L === 0) this.windows.push([st.x, Math.max(0, this.heightAt(st.x, st.y)) + 0.8, st.y, 0.9, true]);
      if (st.port) { const x = st.x + R + 6, z = st.y, y = Math.max(0, this.heightAt(x, z)); put("cyl", x, y + 9, z, 1.2, 9, 1.2, 0xdfe6ef); put("cone", x, y + 20, z, 1.2, 2, 1.2, 0xff8a5c); }
    }
    // roads between neighbouring towns
    if (sim.era >= 6) for (const a of sim.settlements) {
      const near = sim.settlements.filter((b) => b.id > a.id).map((b) => [b, Math.hypot(b.x - a.x, b.y - a.y)]).filter(([, d]) => d < 380).sort((u, v) => u[1] - v[1]).slice(0, 2);
      for (const [b, d] of near) {
        const steps = Math.ceil(d / 14);
        for (let k = 0; k <= steps; k++) { const t = k / steps, x = a.x + (b.x - a.x) * t, z = a.y + (b.y - a.y) * t, y = this.heightAt(x, z); if (y < 0) continue; put("box", x, y + 0.3, z, 7.5, 0.3, 1.4, sim.era >= 8 ? 0x5e6670 : 0x9a8058, -Math.atan2(b.y - a.y, b.x - a.x)); }
      }
    }
  }

  // ------------------------------------------------------------ per-frame
  draw(time) {
    const sim = this.sim;
    this.frame++;
    if (this.follow && this.selected && !this.selected.dead) { this.cam.x = this.selected.x; this.cam.y = this.selected.y; }
    this.placeCamera();
    if (this.frame % 30 === 0) this.texture.needsUpdate = true;

    // static-ish layers are rebuilt every so often, then creatures are appended each frame
    const fdx = this.floraAt ? (this.globe ? wrapDX(this.cam.x - this.floraAt.x) : this.cam.x - this.floraAt.x) : 0;
    const moved = !this.floraAt || this.floraAt.g !== this.globe || Math.hypot(fdx, this.cam.y - this.floraAt.y) > (this.globe ? Math.min(160, this.distance * 0.35) : this.distance * 0.35) || Math.abs(this.floraAt.d - this.distance) > this.distance * 0.3;
    if (moved || this.frame % 120 === 0) {
      for (const k in this.inst) this.inst[k].count = 0;
      this.glow.count = 0;
      if (this.effects) this.buildFlora();
      this.buildCivilization();
      this.base = {}; for (const k in this.inst) this.base[k] = this.inst[k].count;
      this.floraAt = { x: this.cam.x, y: this.cam.y, d: this.distance, g: this.globe };
    }
    this.resetInstances();
    this.drawCreatures(time);
    this.drawGlow(time);
    for (const set of [this.inst, this.cinst]) for (const k in set) { const m = set[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.glow.instanceMatrix.needsUpdate = true;

    this.updateSky(time);
    this.updateSelection(time);
    this.renderer.render(this.scene, this.camera);
  }

  drawCreatures(time) {
    const sim = this.sim, w = sim.world, cam = this.camera.position, G = this.globe;
    const near = G ? Math.min(this.distance, 600) * 2.2 : this.distance * 2.2, far2 = (this.distance * 3.2) ** 2;
    const base = this._b, anim = this._anim, wp = this._gp;
    for (const c of sim.creatures) {
      let d2;
      if (G) {
        if (!this.facing(c.x, c.y, 0.03)) continue;
        this.globeN(c.x, c.y, wp).multiplyScalar(PLANET_R); d2 = wp.distanceToSquared(cam);
      } else { const dx = c.x - cam.x, dz = c.y - cam.z; d2 = dx * dx + dz * dz; if (d2 > far2) continue; }
      const sp = sim.species.get(c.sp);
      if (!sp) continue;
      const arch = sp.arch || archetypeOf(c.g, sp.sapient, sp.proto);
      const r = c.r * 1.25, place = PLACEMENT[arch] || "ground";
      const ground = this.heightAt(c.x, c.y);
      let y;
      if (place === "sea") y = Math.max(ground + r, Math.min(-r * 0.9 - 1, -2 - (c.id % 5)));
      else if (place === "floor") y = Math.min(ground, -0.5);
      else if (place === "surface") y = -r * 0.45;
      else if (place === "air") y = Math.max(ground, 0) + (16 + r * 3 + Math.sin(time / 600 + c.id) * 3) * (G ? 0.45 : 1);
      else y = Math.max(ground, place === "ground" && ground < 0 ? -r * 0.4 : ground);
      const ph = time / (100 + c.r * 9) + c.id * 1.7; // big animals stride more slowly
      if (BOB.has(arch) && c.mode !== 1) y += Math.abs(Math.cos(ph)) * r * 0.045;
      this._e.set(0, -c.a, 0); this._q.setFromEuler(this._e);
      this._p.set(c.x, y, c.y); this._s.set(r, r, r);
      this.compose(base, this._p, this._q, this._s);
      const C = this.colorsFor(sp, arch);
      if (arch === "human") { C.c = C.c || new THREE.Color(); C.s = C.s || new THREE.Color(); C.h = C.h || new THREE.Color(); }
      const dist = Math.sqrt(d2);
      if (dist > near || !this.effects) { const part = farPart(arch); this.pushC(part.g, this.partMatrix(base, part, null), C.b); continue; }
      if (arch === "human") {
        C.c.setHSL(((c.id * 47) % 360) / 360, sim.era >= 6 ? 0.45 : 0.25, sim.era >= 6 ? 0.48 : 0.38);
        C.s.setHex([0xe2b48f, 0xc99a74, 0xa8764f, 0x7c5638][c.id % 4]); C.h.setHex([0x2b1d14, 0x4a3020, 0x151515, 0x7a5530][(c.id >> 2) % 4]);
      }
      const parts = MODELS[arch] || MODELS.fish, detail = dist < near * 0.5, pat = sp.pattern || 0;
      for (const part of parts) {
        if (part.pat && part.pat !== pat) continue;
        if (!detail && (part.c === "e" || (part.sx < 0.1 && part.sz < 0.1) || part.pat)) continue;
        const col = typeof part.c === "number" ? this._c.setHex(part.c) : C[part.c] || C.b;
        let a = null;
        if (part.anim) {
          a = animate(part.anim, ph, anim);
          if (part.knee) { // lower leg hangs from the swinging upper leg and flexes at the knee
            const t = a.z; a.px += part.knee * Math.sin(t); a.py += part.knee * (1 - Math.cos(t)); a.z = t - a.bend;
          }
        }
        this.pushC(part.g, this.partMatrix(base, part, a), col);
      }
    }
  }

  drawGlow(time) {
    const night = this.night(), m = this._m, G = this.globe;
    if ((!G && night < 0.15) || !this.windows) return;
    for (const [x, y, z, s, fire] of this.windows) {
      if (G && this.globeN(x, z, this._n).dot(this.sunDir) > 0.06) continue; // only the night side of the planet lights up
      const f = fire ? 1 + Math.sin(time / 90 + x) * 0.25 : 1;
      this._q.identity(); this._p.set(x, y, z); this._s.set(fire ? s * f : s * 1.02, fire ? s * f : 0.6, fire ? s * f : s * 1.02);
      this.compose(m, this._p, this._q, this._s);
      if (this.glow.count < 4000) this.glow.setMatrixAt(this.glow.count++, m);
    }
    for (const e of this.sim.effects) if (e.kind === "rocket") {
      const t = 1 - e.life / e.max; this._q.identity(); this._p.set(e.x + t * 40, Math.max(0, this.heightAt(e.x, e.y)) + 20 * this.vs + t * t * 500, e.y); this._s.set(1.5, 4, 1.5);
      this.compose(m, this._p, this._q, this._s); if (this.glow.count < 4000) this.glow.setMatrixAt(this.glow.count++, m);
    }
  }

  /** Planet mode: the sun circles the planet with the shared clock, so a day/night line sweeps across it. */
  updateSpace(time) {
    const p = (this.sim.tick % DAY_TICKS) / DAY_TICKS;
    const lon = Math.PI - (p - 0.25) * TAU; // the clock is local time at the map's centre meridian
    this.sunDir.set(Math.sin(lon) * Math.cos(0.32), Math.sin(0.32), Math.cos(lon) * Math.cos(0.32)).normalize();
    this.scene.background = this._spaceBg || (this._spaceBg = new THREE.Color(0x04060e));
    this.scene.fog.near = 1e5; this.scene.fog.far = 2e5;
    this.sun.position.copy(this.sunDir).multiplyScalar(3000); this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = 1.05; this.sun.color.setHex(0xfff1dc);
    this.hemi.intensity = this.weather ? 0.24 : 0.7;
    this.sunBall.position.copy(this.sunDir).multiplyScalar(4300); this.sunHalo.position.copy(this.sunBall.position);
    const ma = time / 26000;
    this.moon.position.set(Math.cos(ma) * 1150, Math.sin(ma) * 260, Math.sin(ma) * 1150); this.moon.rotation.y = ma * 3;
    const pol = this.sim.climate.pollution;
    this.atmoOuter.material.uniforms.col.value.setRGB(0.42 + pol * 0.5, 0.78 - pol * 0.25, 1 - pol * 0.6);
    this.atmoInner.material.uniforms.col.value.copy(this.atmoOuter.material.uniforms.col.value);
    this.ocean.material.color.setHex(this.sim.era <= 1 ? 0x2a7fa6 : 0x2a86c8);
    this.glow.material.color.setHex(0xffd27a);

    // clouds drift round the planet and fade away as you descend through them
    const cm = this.cloudMesh, m = this._m;
    cm.count = 0;
    const d = this.distance;
    if (this.weather && this.map2d.cloudDensity && d > 140) {
      const off = this.map2d.cloudOffset(), step = 5;
      for (let gy = 2; gy < 135; gy += step) for (let gx = 0; gx < 240; gx += step) {
        const dens = this.map2d.cloudDensity[gy * 240 + gx];
        if (dens < 0.5) continue;
        const x = ((gx / 240) * WORLD_W + off) % WORLD_W, z = (gy / 135) * WORLD_H;
        if (!this.facing(x, z, 0.08)) continue;
        // each cloud is a little cluster of soft puffs
        const sz = (5 + dens * 7) * (0.8 + hash(gx, gy, 5) * 0.5), a = hash(gx, gy, 7) * TAU;
        this._q.identity();
        for (let k = 0; k < 3; k++) {
          const o = (k - 1) * sz * 0.9, r = sz * (k === 1 ? 1 : 0.72);
          this._p.set(x + Math.cos(a) * o, 17 + hash(gx, gy, 3) * 4 + (k === 1 ? 1 : 0), z + Math.sin(a) * o); this._s.set(r, r * 0.5, r);
          this.compose(m, this._p, this._q, this._s); if (cm.count < 3200) cm.setMatrixAt(cm.count++, m);
        }
      }
      cm.material.opacity = clamp((d - 140) / 380, 0, 0.92);
      cm.instanceMatrix.needsUpdate = true;
    }
    this.updatePrecip(time);
  }

  updateSky(time) {
    if (this.globe) return this.updateSpace(time);
    const night = this.weather ? this.night() : 0, p = (this.sim.tick % DAY_TICKS) / DAY_TICKS;
    const day = new THREE.Color(0x8fc4e8), dusk = new THREE.Color(0xf0a070), nightC = new THREE.Color(0x0a1530);
    const duskAmt = this.weather ? clamp(1 - Math.min(Math.abs(p - 0.5), Math.abs(p), Math.abs(p - 1)) * 7, 0, 1) * (1 - night * 0.6) : 0;
    const sky = day.clone().lerp(dusk, duskAmt * 0.6).lerp(nightC, night);
    this.scene.background = sky; this.scene.fog.color.copy(sky);
    const ang = p * TAU;
    this.sun.position.set(WORLD_W / 2 + Math.cos(ang) * 1500, Math.max(150, Math.sin(ang) * 1400), WORLD_H / 2 - 600);
    this.sun.target.position.set(WORLD_W / 2, 0, WORLD_H / 2);
    this.sun.intensity = 0.95 * (1 - night * 0.8); this.sun.color.setHex(duskAmt > 0.3 ? 0xffc89a : 0xfff1d6);
    this.hemi.intensity = 0.75 * (1 - night * 0.6) + 0.1;
    this.glow.material.color.setHex(0xffd27a);
    // pollution haze
    const pol = this.sim.climate.pollution;
    this.scene.fog.near = 1500 - pol * 3000; this.scene.fog.far = 5200 - pol * 8000;

    // low-poly clouds from the shared cloud map, and rain/snow under them
    const cm = this.cloudMesh;
    cm.count = 0;
    const camH = this.camera.position.y, CLOUD_Y = 420;
    if (this.weather && this.map2d.cloudDensity && camH > CLOUD_Y + 250) {
      const off = this.map2d.cloudOffset(), m = this._m;
      for (let gy = 2; gy < 135; gy += 7) for (let gx = 0; gx < 240; gx += 7) {
        const dens = this.map2d.cloudDensity[gy * 240 + gx];
        if (dens < 0.45) continue;
        const x = ((gx / 240) * WORLD_W + off) % WORLD_W, z = (gy / 135) * WORLD_H;
        const sz = 14 + dens * 26;
        this._q.identity(); this._p.set(x, CLOUD_Y + hash(gx, gy, 3) * 40, z); this._s.set(sz * 1.6, sz * 0.4, sz);
        m.compose(this._p, this._q, this._s); if (cm.count < 3200) cm.setMatrixAt(cm.count++, m);
      }
      cm.material.opacity = clamp((camH - CLOUD_Y - 250) / 600, 0, 0.7) * (1 - night * 0.6);
      cm.instanceMatrix.needsUpdate = true;
    }
    this.updatePrecip(time);
  }

  updatePrecip(time) {
    const pos = this.rainPos, w = this.sim.world, R = Math.min(this.globe ? 260 : 700, this.distance * 0.9), G = this.globe, v = this._gp;
    let any = false;
    if (G && this.distance > 700) { this.rain.visible = false; return; }
    this.rain.material.size = G ? 0.45 : 2.2;
    for (let k = 0; k < this.rainSeed.length; k++) {
      const s = this.rainSeed[k];
      const x = this.cam.x + (s[0] - 0.5) * 2 * R, z = this.cam.y + (s[1] - 0.5) * 2 * R;
      const dens = this.weather ? this.map2d.cloudAt(x, z) : 0;
      if (dens < 0.55) { pos[k * 3 + 1] = -9999; continue; }
      any = true;
      const snow = w.temp[w.idx(x, z)] < 0.2, fall = snow ? 0.02 : 0.35;
      s[2] = (s[2] - fall * 0.016 * 6) % 1; if (s[2] < 0) s[2] += 1;
      this.point(x + (snow ? Math.sin(time / 600 + k) * 4 : 0), Math.max(0, this.heightAt(x, z)) + s[2] * (G ? 30 : 220), z, v);
      pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
    }
    this.rain.visible = any;
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  updateSelection(time) {
    const c = this.selected;
    if (!c || c.dead) { this.ring.visible = false; return; }
    const r = c.r * 1.25 * 2.4;
    this.ring.visible = true;
    this._e.set(-Math.PI / 2, 0, time / 900); this._q.setFromEuler(this._e);
    this._p.set(c.x, Math.max(0, this.heightAt(c.x, c.y)) + 0.6, c.y); this._s.set(r, r, r);
    this.compose(this.ring.matrix, this._p, this._q, this._s);
  }

  drawMinimap(canvas) {
    const m = this.map2d, v = this.view(), orig = m.view;
    m.view = () => ({ x0: v.x0 - 10, x1: v.x1 + 10, y0: v.y0 - 10, y1: v.y1 + 10 });
    try { m.drawMinimap(canvas); } finally { m.view = orig; }
  }
}
