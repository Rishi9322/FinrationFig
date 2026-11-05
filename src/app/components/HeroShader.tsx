import { useEffect, useRef, type RefObject } from "react"

/* ---------------------------------------------------------------------------------------------
   HeroShader: a quiet WebGL background for the hero.

   A fine grid in the brand colours that bends toward the pointer, with small blue pulses travelling
   along its rows like a figure moving through a ledger. One full-screen triangle and one fragment
   shader, written against raw WebGL, so it adds no dependency.

   Guardrails (all deliberate):
   - starts after the headline has painted (idle callback), then fades in
   - the pixel ratio is capped (1 on phones, 1.5 elsewhere) and the context asks for low power
   - pauses when the hero is off screen or the tab is hidden
   - prefers-reduced-motion: one still frame, no loop, no pointer response
   - no WebGL, or a lost context: renders nothing and the CSS glow behind it carries on
   --------------------------------------------------------------------------------------------- */

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform vec3 uLine;
uniform float uLineA;
uniform vec3 uGlow;

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 m = (uMouse * uRes - 0.5 * uRes) / uRes.y;
  vec2 d = p - m;
  p -= d * exp(-dot(d, d) * 7.0) * 0.10;                 // the grid bends toward the pointer

  vec2 g = p * 13.0 + vec2(0.0, uTime * 0.12);           // and drifts slowly upward
  vec2 fr = fract(g);
  vec2 e = min(fr, 1.0 - fr);
  float lx = 1.0 - smoothstep(0.0, 0.025, e.x);
  float ly = 1.0 - smoothstep(0.0, 0.025, e.y);
  float grid = max(lx, ly);

  float centre = length(vec2(p.x * 0.55, p.y * 0.8));
  float mask = smoothstep(0.18, 0.85, centre) * (1.0 - smoothstep(1.5, 2.2, centre));   // quiet behind the copy, present at the sides

  float row = floor(g.y);
  float pulse = smoothstep(0.92, 1.0, sin(g.x * 0.35 - uTime * 0.7 + row * 2.1)) * ly;

  float a = grid * uLineA * mask;
  float b = pulse * 0.55 * mask;
  gl_FragColor = vec4(uLine * a + uGlow * b, clamp(a + b, 0.0, 1.0));            // premultiplied
}`

type Palette = { line: [number, number, number]; lineA: number; glow: [number, number, number] }
const DARK: Palette = { line: [0.58, 0.64, 0.74], lineA: 0.15, glow: [0.38, 0.65, 0.98] }
const LIGHT: Palette = { line: [0.06, 0.09, 0.16], lineA: 0.09, glow: [0.15, 0.39, 0.92] }

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export function HeroShader({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = targetRef.current
    if (!canvas || !host) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let cleanup = () => {}
    let started = false

    const init = () => {
      if (started) return
      started = true
      const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" })
      if (!gl) return

      const vs = compile(gl, gl.VERTEX_SHADER, VERT)
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
      const prog = gl.createProgram()
      if (!vs || !fs || !prog) return
      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
      gl.useProgram(prog)

      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)   // one oversized triangle
      const aPos = gl.getAttribLocation(prog, "aPos")
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
      gl.clearColor(0, 0, 0, 0)

      const U = {
        res: gl.getUniformLocation(prog, "uRes"),
        time: gl.getUniformLocation(prog, "uTime"),
        mouse: gl.getUniformLocation(prog, "uMouse"),
        line: gl.getUniformLocation(prog, "uLine"),
        lineA: gl.getUniformLocation(prog, "uLineA"),
        glow: gl.getUniformLocation(prog, "uGlow"),
      }

      const mouse = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45 }
      let raf = 0
      let running = false
      let onScreen = true
      const t0 = performance.now()

      const setPalette = () => {
        const p = document.documentElement.classList.contains("dark") ? DARK : LIGHT
        gl.uniform3f(U.line, ...p.line)
        gl.uniform1f(U.lineA, p.lineA)
        gl.uniform3f(U.glow, ...p.glow)
      }
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1 : 1.5)
        canvas.width = Math.max(1, Math.round(host.clientWidth * dpr))
        canvas.height = Math.max(1, Math.round(host.clientHeight * dpr))
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.uniform2f(U.res, canvas.width, canvas.height)
      }
      const draw = (now: number) => {
        gl.uniform1f(U.time, reduce ? 0 : (now - t0) / 1000)
        gl.uniform2f(U.mouse, mouse.x, mouse.y)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      const loop = (now: number) => {
        if (!running) return
        mouse.x += (mouse.tx - mouse.x) * 0.06
        mouse.y += (mouse.ty - mouse.y) * 0.06
        draw(now)
        raf = requestAnimationFrame(loop)
      }
      const start = () => {
        if (running || reduce || !onScreen || document.hidden) return
        running = true
        raf = requestAnimationFrame(loop)
      }
      const stop = () => {
        running = false
        cancelAnimationFrame(raf)
      }

      setPalette()
      resize()
      draw(performance.now())
      canvas.style.opacity = "1"                                   // fade in once there is a first frame
      start()

      const onMove = (e: PointerEvent) => {
        const r = host.getBoundingClientRect()
        mouse.tx = (e.clientX - r.left) / r.width
        mouse.ty = 1 - (e.clientY - r.top) / r.height
      }
      const onResize = () => { resize(); if (!running) draw(performance.now()) }
      const onVisibility = () => (document.hidden ? stop() : start())
      const onLost = (e: Event) => { e.preventDefault(); stop() }

      const io = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting
        if (onScreen) start()
        else stop()
      })
      io.observe(host)
      const mo = new MutationObserver(() => { setPalette(); if (!running) draw(performance.now()) })
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

      if (!reduce) host.addEventListener("pointermove", onMove, { passive: true })
      window.addEventListener("resize", onResize)
      document.addEventListener("visibilitychange", onVisibility)
      canvas.addEventListener("webglcontextlost", onLost)

      cleanup = () => {
        stop()
        io.disconnect()
        mo.disconnect()
        host.removeEventListener("pointermove", onMove)
        window.removeEventListener("resize", onResize)
        document.removeEventListener("visibilitychange", onVisibility)
        canvas.removeEventListener("webglcontextlost", onLost)
        gl.getExtension("WEBGL_lose_context")?.loseContext()
      }
    }

    // Let the headline and buttons paint first.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const handle = idle ? idle(init, { timeout: 600 }) : window.setTimeout(init, 200)

    return () => {
      if (idle) (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle)
      else window.clearTimeout(handle)
      cleanup()
    }
  }, [targetRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0, transition: "opacity 700ms ease" }}
    />
  )
}
