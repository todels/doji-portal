// The shared heart of Doji Portal: the shader, the uniform map, GL setup and the cursor lens.
// The editor (main.js) and the exported embed code both run exactly this, so they can never drift apart.
// Keep both functions self-contained: "Export code" copies their source text into the embed file.

function dojiPortalCore(){
const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.0,1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes; uniform float uT;
uniform float uStretch,uWarp,uWFall,uInner,uCoreBend,uTrailMode;
uniform float uZoom,uRotDeg,uCX,uCY,uFine;
uniform float uBreathAmt,uBreathPh;
uniform float uLW,uSpread,uDens,uFront,uHalo,uFill,uPhase,uOff,uReach;
uniform float uLayers,uDepth,uLOff,uHotAmt,uHotPos,uTails;
uniform float uMass,uHor,uTwist,uTurb,uBright,uGrain;
uniform vec3 uBlue,uHot;
uniform float uAlpha;
uniform vec2 uMP; uniform float uMM;
float gFill=0.0;
float gDot=1.0;
float gFan=1.0;
float gL=0.0;
float gTrail=0.0;

float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float h31(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}

// Lens: screen point -> point in a stream layer behind the hole. E = that layer's ring radius.
vec2 lens(vec2 th, float E){
  float r2=dot(th,th)+1e-7;
  float r=sqrt(r2);
  float alpha=uWarp*E*pow(E/r,uWFall);
  vec2 b=th-th/r*alpha;
  float tw=uTwist*E*E/(r2+E*E*0.15);
  float c=cos(tw), s=sin(tw);
  b=mat2(c,-s,s,c)*b;
  float ring=exp(-pow((r-E)/(E*0.9+1e-4),2.0));
  vec2 nn=vec2(n3(vec3(th*3.5/(E+0.05),uT*0.15)),n3(vec3(th*3.5/(E+0.05)+17.0,uT*0.15)))-0.5;
  b+=nn*uTurb*E*0.6*ring;
  return b;
}

// The cursor is a second, smaller mass. It bends the streams with the same law as the hole, scaled with each
// layer's depth the way the hole's rings are, so every layer arcs around it by its own amount.
// It fades out a few radii away, so it stays a local warp instead of swaying the whole picture.
vec2 cursorBend(vec2 th, float E){
  if(uMM<=0.0) return vec2(0.0);
  vec2 dm=th-uMP;
  float rm=sqrt(dot(dm,dm)+1e-8);
  float Em=uMM*E/max(uMass,1e-4);
  return dm/rm*uWarp*Em*pow(Em/rm,uWFall)*exp(-pow(rm/(Em*6.0),2.0));
}

// Soft dot profile, pixel-aware: keeps total light constant when a dot shrinks below a pixel.
float prof(float d, float w, float fw){
  float s=sqrt(w*w+fw*fw*0.5);
  return exp(-d*d/(s*s))*(w/s);
}

// 1 where the stream passes the hole, 0 far above and below it.
float fanAt(float y){ return exp(-pow(y/(uMass*uReach+1e-4),2.0)); }
float spreadAt(float y){ return uSpread+gFan*gFill*uMass*0.7*fanAt(y); }

// A dense crowd of tiny dots packed around a line at x = off.
// Lanes live in spread-relative units, so Spread squeezes the same dots closer instead of removing them.
vec3 dots(vec2 s, float off, float laneN, float rowH, float spd, float seed, float fw, vec3 col){
  float sp=spreadAt(s.y);
  float ux=(s.x-off)/sp;
  float base=floor(ux/laneN);
  // Stretch runs along the ring around the hole, the same way the warp already smears the dots,
  // and never gets longer than the neighbouring cells can draw, so a dot is never cut off square.
  vec2 tg=normalize(vec2(-s.y,s.x)+vec2(1e-6,0.0));
  vec2 nm=vec2(-tg.y,tg.x);
  float laneW=laneN*sp;
  float L=gL*0.9*min(laneW/max(abs(tg.x),1e-3),rowH/max(abs(tg.y),1e-3));
  float acc=0.0;
  for(int k=-1;k<=1;k++){
    float lane=base+float(k);
    float lc=(lane+0.5)*laneN;
    if(abs(lc)>3.0) continue;
    float ph=h21(vec2(lane,seed+5.3))*rowH;
    float spdL=spd*(0.85+0.3*h21(vec2(lane,seed+9.1)));
    float y=s.y+uPhase*spdL+ph;
    float row0=floor(y/rowH);
    for(int j=-1;j<=1;j++){
      float row=row0+float(j);
      vec2 id=vec2(lane,mod(row,4096.0))+seed;
      if(h21(id)>uDens*exp(-lc*lc)) continue;
      vec2 c=vec2(off+(lc+(h21(id+1.7)-0.5)*laneN*0.8)*sp, (row+0.1+0.8*h21(id+4.2))*rowH);
      float w=0.00055*uLW*gDot*(0.6+0.8*h21(id+8.1));
      vec2 d=vec2(s.x-c.x,y-c.y);
      float da=dot(d,tg), db=dot(d,nm);
      float sn=sqrt(w*w+fw*fw*0.5);
      float st=sqrt(sn*sn+L*L);
      acc+=exp(-da*da/(st*st)-db*db/(sn*sn))*(w/sn)*pow(sn/st,0.35)*(0.6+0.7*h21(id+6.6));
    }
  }
  return col*acc;
}

// The original trail stretch: each dot drags a trail behind it (upward, since it falls).
// The middle line always uses it (it draws the bright star where the line meets the ring);
// Stretch type Trail uses it on every layer.
vec3 dotsTrail(vec2 s, float off, float laneN, float rowH, float spd, float seed, float fw, vec3 col){
  float sp=spreadAt(s.y);
  float ux=(s.x-off)/sp;
  float base=floor(ux/laneN);
  float acc=0.0;
  for(int k=-1;k<=1;k++){
    float lane=base+float(k);
    float ph=h21(vec2(lane,seed+5.3))*rowH;
    float spdL=spd*(0.85+0.3*h21(vec2(lane,seed+9.1)));
    float y=s.y+uPhase*spdL+ph;
    float row0=floor(y/rowH);
    float lc=(lane+0.5)*laneN;
    if(abs(lc)>3.0) continue;
    float L=gL*rowH*2.6;
    for(int j=0;j<3;j++){
      if(j>0 && L<1e-5) break;
      float row=row0-float(j);
      vec2 id=vec2(lane,mod(row,4096.0))+seed;
      if(h21(id)>uDens*exp(-lc*lc)) continue;
      vec2 c=vec2(off+(lc+(h21(id+1.7)-0.5)*laneN*0.8)*sp, (row+0.1+0.8*h21(id+4.2))*rowH);
      float w=0.00055*uLW*gDot*(0.6+0.8*h21(id+8.1));
      float ty=clamp(y-c.y,0.0,L);
      float fade=1.0-0.75*ty/max(L,1e-5);
      acc+=prof(length(vec2(s.x-c.x,y-c.y-ty)),w,fw)*(0.6+0.7*h21(id+6.6))*fade;
    }
  }
  return col*acc;
}

vec3 stream(vec2 s, float off, float seed, float fw, vec3 col){
  if(gTrail>0.5) return dotsTrail(s,off,0.3,0.0035,1.0,seed,fw,col)*1.3+dotsTrail(s,off,0.45,0.0055,0.7,seed+67.0,fw,col)*0.9;
  return dots(s,off,0.3,0.0035,1.0,seed,fw,col)*1.3+dots(s,off,0.45,0.0055,0.7,seed+67.0,fw,col)*0.9;
}

void main(){
  vec2 ps=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  float cr=cos(radians(uRotDeg)), sr=sin(radians(uRotDeg));
  vec2 p=mat2(cr,sr,-sr,cr)*(ps/uZoom)+vec2(uCX,uCY);
  gDot=mix(1.0,1.0/uZoom,uFine);
  // Breathe: depth and fan out swell and settle together.
  float br=sin(uBreathPh);
  gFill=uFill*max(0.0,1.0+uBreathAmt*br);
  float depthE=clamp(uDepth*(1.0+uBreathAmt*br),0.0,1.0);
  float r=length(p);
  float E=uMass;
  vec3 col=vec3(0.0);
  float n=max(uLayers,1.0);

  // Stream layers at different depths behind the hole: each one bends into its own ring, so they nest and fill the disc.
  for(int i=0;i<8;i++){
    if(float(i)>=n) break;
    float t=n>1.0?float(i)/(n-1.0):0.5;
    float Ei=E*mix(1.0-depthE*0.55,1.0+depthE*0.25,t);
    vec2 s0=lens(p,Ei);
    vec2 s=s0-cursorBend(p,Ei);
    float fw=max(length(dFdx(s)),length(dFdy(s)));
    // Stretch only where the hole magnifies: dots keep their shape in the stream, the warp pulls them into arcs.
    float sfac=smoothstep(1.6,4.5,r/max(length(s0),1e-5));
    gL=uStretch*sfac;
    gTrail=uTrailMode;
    float off=uOff+(h21(vec2(float(i),3.7))-0.5)*2.0*uLOff*fanAt(s.y);
    float hot=uHotAmt*exp(-pow((t-uHotPos)/0.16,2.0));
    vec3 tint=mix(uBlue,uHot,hot);
    vec3 c=stream(s,off,float(i)*41.0,fw,tint)*(1.0+hot*1.5);
    float dx=s.x-off;
    float sp=spreadAt(s.y);
    c+=tint*exp(-dx*dx/(sp*sp*30.0))*uHalo*0.05;
    float near=exp(-pow(r/(Ei*1.5),4.0));
    float inner=mix(uInner,1.0,smoothstep(Ei*0.8,Ei*1.02,r));
    col+=c*(1.6/sqrt(n))*mix(uTails,1.0,near)*inner;
  }

  float hole=E*uHor;
  col*=smoothstep(hole*0.97,hole*1.03+0.0005,r);

  // The middle line runs through its own small warp, so it bends and stretches like the rest instead of sitting on top.
  if(uFront>0.0){
    vec2 sc0=lens(p,E*uCoreBend);
    vec2 sc=sc0-cursorBend(p,E*uCoreBend);
    float fw=max(length(dFdx(sc)),length(dFdy(sc)));
    float sfac=smoothstep(1.6,4.5,r/max(length(sc0),1e-5));
    gFan=0.0; gL=uStretch*sfac; gTrail=1.0;
    col+=stream(sc,uOff,977.0,fw,uBlue)*uFront;
  }

  col=1.0-exp(-col*uBright);
  col*=1.0+(h21(gl_FragCoord.xy+fract(uT*13.7)*100.0)-0.5)*uGrain*3.0;
  col=clamp(col,0.0,1.0);
  // Transparent background: the light becomes its own alpha (premultiplied), so it lands exactly like this over black.
  o=vec4(col,uAlpha>0.5?max(col.r,max(col.g,col.b)):1.0);
}`;

// Setting name -> shader uniform. Speed, Breathe speed and Time drive the clocks in JavaScript instead.
const UNIFORMS = { breathe:'uBreathAmt', zoom:'uZoom', rot:'uRotDeg', cx:'uCX', cy:'uCY', fine:'uFine', corebend:'uCoreBend', stretch:'uStretch', smode:'uTrailMode', warp:'uWarp', wfall:'uWFall', inner:'uInner', lw:'uLW', spread:'uSpread', dens:'uDens', front:'uFront', halo:'uHalo', fill:'uFill', off:'uOff', reach:'uReach',
  layers:'uLayers', depth:'uDepth', loff:'uLOff', tails:'uTails', hotamt:'uHotAmt', hotpos:'uHotPos',
  mass:'uMass', hor:'uHor', twist:'uTwist', turb:'uTurb', bright:'uBright', grain:'uGrain' };
const COLORS = { cBlue:'uBlue', cHot:'uHot' };
const hex = h => [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

// Compile the shader and set up one full-screen triangle. Returns the program and a cached uniform lookup.
function setup(gl){
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  const u = n => (U[n] ??= gl.getUniformLocation(prog, n));
  return { prog, u };
}

// The cursor's lens. It eases toward the pointer, so it moves like something with weight, and fades in and out
// as the pointer enters and leaves. Positions are canvas units: height = 1, origin at the centre, y up.
function makeCursor(){
  let tx = 0, ty = 0, x = 0, y = 0, on = false, amp = 0;
  return {
    move(px, py){ tx = px; ty = py; if (amp < 0.01) { x = px; y = py; } on = true; },
    leave(){ on = false; },
    // lag = seconds it takes to catch up with the pointer.
    step(dt, lag){
      const k = 1 - Math.exp(-dt / Math.max(0.01, lag));
      x += (tx - x) * k; y += (ty - y) * k;
      amp += ((on ? 1 : 0) - amp) * (1 - Math.exp(-dt / 0.25));
      if (!on && amp < 0.002) amp = 0;
      return { x, y, amp };
    }
  };
}

// Send the cursor lens to the shader. mass = its ring radius in canvas heights; the camera maps it into the scene,
// so it keeps the same size on screen at any zoom.
function cursorUniforms(gl, u, c, mass, zoom, rotDeg, cx, cy){
  const a = rotDeg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  gl.uniform2f(u('uMP'), (co * c.x - si * c.y) / zoom + cx, (si * c.x + co * c.y) / zoom + cy);
  gl.uniform1f(u('uMM'), mass * c.amp / zoom);
}

return { VERT, FRAG, UNIFORMS, COLORS, hex, setup, makeCursor, cursorUniforms };
}

// Runs one portal inside `el` with the settings S and no controls. This is what "Export code" ships.
// The canvas fills `el`, so size `el` with CSS. Returns { destroy() }, or null without WebGL 2.
function dojiPortalMount(el, S, core){
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.prepend(canvas);
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: !!S.transparent, premultipliedAlpha: true });
  if (!gl) { canvas.remove(); return null; }
  const { u } = core.setup(gl);
  const cursor = core.makeCursor();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timeScale = reduced ? Math.min(S.time, 0.4) : S.time;

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, S.maxPixelRatio || 2);
    canvas.width = Math.max(2, Math.round(el.clientWidth * dpr));
    canvas.height = Math.max(2, Math.round(el.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  const ro = new ResizeObserver(resize); ro.observe(el); resize();

  // Listen on the window, so text or buttons layered over the portal never block the effect.
  function onMove(e){
    const r = canvas.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside || !r.height) { cursor.leave(); return; }
    cursor.move((e.clientX - r.left - r.width / 2) / r.height, -(e.clientY - r.top - r.height / 2) / r.height);
  }
  const onLift = () => cursor.leave();
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointercancel', onLift);
  document.addEventListener('pointerleave', onLift);

  // Only draw while the portal is on screen and the tab is visible.
  let onScreen = true, raf = 0;
  const io = new IntersectionObserver(es => { onScreen = es[0].isIntersecting; wake(); });
  io.observe(el);
  const onVis = () => wake();
  document.addEventListener('visibilitychange', onVis);

  let t = 0, phase = 0, bph = 0, last = performance.now();
  function frame(now){
    raf = 0;
    if (!onScreen || document.hidden) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    t += dt * timeScale; phase += dt * timeScale * S.speed; bph += dt * timeScale * S.bspeed * 6.2832;
    // keep the clocks small so the GPU's float precision never degrades the dot pattern
    if (bph > 6283.2) bph -= 6283.2;
    if (phase > 400) phase -= 400;
    if (t > 1800) t -= 1800;
    const cur = cursor.step(dt, S.mlag);
    gl.uniform1f(u('uPhase'), phase);
    gl.uniform1f(u('uBreathPh'), bph);
    gl.uniform2f(u('uRes'), canvas.width, canvas.height);
    gl.uniform1f(u('uT'), t);
    gl.uniform1f(u('uAlpha'), S.transparent ? 1 : 0);
    core.cursorUniforms(gl, u, cur, S.mmass, S.zoom, S.rot, S.cx, S.cy);
    for (const [id, n] of Object.entries(core.UNIFORMS)) gl.uniform1f(u(n), +S[id]);
    for (const [id, n] of Object.entries(core.COLORS)) gl.uniform3fv(u(n), core.hex(S[id]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }
  function wake(){ if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  wake();

  return {
    destroy(){
      cancelAnimationFrame(raf); raf = 0; onScreen = false;
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointercancel', onLift);
      document.removeEventListener('pointerleave', onLift);
      document.removeEventListener('visibilitychange', onVis);
      canvas.remove();
    }
  };
}
