"use client";

import { useEffect, useRef } from "react";

// Tunable simulation settings — similar idea to the reference config
const CONFIG = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 720,
  DENSITY_DISSIPATION: 3.5,
  VELOCITY_DISSIPATION: 2,
  PRESSURE: 0.1,
  PRESSURE_ITERATIONS: 20,
  CURL: 10,
  SPLAT_RADIUS: 0.4,
  SPLAT_FORCE: 6000,
  COLOR_UPDATE_SPEED: 6,
};

const BASE_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const CLEAR_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
out vec4 fragColor;
void main () {
  fragColor = value * texture(uTexture, vUv);
}`;

const SPLAT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
out vec4 fragColor;
void main () {
  vec2 p = vUv - point.xy;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  vec3 base = texture(uTarget, vUv).xyz;
  fragColor = vec4(base + splat, 1.0);
}`;

const ADVECTION_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
out vec4 fragColor;
void main () {
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
  vec4 result = texture(uSource, coord);
  float decay = 1.0 + dissipation * dt;
  fragColor = result / decay;
}`;

const DIVERGENCE_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  float div = 0.5 * (R - L + T - B);
  fragColor = vec4(div, 0.0, 0.0, 1.0);
}`;

const CURL_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  float vorticity = R - L - T + B;
  fragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
}`;

const VORTICITY_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curlStrength;
uniform float dt;
out vec4 fragColor;
void main () {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curlStrength * C;
  force.y *= -1.0;
  vec2 vel = texture(uVelocity, vUv).xy;
  vel += force * dt;
  vel = clamp(vel, -1000.0, 1000.0);
  fragColor = vec4(vel, 0.0, 1.0);
}`;

const PRESSURE_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
out vec4 fragColor;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  float pressure = (L + R + B + T - divergence) * 0.25;
  fragColor = vec4(pressure, 0.0, 0.0, 1.0);
}`;

const GRADIENT_SUBTRACT_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= vec2(R - L, T - B);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

const DISPLAY_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uTexture;
out vec4 fragColor;
void main () {
  vec3 c = texture(uTexture, vUv).rgb;
  float lc = length(texture(uTexture, vL).rgb);
  float rc = length(texture(uTexture, vR).rgb);
  float tc = length(texture(uTexture, vT).rgb);
  float bc = length(texture(uTexture, vB).rgb);
  float dx = rc - lc;
  float dy = tc - bc;
  vec3 n = normalize(vec3(dx, dy, 0.25));
  float diffuse = clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.6, 0.4, 1.0);
  c *= diffuse;
  fragColor = vec4(c, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertexSrc: string, fragmentSrc: string) {
  const program = gl.createProgram()!;
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
  }

  const uniforms: Record<string, WebGLUniformLocation> = {};
  const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < uniformCount; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name)!;
  }

  return { program, uniforms };
}

export default function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      console.warn("WebGL2 not supported — fluid background disabled.");
      return;
    }

    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");

    // Fullscreen triangle setup
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, -1, 3, 3, -1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const blit = () => {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const clearProgram = createProgram(gl, BASE_VERTEX_SHADER, CLEAR_SHADER);
    const splatProgram = createProgram(gl, BASE_VERTEX_SHADER, SPLAT_SHADER);
    const advectionProgram = createProgram(gl, BASE_VERTEX_SHADER, ADVECTION_SHADER);
    const divergenceProgram = createProgram(gl, BASE_VERTEX_SHADER, DIVERGENCE_SHADER);
    const curlProgram = createProgram(gl, BASE_VERTEX_SHADER, CURL_SHADER);
    const vorticityProgram = createProgram(gl, BASE_VERTEX_SHADER, VORTICITY_SHADER);
    const pressureProgram = createProgram(gl, BASE_VERTEX_SHADER, PRESSURE_SHADER);
    const gradientSubtractProgram = createProgram(gl, BASE_VERTEX_SHADER, GRADIENT_SUBTRACT_SHADER);
    const displayProgram = createProgram(gl, BASE_VERTEX_SHADER, DISPLAY_SHADER);

    type FBO = {
      texture: WebGLTexture;
      fbo: WebGLFramebuffer;
      width: number;
      height: number;
      texelSizeX: number;
      texelSizeY: number;
    };

    function createFBO(w: number, h: number): FBO {
      gl!.activeTexture(gl!.TEXTURE0);
      const texture = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA16F, w, h, 0, gl!.RGBA, gl!.HALF_FLOAT, null);

      const fbo = gl!.createFramebuffer()!;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0);
      gl!.viewport(0, 0, w, h);
      gl!.clear(gl!.COLOR_BUFFER_BIT);

      return { texture, fbo, width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h };
    }

    function createDoubleFBO(w: number, h: number) {
      let fbo1 = createFBO(w, h);
      let fbo2 = createFBO(w, h);
      return {
        get read() {
          return fbo1;
        },
        get write() {
          return fbo2;
        },
        swap() {
          const temp = fbo1;
          fbo1 = fbo2;
          fbo2 = temp;
        },
      };
    }

    let simWidth = CONFIG.SIM_RESOLUTION;
    let simHeight = CONFIG.SIM_RESOLUTION;
    let dyeWidth = CONFIG.DYE_RESOLUTION;
    let dyeHeight = Math.round(
      (CONFIG.DYE_RESOLUTION * canvas.clientHeight) / canvas.clientWidth
    );

    let dye = createDoubleFBO(dyeWidth, dyeHeight);
    let velocity = createDoubleFBO(simWidth, simHeight);
    let divergence = createFBO(simWidth, simHeight);
    let curlFBO = createFBO(simWidth, simHeight);
    let pressure = createDoubleFBO(simWidth, simHeight);

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Brand-restricted hue cycling (violet -> indigo -> pink range only)
    function hsvToRgb(h: number, s: number, v: number) {
      let r = 0,
        g = 0,
        b = 0;
      const i = Math.floor(h * 6);
      const f = h * 6 - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0:
          r = v; g = t; b = p; break;
        case 1:
          r = q; g = v; b = p; break;
        case 2:
          r = p; g = v; b = t; break;
        case 3:
          r = p; g = q; b = v; break;
        case 4:
          r = t; g = p; b = v; break;
        case 5:
          r = v; g = p; b = q; break;
      }
      return { r, g, b };
    }

    function nextColor() {
      const hue = 0.68 + Math.random() * 0.15; // violet -> indigo -> pink band
      const c = hsvToRgb(hue, 0.65, 1.0);
      return { r: c.r * 0.6, g: c.g * 0.6, b: c.b * 0.6 };
    }

    const pointer = {
      x: 0.5,
      y: 0.5,
      dx: 0,
      dy: 0,
      moved: false,
    };

    // FIX: normalize cursor position against the canvas's own bounding box,
    // instead of window.innerWidth/innerHeight — this keeps the splat
    // exactly under the real cursor regardless of scrollbars/layout quirks.
    function handlePointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1 - (e.clientY - rect.top) / rect.height;
      pointer.dx = (nx - pointer.x) * CONFIG.SPLAT_FORCE;
      pointer.dy = (ny - pointer.y) * CONFIG.SPLAT_FORCE;
      pointer.x = nx;
      pointer.y = ny;
      pointer.moved = Math.abs(pointer.dx) > 0 || Math.abs(pointer.dy) > 0;
    }

    window.addEventListener("pointermove", handlePointerMove);

    function splat(x: number, y: number, dx: number, dy: number, color: { r: number; g: number; b: number }) {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, velocity.write.fbo);
      gl!.viewport(0, 0, simWidth, simHeight);
      gl!.useProgram(splatProgram.program);
      gl!.uniform1i(splatProgram.uniforms.uTarget, 0);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, velocity.read.texture);
      gl!.uniform1f(splatProgram.uniforms.aspectRatio, canvas!.width / canvas!.height);
      gl!.uniform2f(splatProgram.uniforms.point, x, y);
      gl!.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
      gl!.uniform1f(splatProgram.uniforms.radius, CONFIG.SPLAT_RADIUS / 100);
      blit();
      velocity.swap();

      gl!.bindFramebuffer(gl!.FRAMEBUFFER, dye.write.fbo);
      gl!.viewport(0, 0, dyeWidth, dyeHeight);
      gl!.uniform1i(splatProgram.uniforms.uTarget, 0);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, dye.read.texture);
      gl!.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
      blit();
      dye.swap();
    }

    let lastTime = performance.now();
    let rafId: number;

    function step(dt: number) {
      gl!.disable(gl!.BLEND);

      // Curl
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, curlFBO.fbo);
      gl!.viewport(0, 0, simWidth, simHeight);
      gl!.useProgram(curlProgram.program);
      gl!.uniform2f(curlProgram.uniforms.texelSize, velocity.read.texelSizeX, velocity.read.texelSizeY);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, velocity.read.texture);
      gl!.uniform1i(curlProgram.uniforms.uVelocity, 0);
      blit();

      // Vorticity confinement
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, velocity.write.fbo);
      gl!.useProgram(vorticityProgram.program);
      gl!.uniform2f(vorticityProgram.uniforms.texelSize, velocity.read.texelSizeX, velocity.read.texelSizeY);
      gl!.uniform1i(vorticityProgram.uniforms.uVelocity, 0);
      gl!.activeTexture(gl!.TEXTURE1);
      gl!.bindTexture(gl!.TEXTURE_2D, curlFBO.texture);
      gl!.uniform1i(vorticityProgram.uniforms.uCurl, 1);
      gl!.uniform1f(vorticityProgram.uniforms.curlStrength, CONFIG.CURL);
      gl!.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit();
      velocity.swap();

      // Divergence
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, divergence.fbo);
      gl!.useProgram(divergenceProgram.program);
      gl!.uniform2f(divergenceProgram.uniforms.texelSize, velocity.read.texelSizeX, velocity.read.texelSizeY);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, velocity.read.texture);
      gl!.uniform1i(divergenceProgram.uniforms.uVelocity, 0);
      blit();

      // Clear pressure
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, pressure.write.fbo);
      gl!.useProgram(clearProgram.program);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, pressure.read.texture);
      gl!.uniform1i(clearProgram.uniforms.uTexture, 0);
      gl!.uniform1f(clearProgram.uniforms.value, CONFIG.PRESSURE);
      blit();
      pressure.swap();

      // Pressure solve
      gl!.useProgram(pressureProgram.program);
      gl!.uniform2f(pressureProgram.uniforms.texelSize, velocity.read.texelSizeX, velocity.read.texelSizeY);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, divergence.texture);
      gl!.uniform1i(pressureProgram.uniforms.uDivergence, 0);
      for (let i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, pressure.write.fbo);
        gl!.activeTexture(gl!.TEXTURE1);
        gl!.bindTexture(gl!.TEXTURE_2D, pressure.read.texture);
        gl!.uniform1i(pressureProgram.uniforms.uPressure, 1);
        blit();
        pressure.swap();
      }

      // Gradient subtract
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, velocity.write.fbo);
      gl!.useProgram(gradientSubtractProgram.program);
      gl!.uniform2f(gradientSubtractProgram.uniforms.texelSize, velocity.read.texelSizeX, velocity.read.texelSizeY);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, pressure.read.texture);
      gl!.uniform1i(gradientSubtractProgram.uniforms.uPressure, 0);
      gl!.activeTexture(gl!.TEXTURE1);
      gl!.bindTexture(gl!.TEXTURE_2D, velocity.read.texture);
      gl!.uniform1i(gradientSubtractProgram.uniforms.uVelocity, 1);
      blit();
      velocity.swap();

      // Advect velocity
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, velocity.write.fbo);
      gl!.useProgram(advectionProgram.program);
      gl!.uniform2f(advectionProgram.uniforms.texelSize, velocity.read.texelSizeX, velocity.read.texelSizeY);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, velocity.read.texture);
      gl!.uniform1i(advectionProgram.uniforms.uVelocity, 0);
      gl!.uniform1i(advectionProgram.uniforms.uSource, 0);
      gl!.uniform1f(advectionProgram.uniforms.dt, dt);
      gl!.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.VELOCITY_DISSIPATION);
      blit();
      velocity.swap();

      // Advect dye
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, dye.write.fbo);
      gl!.viewport(0, 0, dyeWidth, dyeHeight);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, velocity.read.texture);
      gl!.uniform1i(advectionProgram.uniforms.uVelocity, 0);
      gl!.activeTexture(gl!.TEXTURE1);
      gl!.bindTexture(gl!.TEXTURE_2D, dye.read.texture);
      gl!.uniform1i(advectionProgram.uniforms.uSource, 1);
      gl!.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.DENSITY_DISSIPATION);
      blit();
      dye.swap();
      gl!.viewport(0, 0, simWidth, simHeight);
    }

    let colorTimer = 0;
    let currentColor = nextColor();

    function render() {
      const now = performance.now();
      let dt = (now - lastTime) / 1000;
      dt = Math.min(dt, 1 / 30);
      lastTime = now;

      colorTimer += dt;
      if (colorTimer > 1 / CONFIG.COLOR_UPDATE_SPEED) {
        colorTimer = 0;
        currentColor = nextColor();
      }

      if (pointer.moved) {
        splat(pointer.x, pointer.y, pointer.dx, pointer.dy, currentColor);
        pointer.moved = false;
      }

      step(dt);

      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.useProgram(displayProgram.program);
      gl!.uniform2f(displayProgram.uniforms.texelSize, dye.read.texelSizeX, dye.read.texelSizeY);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, dye.read.texture);
      gl!.uniform1i(displayProgram.uniforms.uTexture, 0);
      blit();

      rafId = requestAnimationFrame(render);
    }

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ backgroundColor: "#0a0a0d" }}
    />
  );
}