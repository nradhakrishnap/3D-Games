import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

// ---- Tunable constants -----------------------------------------------
const FIELD_RADIUS = 68;
const PITCH_HALF_LENGTH = 10; // bowler stumps at z = -2*PITCH_HALF_LENGTH, batsman stumps at z = 0
const BOWLER_Z = -2 * PITCH_HALF_LENGTH;
const BATSMAN_Z = 0;
const BALL_RADIUS = 0.12;
const GRAVITY = 15.5;
const RESTITUTION = 0.55;
const STUMP_HALF_WIDTH = 0.14;
const STUMP_HEIGHT = 0.71;
const HIT_WINDOW = { start: -1.4, end: 0.7, ideal: -0.25 };
const WICKETS_LIMIT = 1;
const OVERS_LIMIT = 5;
const BALLS_PER_OVER = 6;

export function createCricketGame(container, callbacks) {
  const { onUpdate, onGameOver } = callbacks;

  // ---- Renderer / scene / camera --------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = makeSkyGradient();
  scene.fog = new THREE.Fog(0xbfe3ff, 60, 130);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  camera.position.set(0, 1.75, 4.2);
  camera.lookAt(0, 1.2, BOWLER_Z);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // ---- Lighting ----------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x2d5a27, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(30, 45, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  // ---- Field --------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(FIELD_RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0x2d7a34, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 2 * PITCH_HALF_LENGTH + 4),
    new THREE.MeshStandardMaterial({ color: 0xcdb885, roughness: 0.85 })
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0.01, BOWLER_Z / 2);
  pitch.receiveShadow = true;
  scene.add(pitch);

  // boundary rope
  const ropePts = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    ropePts.push(new THREE.Vector3(Math.cos(a) * (FIELD_RADIUS - 1.5), 0.05, Math.sin(a) * (FIELD_RADIUS - 1.5) + BOWLER_Z / 2));
  }
  const rope = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(ropePts),
    new THREE.LineBasicMaterial({ color: 0xffffff })
  );
  scene.add(rope);

  // simple stands ring
  const standsGeo = new THREE.CylinderGeometry(FIELD_RADIUS + 6, FIELD_RADIUS + 6, 4, 48, 1, true);
  const stands = new THREE.Mesh(standsGeo, new THREE.MeshStandardMaterial({ color: 0x8a97ad, side: THREE.BackSide }));
  stands.position.set(0, 2, BOWLER_Z / 2);
  scene.add(stands);

  // ---- Stumps ---------------------------------------------------------------
  function makeStumps(z) {
    const group = new THREE.Group();
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0xf1e6c8, roughness: 0.6 });
    for (let i = -1; i <= 1; i++) {
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, STUMP_HEIGHT, 10), stumpMat);
      stump.position.set(i * 0.13, STUMP_HEIGHT / 2, z);
      stump.castShadow = true;
      group.add(stump);
    }
    const bail = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.02, 0.02), stumpMat);
    bail.position.set(0, STUMP_HEIGHT + 0.01, z);
    group.add(bail);
    scene.add(group);
    return group;
  }
  const batsmanStumps = makeStumps(BATSMAN_Z);
  makeStumps(BOWLER_Z);

  // ---- Players (simple low-poly figures) --------------------------------------
  function makeFigure(color) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    );
    body.position.y = 0.95;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8c39e, roughness: 0.8 })
    );
    head.position.y = 1.65;
    head.castShadow = true;
    group.add(body, head);
    return group;
  }

  const bowler = makeFigure(0x2f4b8f);
  bowler.position.set(0.4, 0, BOWLER_Z - 2.2);
  scene.add(bowler);

  const batsman = makeFigure(0xb43b3b);
  batsman.position.set(0.55, 0, BATSMAN_Z + 0.9);
  batsman.rotation.y = Math.PI;
  scene.add(batsman);

  const bat = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.75, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xd9b878, roughness: 0.5 })
  );
  bat.position.set(-0.32, 0.65, 0.05);
  bat.rotation.z = 0.25;
  bat.castShadow = true;
  const batPivot = new THREE.Group();
  batPivot.position.set(0, 0.9, 0);
  batPivot.add(bat);
  batsman.add(batPivot);

  // ---- Ball -------------------------------------------------------------------
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xb1141c, roughness: 0.4 })
  );
  ball.castShadow = true;
  scene.add(ball);

  // ---- Game state ---------------------------------------------------------------
  let runs = 0, wickets = 0, ballsBowled = 0;
  let resolved = true; // true between deliveries; false while a ball is live and un-resolved
  let ballVel = new THREE.Vector3();
  let hasSwungThisBall = false;
  let swingArmed = false;
  let swingAnimT = 0;
  let running = true;

  function resetBallToBowler() {
    ball.position.set((Math.random() - 0.5) * 0.4, 2.0, BOWLER_Z + 1.5);
  }
  resetBallToBowler();

  function startDelivery() {
    if (!running) return;
    resolved = false;
    hasSwungThisBall = false;
    const lineOffset = (Math.random() - 0.5) * 0.5; // line variation
    const lengthVariation = 0.75 + Math.random() * 0.5; // where it pitches
    resetBallToBowler();
    const distance = ball.position.z * -1; // to batsman roughly
    const time = 0.95; // seconds to reach batsman area
    ballVel.set(
      (lineOffset - ball.position.x) / time,
      6.5 * lengthVariation,
      (BATSMAN_Z + 0.3 - ball.position.z) / time
    );
  }

  function updateHUD(message = "") {
    onUpdate({
      runs,
      wickets,
      oversText: `${Math.floor(ballsBowled / BALLS_PER_OVER)}.${ballsBowled % BALLS_PER_OVER}`,
      message,
    });
  }
  updateHUD();

  function swing() {
    if (!running || resolved || hasSwungThisBall) return;
    hasSwungThisBall = true;
    swingArmed = true;
    swingAnimT = 0;

    const z = ball.position.z;
    if (z < HIT_WINDOW.start || z > HIT_WINDOW.end) {
      // swung well outside the window -- treat as a big miss (still let bowled check happen naturally)
      return;
    }
    resolveShot(z);
  }

  function resolveShot(z) {
    const halfWidth = (HIT_WINDOW.end - HIT_WINDOW.start) / 2;
    const quality = Math.max(0, 1 - Math.abs(z - HIT_WINDOW.ideal) / halfWidth);
    let shotRuns, arc, power;
    if (quality >= 0.9) { shotRuns = 6; power = 26; arc = 10; }
    else if (quality >= 0.72) { shotRuns = 4; power = 20; arc = 4; }
    else if (quality >= 0.5) { shotRuns = 2; power = 13; arc = 3; }
    else if (quality >= 0.28) { shotRuns = 1; power = 8; arc = 2.5; }
    else { shotRuns = 0; power = 4; arc = 5; }

    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 0.6,
      arc,
      -power
    );
    ballVel.copy(dir);
    runs += shotRuns;
    finishDelivery(shotRuns > 0 ? `+${shotRuns}` : "Dot ball");
  }

  function checkBowled() {
    const dx = Math.abs(ball.position.x);
    const withinStumps = dx <= STUMP_HALF_WIDTH && ball.position.y <= STUMP_HEIGHT;
    if (withinStumps) {
      wickets += 1;
      finishDelivery("OUT! Bowled", true);
    } else {
      finishDelivery("Dot ball");
    }
  }

  function finishDelivery(message, isWicket = false) {
    if (resolved) return;
    resolved = true;
    ballsBowled += 1;
    updateHUD(message);

    const oversDone = ballsBowled >= OVERS_LIMIT * BALLS_PER_OVER;
    const allOut = wickets >= WICKETS_LIMIT;

    setTimeout(() => {
      if (!running) return;
      if (oversDone || allOut) {
        running = false;
        onGameOver({ runs, wickets, balls: ballsBowled });
      } else {
        startDelivery();
      }
    }, 1300);
  }

  // ---- Input ----------------------------------------------------------------
  function onKeyDown(e) {
    if (e.code === "Space") { e.preventDefault(); swing(); }
  }
  function onTap() { swing(); }
  window.addEventListener("keydown", onKeyDown);
  renderer.domElement.addEventListener("pointerdown", onTap);

  // ---- Animation loop ----------------------------------------------------
  const clock = new THREE.Clock();
  let rafId;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    // bowler tiny run-up bob
    bowler.position.y = Math.abs(Math.sin(clock.elapsedTime * 2)) * 0.03;

    // bat swing animation
    if (swingArmed) {
      swingAnimT += dt;
      const t = Math.min(swingAnimT / 0.35, 1);
      batPivot.rotation.x = -Math.sin(t * Math.PI) * 1.4;
      if (t >= 1) swingArmed = false;
    } else {
      batPivot.rotation.x = 0;
    }

    // ball physics run continuously (including the moment right after a hit,
    // so a struck ball keeps visibly flying while the next delivery is queued)
    ballVel.y -= GRAVITY * dt;
    ball.position.addScaledVector(ballVel, dt);

    if (ball.position.y <= BALL_RADIUS && ballVel.y < 0) {
      ball.position.y = BALL_RADIUS;
      ballVel.y = -ballVel.y * RESTITUTION;
      ballVel.x *= 0.9;
      ballVel.z *= 0.96;
    }

    if (!resolved) {
      // un-swung ball passing the batsman: check stumps
      if (!hasSwungThisBall && ball.position.z >= HIT_WINDOW.end) {
        hasSwungThisBall = true;
        checkBowled();
      }

      // swung outside the timing window (too early/late) -- ball goes untouched
      if (hasSwungThisBall && ball.position.z > 3.5) {
        finishDelivery("Dot ball");
      }
    }

    renderer.render(scene, camera);
  }

  resize();
  animate();
  startDelivery();

  return {
    dispose() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onTap);
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
  };
}

function makeSkyGradient() {
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#6fb3ff");
  grad.addColorStop(1, "#dff1ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
