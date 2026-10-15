import * as THREE from "three"

/**
 * The particle shader.
 *
 * Every particle carries two targets (aPosA → aPosB) and two colours. The
 * morph is staggered per particle (delay = aRandom·0.4) so shapes dissolve
 * and re-form organically rather than sliding as one block. On top:
 * divergence-free trig "curl" drift (stronger mid-flight), pointer
 * repulsion, plant sway, rising embers, and size attenuation.
 */

const vertex = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform float uSize;
uniform float uPixelRatio;
uniform float uDrift;
uniform float uFlight;
uniform vec3 uMouse;
uniform float uMouseRadius;
uniform float uMouseForce;
uniform vec3 uCenterA;
uniform vec3 uCenterB;
uniform float uSpinA;
uniform float uSpinB;
uniform vec4 uMetaA; // size, glyph, ember, sway
uniform vec4 uMetaB;
uniform float uGainA;
uniform float uGainB;
uniform float uFog;

attribute vec3 aPosA;
attribute vec3 aPosB;
attribute vec3 aColA;
attribute vec3 aColB;
attribute float aRandom;

varying vec3 vColor;
varying float vGlyph;
varying float vRand;
varying float vFade;

vec3 rotY(vec3 p, vec3 c, float a) {
  p -= c;
  float s = sin(a), co = cos(a);
  p = vec3(co * p.x + s * p.z, p.y, -s * p.x + co * p.z);
  return p + c;
}

// Cheap divergence-free drift field (sum of rotated sine waves).
vec3 drift(vec3 p, float t) {
  return vec3(
    sin(p.y * 1.31 + t * 0.71) + cos(p.z * 1.73 - t * 0.37),
    sin(p.z * 1.13 + t * 0.53) + cos(p.x * 1.51 + t * 0.61),
    sin(p.x * 1.21 - t * 0.47) + cos(p.y * 1.93 + t * 0.29)
  ) * 0.5;
}

void main() {
  float delay = aRandom * 0.4;
  float k = smoothstep(delay, delay + 0.6, uMorph);

  vec3 a = rotY(aPosA, uCenterA, uSpinA);
  vec3 b = rotY(aPosB, uCenterB, uSpinB);

  vec4 meta = mix(uMetaA, uMetaB, k);

  // Plants sway in the current; embers rise from the finale lattice.
  float sway = meta.w;
  if (sway > 0.001) {
    vec3 ctr = mix(uCenterA, uCenterB, k);
    float h = max(0.0, (mix(a, b, k).y - ctr.y));
    vec3 s = vec3(sin(uTime * 0.9 + aPosA.x * 0.6 + aPosA.z * 0.4), 0.0, cos(uTime * 0.7 + aPosA.z * 0.5)) * 0.06 * h;
    a += s * uMetaA.w;
    b += s * uMetaB.w;
  }
  vec3 p = mix(a, b, k);

  float ember = meta.z * step(0.86, aRandom);
  if (ember > 0.0) {
    float life = fract(uTime * (0.05 + aRandom * 0.04) + aRandom * 7.0);
    p.y += life * 4.0 * ember;
    p.x += sin(life * 6.0 + aRandom * 20.0) * 0.25 * ember;
  }

  // Drift: always a little (the world never freezes), more in flight.
  float flight = sin(3.14159 * k);
  p += drift(p * 0.55 + aRandom * 3.0, uTime * 0.6) * (uDrift + flight * uFlight) * (0.6 + aRandom * 0.8);

  // Pointer repulsion.
  vec3 d = p - uMouse;
  float dist = length(d);
  p += (d / max(dist, 1e-3)) * uMouseForce * (1.0 - smoothstep(0.0, uMouseRadius, dist));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float size = uSize * meta.x * (0.55 + aRandom * 0.9);
  gl_PointSize = size * uPixelRatio * (8.0 / max(0.5, -mv.z));

  vColor = mix(aColA * uGainA, aColB * uGainB, k);
  vGlyph = meta.y;
  vRand = aRandom;
  // Fade points very close to the lens instead of letting them blow up.
  float fz = -mv.z;
  vFade = smoothstep(0.35, 1.6, fz) * exp(-uFog * uFog * fz * fz);
}
`

const fragment = /* glsl */ `
uniform sampler2D uGlyphs;
uniform float uTime;
uniform float uAlpha;
varying vec3 vColor;
varying float vGlyph;
varying float vRand;
varying float vFade;

void main() {
  vec2 uv = gl_PointCoord;
  float d = length(uv - 0.5);
  float dot_ = smoothstep(0.5, 0.0, d);
  dot_ *= dot_;
  float a = dot_;
  if (vGlyph > 0.01) {
    // 4×4 glyph atlas: 0-9 A-F · + #
    float idx = floor(fract(vRand * 13.0 + floor(uTime * (1.5 + vRand * 3.0)) * 0.618) * 16.0);
    vec2 cell = vec2(mod(idx, 4.0), floor(idx / 4.0));
    vec2 guv = (cell + vec2(uv.x, 1.0 - uv.y)) / 4.0;
    float g = texture2D(uGlyphs, guv).r;
    a = mix(dot_, g, vGlyph);
  }
  a *= vFade * uAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`

/** Glyph atlas: 4×4 cells, white on black. */
export function makeGlyphTexture(): THREE.Texture {
  const size = 256
  const cell = size / 4
  const c = document.createElement("canvas")
  c.width = c.height = size
  const g = c.getContext("2d")!
  g.fillStyle = "#000"
  g.fillRect(0, 0, size, size)
  g.fillStyle = "#fff"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.font = `600 ${cell * 0.72}px "JetBrains Mono", ui-monospace, monospace`
  const chars = "0123456789ABCDEF".split("")
  chars[13] = "·"
  chars[14] = "+"
  chars[15] = "#"
  chars.forEach((ch, i) => g.fillText(ch, (i % 4) * cell + cell / 2, Math.floor(i / 4) * cell + cell / 2 + cell * 0.04))
  const t = new THREE.CanvasTexture(c)
  t.flipY = false
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  return t
}

export function createParticleMaterial(pixelRatio: number) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uSize: { value: 2.9 },
      uPixelRatio: { value: pixelRatio },
      uDrift: { value: 0.012 },
      uFlight: { value: 0.35 },
      uMouse: { value: new THREE.Vector3(1e5, 1e5, 1e5) },
      uMouseRadius: { value: 0.6 },
      uMouseForce: { value: 0.0 },
      uCenterA: { value: new THREE.Vector3() },
      uCenterB: { value: new THREE.Vector3() },
      uSpinA: { value: 0 },
      uSpinB: { value: 0 },
      uMetaA: { value: new THREE.Vector4(1, 0, 0, 0) },
      uMetaB: { value: new THREE.Vector4(1, 0, 0, 0) },
      uGainA: { value: 1 },
      uGainB: { value: 1 },
      uGlyphs: { value: null as THREE.Texture | null },
      uAlpha: { value: 1 },
      uFog: { value: 0.028 },
    },
  })
}
