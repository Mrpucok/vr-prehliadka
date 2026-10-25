// vrmove.js - collision + locomotion for WebXR (Quest). three + three-mesh-bvh.
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
export async function loadCollider(url){const b=await (await fetch(url)).arrayBuffer();return colliderFromBuffer(b);}
export function colliderFromBuffer(b){const h=new Float32Array(b,0,4),q=new Uint16Array(b,16);const p=new Float32Array(q.length);
 for(let i=0;i<q.length;i+=3){p[i]=h[0]+q[i]*h[3];p[i+1]=h[1]+q[i+1]*h[3];p[i+2]=h[2]+q[i+2]*h[3];}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));const bvh=new MeshBVH(g,{maxLeafTris:8});return {geometry:g,bvh};}
const _seg=new THREE.Line3(),_box=new THREE.Box3(),_tp=new THREE.Vector3(),_cp=new THREE.Vector3(),_ray=new THREE.Ray(),_v=new THREE.Vector3(),_d=new THREE.Vector3(0,-1,0);
const _pp=new THREE.Vector3();
export class Body{
 constructor(col,o={}){this.col=col;this.r=o.radius??0.18;this.step=o.step??0.25;this.top=o.top??1.35;this.maxFall=o.maxFall??3.5;this.footprint=o.footprint||null;this.keepInside=!!this.footprint;}
 // inside/outside test against the house footprint rect [x0,z0,x1,z1] (window openings have no glass in the GLB)
 indoor(p){const f=this.footprint;if(!f)return true;return p.x>f[0]&&p.x<f[2]&&p.z>f[1]&&p.z<f[3];}
 // push a body (feet position p) out of geometry horizontally; returns true if it touched something
 resolve(p){let hit=false;for(let it=0;it<4;it++){let moved=false;const r=this.r;
  _seg.start.set(p.x,p.y+(this.low??0.85)+r,p.z);_seg.end.set(p.x,p.y+Math.max(this.top,1.6),p.z);
  _box.makeEmpty();_box.expandByPoint(_seg.start);_box.expandByPoint(_seg.end);_box.min.addScalar(-r);_box.max.addScalar(r);
  this.col.bvh.shapecast({intersectsBounds:bx=>bx.intersectsBox(_box),intersectsTriangle:tri=>{
   const d=tri.closestPointToSegment(_seg,_tp,_cp);if(d<r){_v.subVectors(_cp,_tp);_v.y=0;let l=_v.length();
    if(l<1e-6){tri.getNormal(_v);_v.y=0;l=_v.length();if(l<1e-6)return false;}
    _v.multiplyScalar((r-d)/l);p.x+=_v.x;p.z+=_v.z;_seg.start.x+=_v.x;_seg.end.x+=_v.x;_seg.start.z+=_v.z;_seg.end.z+=_v.z;moved=hit=true;}return false;}});
  if(!moved)break;}return hit;}
 // floor under p within [p.y-maxFall, p.y+step]; returns y or null
 floor(p){let b=this.floor1(p);const o=this.r*0.8;for(const [dx,dz] of [[o,0],[-o,0],[0,o],[0,-o]]){const q=_pp.set(p.x+dx,p.y,p.z+dz);const f=this.floor1(q);if(f!==null&&(b===null||f>b))b=f;}return b;}
 floor1(p){_ray.origin.set(p.x,p.y+this.step+0.05,p.z);_ray.direction.copy(_d);
  const hs=this.col.bvh.raycast(_ray,THREE.DoubleSide,0,this.step+0.05+this.maxFall);let best=null;
  for(const h of hs){if(!h.face)continue;const n=h.face.normal;if(n.y<0.5)continue;if(best===null||h.point.y>best)best=h.point.y;}return best;}
 // ground just under (small radius probe of 5 points so we don't drop into gaps)
 ground(p){let b=this.floor(p);return b;}
 blocked(p){const q=p.clone();this.resolve(q);return q.distanceToSquared(p)>1e-6;}
 // move feet position p by horizontal delta d (in place), with sliding, stairs, floor snapping
 move(p,d){const L=Math.hypot(d.x,d.z);const n=Math.max(1,Math.ceil(L/(this.r*0.5)));
  for(let i=0;i<n;i++){const ox=p.x,oz=p.z,oy=p.y,was=this.keepInside?this.indoor(p):null;p.x+=d.x/n;p.z+=d.z/n;this.resolve(p);
   let f=this.floor(p);if(f===null){p.x=ox;p.z=oz;p.y=oy;break;}
   if(this.keepInside){const yy=p.y;p.y=f;const now=this.indoor(p);p.y=yy;if(now!==was&&f>oy+0.1){// window/glass opening: do not cross inside<->outside
     p.x=ox;p.z=oz;p.y=oy;if(i===0&&n===1&&!this._slid){this._slid=1;const a=this.move(p,new THREE.Vector3(d.x,0,0));this._slid=0;if(Math.abs(p.x-ox)<1e-5){this._slid=1;this.move(p,new THREE.Vector3(0,0,d.z));this._slid=0;}}break;}}// no floor (void) -> stay
   if(f<oy-(this.maxDrop??1.0)){p.x=ox;p.z=oz;p.y=oy;break;}
   {const S=this.stairs||[[2.5,0.3,4.5,3.2]];const inS=S.some(r=>p.x>r[0]&&p.x<r[2]&&p.z>r[1]&&p.z<r[3]);if(this.indoor(p)&&!inS&&f>oy+0.06)f=oy;}
   const P=this.plot||(this.footprint?[this.footprint[0]-15,this.footprint[1]-15,this.footprint[2]+15,this.footprint[3]+15]:null);if(P&&(p.x<Math.max(P[0],-11.5)||p.z<Math.max(P[1],-11.5)||p.x>Math.min(P[2],24.5)||p.z>Math.min(P[3],24.5))){p.x=ox;p.z=oz;p.y=oy;break;}
   p.y=f;}return p;}
}
// --- input helpers ---
export function stick(g){if(!g)return [0,0];const a=g.axes;let x=a.length>=4?a[2]:a[0]||0,y=a.length>=4?a[3]:a[1]||0;
 if(a.length>=4&&Math.abs(x)+Math.abs(y)<1e-3){x=a[0]||0;y=a[1]||0;}const m=Math.hypot(x,y),dz=0.15;if(m<dz)return [0,0];const s=Math.min(1,(m-dz)/(1-dz))/m;return [x*s,y*s];}
export class Locomotion{
 constructor({renderer,rig,camera,scene,body,speed=1.4,snapDeg=30}){Object.assign(this,{renderer,rig,camera,scene,body,speed,snap:THREE.MathUtils.degToRad(snapDeg)});
  this.turnArmed={left:true,right:true};this.head=new THREE.Vector3();this.feet=new THREE.Vector3();this.enabled=true;
  const N=40;this.arcPts=new Float32Array(N*3);const ag=new THREE.BufferGeometry();ag.setAttribute('position',new THREE.BufferAttribute(this.arcPts,3));
  this.arc=new THREE.Line(ag,new THREE.LineBasicMaterial({color:0x44ff88,depthTest:false,transparent:true}));this.arc.renderOrder=9;this.arc.frustumCulled=false;this.arc.visible=false;scene.add(this.arc);
  this.ring=new THREE.Mesh(new THREE.RingGeometry(0.2,0.27,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x44ff88,depthTest:false}));this.ring.renderOrder=9;this.ring.visible=false;scene.add(this.ring);
  this.target=null;}
 headPos(){this.camera.getWorldPosition(this.head);return this.head;}
 // place body so that head (x,z) is at x,z and feet at y
 placeFeet(x,y,z){const h=this.headPos();this.rig.position.x+=x-h.x;this.rig.position.z+=z-h.z;this.rig.position.y=y;}
 init(){const h=this.headPos();this.feet.set(h.x,this.rig.position.y,h.z);const f=this.body.floor(this.feet);if(f!==null)this.feet.y=f;this.body.resolve(this.feet);this.placeFeet(this.feet.x,this.feet.y,this.feet.z);}
 update(dt,sources){if(!this.enabled)return;dt=Math.min(dt,0.05);const h=this.headPos();
  const p=this.feet.set(h.x,this.rig.position.y,h.z);const d=new THREE.Vector3();
  for(const s of sources){const g=s.gamepad;if(!g||s.hand)continue;const [x,y]=stick(g);
   if(s.handedness==='left'){if(x||y){const q=new THREE.Quaternion();this.camera.getWorldQuaternion(q);const fw=new THREE.Vector3(0,0,-1).applyQuaternion(q);fw.y=0;
     if(fw.lengthSq()<1e-4)fw.set(0,1,0).applyQuaternion(q).negate().setY(0);fw.normalize();const rt=new THREE.Vector3(-fw.z,0,fw.x);
     d.addScaledVector(fw,-y*this.speed*dt).addScaledVector(rt,x*this.speed*dt);}}
   else if(s.handedness==='right'){const k='right';if(Math.abs(x)>0.6&&this.turnArmed[k]){this.turnArmed[k]=false;this.turn(-Math.sign(x)*this.snap);}else if(Math.abs(x)<0.3)this.turnArmed[k]=true;}}
  const before=p.clone();this.body.move(p,d); // includes push-out when the user physically walks into a wall
  this.rig.position.x+=p.x-before.x;this.rig.position.z+=p.z-before.z;this.rig.position.y=p.y;}
 turn(a){const h=this.headPos().clone();this.rig.position.sub(h).applyAxisAngle(new THREE.Vector3(0,1,0),a).add(h);this.rig.rotation.y+=a;this.rig.updateMatrixWorld(true);}
 // teleport arc from an Object3D (controller)
 updateArc(ctrl){const o=new THREE.Vector3().setFromMatrixPosition(ctrl.matrixWorld);const dir=new THREE.Vector3(0,0,-1).transformDirection(ctrl.matrixWorld);
  const v=dir.multiplyScalar(7),g=9.8,dt=0.04;let prev=o.clone(),n=0,hit=null;const ray=new THREE.Ray();this.arcPts.set([o.x,o.y,o.z],0);n=1;
  for(let i=1;i<40&&!hit;i++){const t=i*dt;const c=new THREE.Vector3(o.x+v.x*t,o.y+v.y*t-0.5*g*t*t,o.z+v.z*t);const seg=c.clone().sub(prev);const L=seg.length();
   ray.set(prev,seg.normalize());const hh=this.body.col.bvh.raycastFirst(ray,THREE.DoubleSide,0,L);if(hh){hit=hh;c.copy(hh.point);}this.arcPts.set([c.x,c.y,c.z],n*3);n++;prev=c;}
  for(let i=n;i<40;i++)this.arcPts.set([prev.x,prev.y,prev.z],i*3);this.arc.geometry.attributes.position.needsUpdate=true;this.arc.visible=true;
  let ok=false;if(hit&&hit.face&&hit.face.normal.y>0.7){const t=hit.point.clone();const t2=t.clone();this.body.resolve(t2);
   ok=t2.distanceTo(t)<0.02&&this.body.floor(t)!==null&&(!this.body.keepInside||this.body.indoor(t)===this.body.indoor(this.feet));if(ok)this.target=t;}
  if(!ok)this.target=null;const col=ok?0x44ff88:0xff4444;this.arc.material.color.setHex(col);this.ring.material.color.setHex(col);
  this.ring.visible=!!hit;if(hit)this.ring.position.copy(hit.point).y+=0.01;return ok;}
 hideArc(){this.arc.visible=false;this.ring.visible=false;}
 doTeleport(){if(this.target){this.placeFeet(this.target.x,this.target.y,this.target.z);}this.target=null;this.hideArc();}
}
// fallback: build collider from loaded meshes (world space)
export function colliderFromObject(root){root.updateMatrixWorld(true);const arr=[];const v=new THREE.Vector3();
 root.traverse(o=>{if(!o.isMesh||!o.geometry.attributes.position)return;const g=o.geometry,p=g.attributes.position,ix=g.index;const n=ix?ix.count:p.count;
  for(let i=0;i<n;i++){v.fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(o.matrixWorld);arr.push(v.x,v.y,v.z);}});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));return {geometry:g,bvh:new MeshBVH(g,{maxLeafTris:8})};}

// --- dollhouse: shrink the world group to a tabletop model in front of the viewer ---
export class Dollhouse{
 constructor({renderer,world,rig,camera,orbit,center=[4.4,4.0],scale=0.06}){Object.assign(this,{renderer,world,rig,camera,orbit,center,scale});this.on=false;this.yaw=0;this.T=new THREE.Vector3();this.grab=null;this.saved=null;}
 apply(){const s=this.scale,w=this.world;w.scale.setScalar(s);w.rotation.set(0,this.yaw,0);const c=new THREE.Vector3(this.center[0]*s,0,this.center[1]*s).applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw);w.position.copy(this.T).sub(c);w.updateMatrixWorld(true);}
 toggle(){const xr=this.renderer.xr.isPresenting;
  if(!this.on){this.saved={rp:this.rig.position.clone(),rr:this.rig.rotation.y,cp:this.camera.position.clone(),ot:this.orbit&&this.orbit.target.clone()};
   const h=new THREE.Vector3(),q=new THREE.Quaternion();this.camera.getWorldPosition(h);this.camera.getWorldQuaternion(q);const f=new THREE.Vector3(0,0,-1).applyQuaternion(q);f.y=0;if(f.lengthSq()<1e-4)f.set(0,0,-1);f.normalize();
   this.T.copy(h).addScaledVector(f,0.75);this.T.y=h.y-0.55;this.yaw=Math.atan2(f.x,f.z)+Math.PI;this.on=true;this.apply();
   if(!xr&&this.orbit){this.orbit.target.copy(this.T).setY(this.T.y+0.12);this.camera.position.copy(this.T).addScaledVector(f,-0.9).setY(this.T.y+0.55);this.orbit.update();}}
  else{this.on=false;this.grab=null;this.world.position.set(0,0,0);this.world.rotation.set(0,0,0);this.world.scale.setScalar(1);this.world.updateMatrixWorld(true);const S=this.saved;
   if(S){this.rig.position.copy(S.rp);this.rig.rotation.y=S.rr;this.rig.updateMatrixWorld(true);if(!xr){this.camera.position.copy(S.cp);if(this.orbit&&S.ot){this.orbit.target.copy(S.ot);this.orbit.update();}}}}}
 _ang(c){const p=new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);return Math.atan2(p.x-this.T.x,p.z-this.T.z);}
 grabStart(c){if(this.on)this.grab={c,a0:this._ang(c),y0:this.yaw};}
 grabEnd(c){if(this.grab&&this.grab.c===c)this.grab=null;}
 update(dt,session){if(!this.on)return;let ch=false;
  if(this.grab){let d=this._ang(this.grab.c)-this.grab.a0;this.yaw=this.grab.y0+d*1.5;ch=true;}
  if(session)for(const s of session.inputSources){const g=s.gamepad;if(!g||s.hand)continue;const [x,y]=stick(g);
   if(s.handedness==='right'&&x){this.yaw-=x*1.8*dt;ch=true;}
   if(s.handedness==='left'&&y){this.scale=THREE.MathUtils.clamp(this.scale*(1-y*0.8*dt),0.02,0.2);ch=true;}}
  if(ch)this.apply();}
}
