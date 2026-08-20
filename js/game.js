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
const HIT_WINDOW = { start: -2.0, end: 1.0, ideal: -0.5 };
const DELIVERY_TIME = 1.5; // seconds from release to reaching the batsman -- slow enough to react to
const BOWL_ANIM_DURATION = 0.6; // seconds for the bowling arm to sweep over the top
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
  const CAMERA_HOME = new THREE.Vector3(0, 2.6, 7.8);
  camera.position.copy(CAMERA_HOME);
  camera.lookAt(0, 1.3, BOWLER_Z);

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
  const grassTexture = makeGrassTexture();
  grassTexture.repeat.set(FIELD_RADIUS / 4, FIELD_RADIUS / 4);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(FIELD_RADIUS, 64),
    new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // sightscreen behind the bowler -- also gives the ball a plain contrasting backdrop
  const sightscreen = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 6.5),
    new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 1 })
  );
  sightscreen.position.set(0, 3.2, BOWLER_Z - 9);
  scene.add(sightscreen);

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

  // crowd -- a ring of small colored blocks in the stands, instanced for performance
  const CROWD_COUNT = 260;
  const crowdColors = [0xd94f4f, 0xdfc23a, 0x3a7fd9, 0xe8e8e8, 0x3aa15c, 0xaa5fd9];
  const crowd = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.4, 0.5, 0.4),
    new THREE.MeshStandardMaterial({ roughness: 1 }),
    CROWD_COUNT
  );
  crowd.castShadow = false;
  const dummy = new THREE.Object3D();
  const crowdCenter = new THREE.Vector3(0, 0, BOWLER_Z / 2);
  for (let i = 0; i < CROWD_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = FIELD_RADIUS + 2 + Math.random() * 5;
    const tier = Math.floor(Math.random() * 3);
    dummy.position.set(
      crowdCenter.x + Math.cos(a) * r,
      1.4 + tier * 0.6 + Math.random() * 0.2,
      crowdCenter.z + Math.sin(a) * r
    );
    dummy.rotation.y = -a;
    dummy.updateMatrix();
    crowd.setMatrixAt(i, dummy.matrix);
    crowd.setColorAt(i, new THREE.Color(crowdColors[Math.floor(Math.random() * crowdColors.length)]));
  }
  scene.add(crowd);

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

  // ---- Players (procedural low-poly figures with visible arms) ------------------
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0b08c, roughness: 0.8 });

  function makeBody(shirtColor, trouserColor) {
    const group = new THREE.Group();
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const trouserMat = new THREE.MeshStandardMaterial({ color: trouserColor, roughness: 0.75 });

    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.85, 8), trouserMat);
    leftLeg.position.set(-0.13, 0.425, 0);
    leftLeg.castShadow = true;
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.13;
    group.add(leftLeg, rightLeg);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), shirtMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), skinMat);
    head.position.y = 1.66;
    head.castShadow = true;
    group.add(head);

    return group;
  }

  function makeArm(color) {
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.06, 0.4, 4, 6),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    );
    arm.castShadow = true;
    return arm;
  }

  // -- Bowler: fixed figure plus a pivoting bowling arm animated per delivery --
  const bowler = makeBody(0x2f4b8f, 0xf1efe4);
  bowler.position.set(0.4, 0, BOWLER_Z - 2.2);
  scene.add(bowler);

  const bowlArmPivot = new THREE.Group(); // shoulder pivot -- rotate for the bowling action
  bowlArmPivot.position.set(0.2, 1.35, 0);
  bowler.add(bowlArmPivot);
  const bowlArm = makeArm(0x2f4b8f);
  bowlArm.position.set(0, -0.2, 0);
  bowlArmPivot.add(bowlArm);

  const bowlOtherArm = makeArm(0x2f4b8f);
  bowlOtherArm.position.set(-0.32, 1.16, 0);
  bowlOtherArm.rotation.z = 0.4;
  bowler.add(bowlOtherArm);

  // cap
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1f3266, roughness: 0.6 });
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
    capMat
  );
  cap.position.y = 1.7;
  cap.castShadow = true;
  bowler.add(cap);
  const capBrim = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14, 0, Math.PI), capMat);
  capBrim.rotation.set(-Math.PI / 2 + 0.35, 0, 0);
  capBrim.position.set(0, 1.62, 0.13);
  bowler.add(capBrim);

  // -- Batsman: fixed figure plus a pivoting shoulder group holding both arms + bat,
  // so the whole swing reads as one clear, visible motion rather than a thin prop moving alone
  const batsman = makeBody(0xb43b3b, 0xf1efe4);
  batsman.position.set(0.55, 0, BATSMAN_Z + 0.9);
  batsman.rotation.y = Math.PI;
  scene.add(batsman);

  const batPivot = new THREE.Group();
  batPivot.position.set(0, 1.35, 0.05);
  batsman.add(batPivot);

  const gearMat = new THREE.MeshStandardMaterial({ color: 0xf1efe4, roughness: 0.65 });

  const leftArm = makeArm(0xb43b3b);
  leftArm.position.set(-0.16, -0.2, 0.04);
  leftArm.rotation.set(-0.3, 0, 0.35);
  batPivot.add(leftArm);
  const leftGlove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), gearMat);
  leftGlove.position.set(0, -0.21, 0);
  leftGlove.castShadow = true;
  leftArm.add(leftGlove);

  const rightArm = makeArm(0xb43b3b);
  rightArm.position.set(0.08, -0.2, 0.1);
  rightArm.rotation.set(-0.3, 0, -0.15);
  batPivot.add(rightArm);
  const rightGlove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), gearMat);
  rightGlove.position.set(0, -0.21, 0);
  rightGlove.castShadow = true;
  rightArm.add(rightGlove);

  const bat = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.85, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xd9b878, roughness: 0.5 })
  );
  bat.position.set(-0.04, -0.75, 0.07);
  bat.castShadow = true;
  batPivot.add(bat);

  // helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.7),
    new THREE.MeshStandardMaterial({ color: 0x15213a, roughness: 0.35, metalness: 0.15 })
  );
  helmet.position.y = 1.68;
  helmet.castShadow = true;
  batsman.add(helmet);
  const helmetPeak = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 12, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x15213a, roughness: 0.35, side: THREE.DoubleSide })
  );
  helmetPeak.rotation.set(-Math.PI / 2 + 0.3, 0, 0);
  helmetPeak.position.set(0, 1.6, 0.14);
  batsman.add(helmetPeak);

  // leg pads (front of the shins)
  const leftPad = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.55, 8), gearMat);
  leftPad.position.set(-0.13, 0.3, 0.05);
  leftPad.castShadow = true;
  batsman.add(leftPad);
  const rightPad = leftPad.clone();
  rightPad.position.x = 0.13;
  batsman.add(rightPad);

  // ---- Ball -------------------------------------------------------------------
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 20, 20),
    new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: 0.4 })
  );
  ball.castShadow = true;
  scene.add(ball);

  // popping creases (white lines in front of each set of stumps)
  const creaseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [BATSMAN_Z + 1.22, BOWLER_Z - 1.22].forEach((z) => {
    const crease = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.04), creaseMat);
    crease.rotation.x = -Math.PI / 2;
    crease.position.set(0, 0.015, z);
    scene.add(crease);
  });

  // ---- Game state ---------------------------------------------------------------
  let runs = 0, wickets = 0, ballsBowled = 0;
  let resolved = true; // true between deliveries; false while a ball is live and un-resolved
  let ballVel = new THREE.Vector3();
  let hasSwungThisBall = false;
  let swingArmed = false;
  let swingAnimT = 0;
  let bowlArmT = 999; // large = idle; reset to 0 to play the bowling action
  let cameraShakeT = 0, cameraShakeMag = 0;
  let running = true;
  let paused = false;

  function resetBallToBowler() {
    ball.position.set((Math.random() - 0.5) * 0.4, 2.0, BOWLER_Z + 1.5);
  }
  resetBallToBowler();

  function startDelivery() {
    if (!running) return;
    resolved = false;
    hasSwungThisBall = false;
    bowlArmT = 0;
    const lineOffset = (Math.random() - 0.5) * 0.5; // line variation
    const pitchVariation = 4.8 + Math.random() * 2.4; // controls where/how high it comes up off the bounce
    resetBallToBowler();
    ballVel.set(
      (lineOffset - ball.position.x) / DELIVERY_TIME,
      pitchVariation,
      (BATSMAN_Z + 0.3 - ball.position.z) / DELIVERY_TIME
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
    if (!running || paused || resolved || hasSwungThisBall) return;
    hasSwungThisBall = true;
    swingArmed = true;
    swingAnimT = 0;
    updateHUD("Swing!"); // instant feedback that the key press was registered

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
    if (shotRuns >= 4) {
      cameraShakeT = 0.25;
      cameraShakeMag = shotRuns === 6 ? 0.14 : 0.08;
    }
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

    const proceed = () => {
      if (!running) return;
      if (paused) { setTimeout(proceed, 300); return; }
      if (oversDone || allOut) {
        running = false;
        onGameOver({ runs, wickets, balls: ballsBowled });
      } else {
        startDelivery();
      }
    };
    setTimeout(proceed, 1300);
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
    try {
      step();
    } catch (err) {
      cancelAnimationFrame(rafId);
      console.error("Cricket game crashed:", err);
      updateHUD(`Game error: ${err.message}`);
    }
  }

  function step() {
    const dt = Math.min(clock.getDelta(), 0.05);

    if (paused) {
      renderer.render(scene, camera);
      return;
    }

    // bowler tiny run-up bob
    bowler.position.y = Math.abs(Math.sin(clock.elapsedTime * 2)) * 0.02;

    // bowling arm action -- swings over the top once per delivery
    if (bowlArmT < BOWL_ANIM_DURATION) {
      bowlArmT += dt;
      const t = Math.min(bowlArmT / BOWL_ANIM_DURATION, 1);
      bowlArmPivot.rotation.x = 1.3 - t * 3.0;
    }

    // camera shake on a well-hit shot
    if (cameraShakeT > 0) {
      cameraShakeT -= dt;
      const s = cameraShakeMag * Math.max(cameraShakeT / 0.25, 0);
      camera.position.set(
        CAMERA_HOME.x + (Math.random() - 0.5) * s,
        CAMERA_HOME.y + (Math.random() - 0.5) * s,
        CAMERA_HOME.z + (Math.random() - 0.5) * s
      );
    } else if (!camera.position.equals(CAMERA_HOME)) {
      camera.position.copy(CAMERA_HOME);
    }

    // bat swing animation -- sweeps sideways (like a real cricket shot) so it reads
    // clearly as left-right motion from a camera behind the batsman, instead of
    // swinging toward/away from the camera where it would be barely visible
    if (swingArmed) {
      swingAnimT += dt;
      const t = Math.min(swingAnimT / 0.35, 1);
      batPivot.rotation.y = -Math.sin(t * Math.PI) * 2.2;
      batPivot.rotation.x = -Math.sin(t * Math.PI) * 0.5;
      if (t >= 1) swingArmed = false;
    } else {
      batPivot.rotation.y = 0;
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
      if (hasSwungThisBall && ball.position.z > 2.5) {
        finishDelivery("Dot ball");
      }
    }

    renderer.render(scene, camera);
  }

  resize();
  animate();
  startDelivery();

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      clock.getDelta(); // discard the elapsed pause time so physics don't jump on resume
    },
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

function makeBallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#a8121a";
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = "#f2e9d8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(256, 64);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let x = 3; x < 256; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, 58);
    ctx.lineTo(x, 70);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGrassTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  // mowing stripes
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#2d7a34" : "#297030";
    ctx.fillRect(0, i * 16, 128, 16);
  }
  // subtle noise for texture
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)";
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
