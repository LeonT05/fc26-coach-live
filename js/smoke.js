/* Animated menu smoke (Figma component "Backdrop"). WebGL fragment shader: domain-warped, billowing fbm fog in 3
   parallax sheets (teal / charcoal palette from tokens.css), self-shadowed rims, sweeping light shafts from the top
   right, a breathing warm right-edge glow and a top vignette. A luminance guard keeps it at or below the brightest fog
   used in the contrast audit (#2E4A52), so text contrast stays AA.
   Cost control: renders at 1/4 of the window resolution, capped at 30 fps, paused when the tab is hidden,
   a single static frame under prefers-reduced-motion or #noanim. Falls back to the static CSS backdrop. */
'use strict';
(function smoke() {
  const cv = document.getElementById('smoke');
  if (!cv) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /noanim/.test(location.hash);
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) { cv.remove(); return; }
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision mediump float;
uniform vec2 res; uniform float t; uniform vec3 cBg, cTeal, cTeal2, cWarm;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
// one fog sheet: domain-warped fbm that drifts sideways and slowly billows (the warp itself evolves over time)
float layer(vec2 uv,float sc,float sp,float ph){vec2 q=uv*sc+vec2(t*sp,sin(t*.11+ph)*.45);
 vec2 w=vec2(fbm(q+ph+t*.035),fbm(q+vec2(5.2,1.3)+ph-t*.028));return fbm(q+1.9*w+vec2(t*sp*.7,t*.012));}
void main(){vec2 uv=gl_FragCoord.xy/res;vec2 a=vec2(uv.x*res.x/res.y,uv.y);
 vec3 col=cBg;
 // three parallax sheets: far (slow, big), mid, near (fast, fine)
 float l1=layer(a,1.0,.040,0.);float l2=layer(a,1.7,-.060,3.1);float l3=layer(a,2.8,.090,7.4);
 float left=smoothstep(1.3,.0,distance(uv,vec2(.12,.45)));float mid=smoothstep(1.0,.0,distance(uv,vec2(.52,.30)));
 float floorF=smoothstep(.55,.0,uv.y);
 col=mix(col,cTeal2,clamp(l1*1.45-.38,0.,1.)*(left*.95+floorF*.35));
 // mid sheet with self-shadowing: brighter where density falls toward the light (top right) = volumetric rims
 float l2s=layer(a+vec2(-.035,-.05),1.7,-.060,3.1);float rim=clamp((l2-l2s)*3.2,0.,1.);
 col=mix(col,cTeal,clamp(l2*1.35-.40,0.,1.)*(mid*.85+left*.4));
 col+=cTeal2*rim*.22*(mid+left*.6);
 col=mix(col,cTeal2*1.05,clamp(l3*1.2-.50,0.,1.)*.45*(left+mid+floorF*.4));
 // light shafts from above-right, slowly sweeping, broken up by the fog
 vec2 src=vec2(.78,1.25);vec2 d=uv-src;float ang=atan(d.x,-d.y);
 float rays=n(vec2(ang*16.+t*.07,t*.05))*n(vec2(ang*31.-t*.05,3.1));
 float shaft=pow(rays,2.2)*smoothstep(1.5,.2,length(d))*smoothstep(.0,.6,uv.y+.25);
 col+=mix(cTeal2,vec3(.62,.78,.80),.35)*shaft*.48*(.55+.45*l2);
 // warm glow on the right edge, breathing
 float warm=smoothstep(.55,1.05,uv.x)*smoothstep(.0,.55,uv.y)*smoothstep(1.,.5,uv.y);
 col=mix(col,cWarm,warm*(.40+.06*sin(t*.45))*clamp(l2*1.5,.45,1.));
 col*=mix(.60,1.,smoothstep(1.,.55,uv.y));
 // contrast guard: never brighter than the brightest fog the AA audit used (#2E4A52, luma ~.27)
 float lu=dot(col,vec3(.2126,.7152,.0722));col*=min(1.,.27/max(lu,.001));
  col+=(h(gl_FragCoord.xy)-.5)*.004;  // static dither only (Leon: much less film grain)
 gl_FragColor=vec4(col,1.);}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  let prog;
  try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog); }
  catch (e) { cv.remove(); return; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = k => gl.getUniformLocation(prog, k);
  gl.uniform3fv(U('cBg'), rgb(tok('--color-bg-page') || '#181b26'));
  gl.uniform3fv(U('cTeal'), rgb(tok('--color-fog-teal') || '#24515a'));
  gl.uniform3fv(U('cTeal2'), rgb(tok('--color-fog-teal-2') || '#2a6470'));
  gl.uniform3fv(U('cWarm'), rgb(tok('--color-fog-warm') || '#6b4a3c'));
  const uRes = U('res'), uT = U('t');
  const SCALE = 0.25, FRAME = 1000 / 30;
  function size() { cv.width = Math.max(64, Math.round(innerWidth * SCALE)); cv.height = Math.max(36, Math.round(innerHeight * SCALE)); gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uRes, cv.width, cv.height); }
  size(); addEventListener('resize', () => { size(); draw(performance.now()); });
  const t0 = performance.now() - 20000 * Math.random();
  function draw(now) { gl.uniform1f(uT, (now - t0) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  let last = 0, raf = 0;
  function loop(now) { raf = requestAnimationFrame(loop); if (now - last < FRAME) return; last = now; draw(now); }
  draw(performance.now());
  document.getElementById('smokeStatic') && (document.getElementById('smokeStatic').style.opacity = '0');
  if (reduced) return;
  raf = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) raf = requestAnimationFrame(loop); });
})();
