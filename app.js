import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const canvas = document.querySelector('#scene');
const scoreEl = document.querySelector('#score');
const resultEl = document.querySelector('#result');
const xrStatusEl = document.querySelector('#xr-status');
const aimXInput = document.querySelector('#aim-x');
const aimYInput = document.querySelector('#aim-y');
const powerInput = document.querySelector('#power');
const throwButton = document.querySelector('#throw-button');
const resetButton = document.querySelector('#reset-button');

const targetCenter = new THREE.Vector3(0, 1.45, -8);
const targetRadius = 0.95;
const stoneStart = new THREE.Vector3(0, 1.25, 2.2);
const gravity = new THREE.Vector3(0, -9.8, 0);
const clock = new THREE.Clock();

let stoneVelocity = new THREE.Vector3();
let stoneFlying = false;
let lastStonePosition = new THREE.Vector3();
let totalScore = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x151923);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 1.7, 5.2);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, -4);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 3;
controls.maxDistance = 9;

const hemiLight = new THREE.HemisphereLight(0xcad8ff, 0x34281e, 1.8);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
scene.add(keyLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(18, 18),
  new THREE.MeshStandardMaterial({ color: 0x3f4a3c, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const lane = new THREE.Mesh(
  new THREE.PlaneGeometry(2.2, 9),
  new THREE.MeshStandardMaterial({ color: 0x5e6859, roughness: 0.95 })
);
lane.rotation.x = -Math.PI / 2;
lane.position.z = -3.2;
lane.position.y = 0.003;
scene.add(lane);

const target = new THREE.Group();
target.position.copy(targetCenter);
scene.add(target);

const backing = new THREE.Mesh(
  new THREE.CylinderGeometry(1.08, 1.08, 0.09, 64),
  new THREE.MeshStandardMaterial({ color: 0xf0eadf, roughness: 0.65 })
);
backing.rotation.x = Math.PI / 2;
backing.castShadow = true;
backing.receiveShadow = true;
target.add(backing);

[
  { radius: 0.95, color: 0x253044 },
  { radius: 0.64, color: 0xe24a3b },
  { radius: 0.33, color: 0xf2b84b }
].forEach((ring) => {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(ring.radius, 0.025, 12, 80),
    new THREE.MeshStandardMaterial({ color: ring.color, roughness: 0.45 })
  );
  mesh.position.z = 0.065;
  target.add(mesh);
});

const stand = new THREE.Mesh(
  new THREE.BoxGeometry(0.18, 1.65, 0.18),
  new THREE.MeshStandardMaterial({ color: 0x6f5235, roughness: 0.75 })
);
stand.position.set(0, 0.55, targetCenter.z - 0.08);
stand.castShadow = true;
scene.add(stand);

const stone = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.18, 1),
  new THREE.MeshStandardMaterial({ color: 0x777b80, roughness: 0.9 })
);
stone.castShadow = true;
stone.position.copy(stoneStart);
scene.add(stone);

const aimMarker = new THREE.Mesh(
  new THREE.RingGeometry(0.08, 0.12, 28),
  new THREE.MeshBasicMaterial({ color: 0x72d7ff, side: THREE.DoubleSide })
);
aimMarker.position.z = targetCenter.z + 0.09;
scene.add(aimMarker);

const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0x72d7ff });
const trajectory = new THREE.Line(new THREE.BufferGeometry(), trajectoryMaterial);
scene.add(trajectory);

const controller = renderer.xr.getController(0);
controller.addEventListener('select', () => {
  throwFromXRController(controller);
});
scene.add(controller);

function updateAimMarker() {
  aimMarker.position.x = Number(aimXInput.value);
  aimMarker.position.y = Number(aimYInput.value);
}

function getAimPoint() {
  return new THREE.Vector3(Number(aimXInput.value), Number(aimYInput.value), targetCenter.z);
}

function resetStone() {
  stoneFlying = false;
  stoneVelocity.set(0, 0, 0);
  stone.position.copy(stoneStart);
  lastStonePosition.copy(stone.position);
  stone.rotation.set(0, 0, 0);
  resultEl.textContent = 'Ready';
  throwButton.disabled = false;
}

function throwStone(origin = stoneStart, targetPoint = getAimPoint(), power = Number(powerInput.value)) {
  resetStone();
  stone.position.copy(origin);
  lastStonePosition.copy(origin);
  const direction = targetPoint.clone().sub(origin).normalize();
  stoneVelocity.copy(direction.multiplyScalar(power));
  stoneFlying = true;
  resultEl.textContent = 'Thrown';
  throwButton.disabled = true;
}

function throwFromXRController(activeController) {
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3(0, 0, -1);
  const rotation = new THREE.Quaternion();

  activeController.getWorldPosition(origin);
  activeController.getWorldQuaternion(rotation);
  direction.applyQuaternion(rotation);

  const targetPoint = origin.clone().add(direction.multiplyScalar(8));
  targetPoint.y += 0.35;
  throwStone(origin, targetPoint, Math.max(10, Number(powerInput.value)));
}

function updateProjectile(delta) {
  if (!stoneFlying) {
    return;
  }

  lastStonePosition.copy(stone.position);
  stoneVelocity.addScaledVector(gravity, delta);
  stone.position.addScaledVector(stoneVelocity, delta);
  stone.rotation.x += delta * stoneVelocity.length() * 0.9;
  stone.rotation.z += delta * stoneVelocity.length() * 0.55;

  checkTargetHit();

  if (stone.position.y <= 0.18) {
    stone.position.y = 0.18;
    finishThrow('Miss', 0);
  }
}

function checkTargetHit() {
  const targetZ = targetCenter.z;
  const crossedTarget = lastStonePosition.z > targetZ && stone.position.z <= targetZ;

  if (!crossedTarget) {
    return;
  }

  const travel = stone.position.clone().sub(lastStonePosition);
  const zTravel = stone.position.z - lastStonePosition.z;
  const t = zTravel === 0 ? 0 : (targetZ - lastStonePosition.z) / zTravel;
  const hitPoint = lastStonePosition.clone().addScaledVector(travel, t);
  const hitDistance = Math.hypot(hitPoint.x - targetCenter.x, hitPoint.y - targetCenter.y);

  if (hitDistance <= targetRadius) {
    const points = getPoints(hitDistance);
    finishThrow(`${points} point hit`, points);
  }
}

function getPoints(distanceFromCenter) {
  if (distanceFromCenter <= 0.22) {
    return 100;
  }

  if (distanceFromCenter <= 0.55) {
    return 50;
  }

  return 25;
}

function finishThrow(label, points) {
  stoneFlying = false;
  stoneVelocity.set(0, 0, 0);
  totalScore += points;
  scoreEl.textContent = String(totalScore);
  resultEl.textContent = label;
  throwButton.disabled = false;
}

function updateTrajectoryPreview() {
  const origin = stoneStart.clone();
  const velocity = getAimPoint().sub(origin).normalize().multiplyScalar(Number(powerInput.value));
  const points = [];
  const previewGravity = gravity.clone();

  for (let i = 0; i < 44; i += 1) {
    const t = i * 0.045;
    const point = origin
      .clone()
      .addScaledVector(velocity, t)
      .addScaledVector(previewGravity, 0.5 * t * t);
    points.push(point);
  }

  trajectory.geometry.dispose();
  trajectory.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function updateSize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

async function setupXRStatus() {
  if (!('xr' in navigator)) {
    xrStatusEl.textContent = 'XR unavailable here. Desktop mode is ready.';
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    xrStatusEl.textContent = supported
      ? 'XR ready. Use the Enter VR button when testing on a headset.'
      : 'XR API found, but immersive VR is not supported here.';
  } catch (error) {
    xrStatusEl.textContent = 'XR support check failed. Desktop mode is ready.';
  }
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  controls.update();
  updateProjectile(delta);
  renderer.render(scene, camera);
}

throwButton.addEventListener('click', () => throwStone());
resetButton.addEventListener('click', () => {
  totalScore = 0;
  scoreEl.textContent = '0';
  resetStone();
});

[aimXInput, aimYInput, powerInput].forEach((input) => {
  input.addEventListener('input', () => {
    updateAimMarker();
    updateTrajectoryPreview();
  });
});

window.addEventListener('resize', updateSize);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (!stoneFlying) {
      throwStone();
    }
  }

  if (event.key.toLowerCase() === 'r') {
    resetStone();
  }
});

document.body.appendChild(VRButton.createButton(renderer));
updateAimMarker();
updateTrajectoryPreview();
resetStone();
setupXRStatus();
renderer.setAnimationLoop(animate);
