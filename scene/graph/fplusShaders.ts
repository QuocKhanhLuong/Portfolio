/** The production F+ post layers, kept as small readable shader strings. */
export const FPLUS_SMOKE_VERTEX = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const FPLUS_SMOKE_FRAGMENT = `
uniform float uTime;
uniform float uAspect;
uniform vec3 uTeal;
uniform vec3 uGold;
uniform float uAmp;
uniform float uZoom;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.0; a*=0.5; }
  return v;
}
void main(){
  vec2 p = vec2(vUv.x*uAspect, vUv.y);
  vec2 ctr = vec2(0.5*uAspect, 0.5);
  vec2 uv = (ctr + (p - ctr) / uZoom) * 2.4;
  float t = uTime * 0.045;
  vec2 q = vec2(fbm(uv + vec2(0.0, t*1.3)), fbm(uv + vec2(5.2, -t)));
  vec2 r = vec2(fbm(uv + 2.0*q + vec2(1.7,9.2) + t*0.4), fbm(uv + 2.0*q + vec2(8.3,2.8) - t*0.3));
  float f = fbm(uv + 2.2*r);
  f = smoothstep(0.12, 0.95, f);
  vec3 col = uTeal * f + uGold * smoothstep(0.72, 1.0, f) * 0.5;
  gl_FragColor = vec4(col * uAmp, 1.0);
}
`;

export const FPLUS_FINAL_VERTEX = `
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;

export const FPLUS_FINAL_FRAGMENT = `
uniform sampler2D tDiffuse;
uniform sampler2D tParticles;
uniform float uPartMix;
varying vec2 vUv;
float rand(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 uv=vUv;
  vec2 d=uv-0.5;
  float ca=0.0016;
  vec3 col;
  col.r=texture2D(tDiffuse,uv-d*ca).r;
  col.g=texture2D(tDiffuse,uv).g;
  col.b=texture2D(tDiffuse,uv+d*ca).b;
  col+=texture2D(tParticles,uv).rgb*uPartMix;
  col=(col-0.5)*1.2+0.5;
  col+=(rand(gl_FragCoord.xy)-0.5)*0.0063;
  gl_FragColor=vec4(col,1.0);
}
`;

export const FPLUS_BLACK_PIXEL = new Uint8Array([0, 0, 0, 255]);
