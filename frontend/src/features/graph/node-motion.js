function jellyRestPoints(radius, corner) {
  return Array.from({ length: 48 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 48;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const inner = radius - corner;
    let distance = radius;
    if (inner > 0) {
      if (ay * radius <= inner * ax) distance = radius / ax;
      else if (ax * radius <= inner * ay) distance = radius / ay;
      else
        distance =
          inner * (ax + ay) +
          Math.sqrt(corner * corner - inner * inner * (ax - ay) ** 2);
    }
    return { x: nx * distance, y: ny * distance, nx, ny };
  });
}

function jellyPath(points) {
  const count = points.length;
  const coordinate = (point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  let path = `M${coordinate(points[0])}`;
  for (let index = 0; index < count; index += 1) {
    const before = points[(index + count - 1) % count];
    const from = points[index];
    const to = points[(index + 1) % count];
    const after = points[(index + 2) % count];
    path += `C${coordinate({ x: from.x + (to.x - before.x) / 6, y: from.y + (to.y - before.y) / 6 })} ${coordinate({ x: to.x - (after.x - from.x) / 6, y: to.y - (after.y - from.y) / 6 })} ${coordinate(to)}`;
  }
  return `${path}Z`;
}

function createJellySkin(radius, corner) {
  const rest = jellyRestPoints(radius, corner);
  const count = rest.length;
  const displacement = new Float64Array(count);
  const velocity = new Float64Array(count);
  const force = new Float64Array(count);
  const area = (points) =>
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % count];
      return sum + point.x * next.y - point.y * next.x;
    }, 0);
  const restArea = area(rest);
  const restPath = jellyPath(rest);
  let active = false;
  return {
    press(nx, ny, strength) {
      for (let index = 0; index < count; index += 1) {
        const point = rest[index];
        const facing = point.nx * nx + point.ny * ny;
        const pressure = strength * 0.35 * Math.exp(8 * (facing - 1));
        displacement[index] = Math.max(-0.28, displacement[index] - pressure);
        velocity[index] = Math.max(-2, velocity[index] - pressure * 5);
      }
      active = true;
    },
    step(dt, drive) {
      for (let index = 0; index < count; index += 1) {
        const point = rest[index];
        const neighbors =
          displacement[(index + count - 1) % count] +
          displacement[(index + 1) % count] -
          2 * displacement[index];
        let input = 0;
        if (drive) {
          const facing = point.nx * drive.ux + point.ny * drive.uy;
          const gripFacing = point.nx * drive.gripX + point.ny * drive.gripY;
          const localPull = Math.exp(7 * (gripFacing - 1));
          const inertia = Math.max(
            -1,
            Math.min(1, (point.nx * drive.ax + point.ny * drive.ay) / 12000),
          );
          input =
            drive.strength * (0.6 * localPull - 0.08 - 0.12 * facing) -
            0.16 * inertia;
        }
        force[index] =
          140 * (input - displacement[index]) +
          1100 * neighbors -
          6 * velocity[index];
      }
      let energy = 0;
      for (let index = 0; index < count; index += 1) {
        velocity[index] += force[index] * dt;
        displacement[index] += velocity[index] * dt;
        if (Math.abs(displacement[index]) > 0.36) {
          displacement[index] = Math.sign(displacement[index]) * 0.36;
          velocity[index] = 0;
        }
        energy = Math.max(
          energy,
          Math.abs(displacement[index]),
          Math.abs(velocity[index]),
        );
      }
      active = energy > 0.00015;
      if (!active && !drive) {
        displacement.fill(0);
        velocity.fill(0);
      }
      return active;
    },
    path(phase) {
      if (!active && phase === undefined) return restPath;
      const points = rest.map((point, index) => {
        const angle = (index * Math.PI * 2) / count;
        const ripple =
          phase === undefined
            ? 0
            : 0.055 * Math.cos(2 * angle) * Math.sin(phase) +
              0.028 *
                Math.sin(3 * angle + phase * 0.65) *
                Math.cos(phase * 0.83);
        const offset = (displacement[index] + ripple) * radius;
        return {
          x: point.x + point.nx * offset,
          y: point.y + point.ny * offset,
        };
      });
      const centerX = points.reduce((sum, point) => sum + point.x, 0) / count;
      const centerY = points.reduce((sum, point) => sum + point.y, 0) / count;
      const scale = Math.sqrt(restArea / area(points));
      return jellyPath(
        points.map((point) => ({
          x: (point.x - centerX) * scale,
          y: (point.y - centerY) * scale,
        })),
      );
    },
  };
}

function createElasticNodes({
  graph,
  getPosition,
  setPosition,
  updateGeometry,
  worldPoint,
  beginDrag,
  endDrag,
}) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const listeners = new AbortController();
  const poses = new Map();
  let drag = null;
  let frame = 0;
  let lastTime = 0;
  let geometryDirty = false;
  let suppressClickUntil = 0;
  let lastPaint = 0;
  let activeMotion = false;
  let destroyed = false;
  const enabled = () =>
    !reducedMotion.matches && document.documentElement.dataset.motion !== "off";

  function poseFor(id) {
    if (!poses.has(id) || !poses.get(id).body.isConnected) {
      const body = graph.querySelector(`[data-node="${id}"] .node-body`);
      poses.set(id, {
        body,
        material: body.closest(".node-material"),
        phase:
          ((Array.from(id).reduce(
            (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
            7,
          ) *
            0.61803398875) %
            1) *
          Math.PI *
          2,
        strain: 0,
        shear: 0,
        lagX: 0,
        lagY: 0,
        hover: 0,
        vstrain: 0,
        vshear: 0,
        vlagX: 0,
        vlagY: 0,
        vhover: 0,
        targetstrain: 0,
        targetshear: 0,
        targetlagX: 0,
        targetlagY: 0,
        targethover: 0,
        gripX: 0,
        gripY: 0,
        skin: createJellySkin(
          Number(body.dataset.radius),
          Number(body.dataset.corner),
        ),
      });
    }
    return poses.get(id);
  }

  function applyPose(id, pose, time = performance.now()) {
    const material = pose.material;
    if (!material.isConnected) return;
    pose.body.setAttribute(
      "d",
      pose.skin.path(enabled() ? time / 800 + pose.phase : undefined),
    );
    const magnitude = Math.hypot(pose.strain, pose.shear);
    const bounded = Math.min(0.3, magnitude);
    const factor = magnitude > 0.00001 ? Math.sinh(bounded) / magnitude : 1;
    const base = Math.cosh(bounded);
    const a = (base + factor * pose.strain) * (1 + pose.hover);
    const b = factor * pose.shear * (1 + pose.hover);
    const d = (base - factor * pose.strain) * (1 + pose.hover);
    const x = pose.gripX * (1 - a) - pose.gripY * b + pose.lagX;
    const y = pose.gripY * (1 - d) - pose.gripX * b + pose.lagY;
    material.setAttribute(
      "transform",
      !enabled()
        ? "scale(1 1)"
        : `matrix(${a.toFixed(5)} ${b.toFixed(5)} ${b.toFixed(5)} ${d.toFixed(5)} ${x.toFixed(3)} ${y.toFixed(3)})`,
    );
  }

  function schedule() {
    if (!frame && !document.hidden && !destroyed && enabled())
      frame = requestAnimationFrame(tick);
  }

  function hover(id, value) {
    if (!enabled()) return;
    poseFor(id).targethover = value;
    schedule();
  }

  function tick(time) {
    frame = 0;
    if (!activeMotion && time - lastPaint < 1000 / 30) {
      schedule();
      return;
    }
    lastPaint = time;
    const elapsed = lastTime
      ? Math.min((time - lastTime) / 1000, 0.032)
      : 1 / 60;
    lastTime = time;
    const steps = Math.max(1, Math.ceil(elapsed / (1 / 120)));
    const dt = elapsed / steps;
    let moving = false;
    for (const [id, pose] of poses) {
      if (!pose.body.isConnected) {
        poses.delete(id);
        continue;
      }
      let drive = null;
      if (drag?.id === id && drag.moved) {
        const decay = Math.exp(
          -Math.max(0, time - drag.previousTime - 35) / 75,
        );
        const vx = drag.velocityX * decay;
        const vy = drag.velocityY * decay;
        const speed = Math.hypot(vx, vy);
        const ux = speed > 0.001 ? vx / speed : 0;
        const uy = speed > 0.001 ? vy / speed : 0;
        const grip = (pose.gripX * ux + pose.gripY * uy) / drag.radius;
        const stretch = Math.min(0.23, speed / 2200) * (1 + 0.2 * grip);
        pose.targetstrain = stretch * (ux * ux - uy * uy);
        pose.targetshear = stretch * 2 * ux * uy;
        const lag = Math.min(drag.radius * 0.22, speed * 0.012);
        pose.targetlagX = -ux * lag;
        pose.targetlagY = -uy * lag;
        const gripLength = Math.hypot(pose.gripX, pose.gripY);
        if (speed > 0.1)
          drive = {
            ux,
            uy,
            strength: Math.min(1, speed / 320),
            gripX: gripLength > 2 ? pose.gripX / gripLength : ux,
            gripY: gripLength > 2 ? pose.gripY / gripLength : uy,
            ax: drag.accelerationX * decay,
            ay: drag.accelerationY * decay,
          };
        if (speed > 0.1) moving = true;
      }
      let energy = 0;
      for (let step = 0; step < steps; step += 1) {
        if (pose.skin.step(dt, drive)) moving = true;
        for (const value of ["strain", "shear", "lagX", "lagY", "hover"]) {
          const velocity = `v${value}`;
          const goal = `target${value}`;
          pose[velocity] +=
            ((pose[goal] - pose[value]) * 280 - pose[velocity] * 17) * dt;
          pose[value] += pose[velocity] * dt;
        }
      }
      for (const value of ["strain", "shear", "lagX", "lagY", "hover"]) {
        energy +=
          Math.abs(pose[value] - pose[`target${value}`]) +
          Math.abs(pose[`v${value}`]);
      }
      if (energy < 0.001) {
        for (const value of ["strain", "shear", "lagX", "lagY", "hover"]) {
          pose[value] = pose[`target${value}`];
          pose[`v${value}`] = 0;
        }
      } else moving = true;
      applyPose(id, pose, time);
    }
    if (geometryDirty) {
      updateGeometry();
      geometryDirty = false;
    }
    activeMotion = moving;
    if (poses.size) schedule();
    else lastTime = 0;
  }

  function flushGeometry() {
    geometryDirty = true;
    if (!enabled()) {
      updateGeometry();
      geometryDirty = false;
    } else schedule();
  }

  function release(cancelled = false) {
    if (!drag) return;
    const current = drag;
    drag = null;
    if (cancelled) setPosition(current.id, current.origin);
    if (current.moved || cancelled)
      suppressClickUntil = performance.now() + 350;
    graph
      .querySelector(`[data-node="${current.id}"]`)
      ?.classList.remove("dragging");
    const pose = poseFor(current.id);
    for (const value of ["strain", "shear", "lagX", "lagY", "hover"])
      pose[`target${value}`] = 0;
    if (enabled()) schedule();
    updateGeometry();
    geometryDirty = false;
    endDrag(current.id, cancelled, current.moved);
    if (current.captureElement.hasPointerCapture(current.pointerId))
      current.captureElement.releasePointerCapture(current.pointerId);
  }

  graph.addEventListener(
    "pointerover",
    (event) => {
      const node = event.target.closest("[data-node]");
      if (
        node &&
        !node.contains(event.relatedTarget) &&
        !drag &&
        event.pointerType !== "touch"
      )
        hover(node.dataset.node, 0.04);
    },
    { signal: listeners.signal },
  );
  graph.addEventListener(
    "pointerout",
    (event) => {
      const node = event.target.closest("[data-node]");
      if (
        node &&
        !node.contains(event.relatedTarget) &&
        drag?.id !== node.dataset.node
      )
        hover(node.dataset.node, 0);
    },
    { signal: listeners.signal },
  );
  graph.addEventListener(
    "pointerdown",
    (event) => {
      const node = event.target.closest("[data-node]");
      if (!node || event.button !== 0 || drag) return;
      if (!beginDrag(node.dataset.node)) return;
      event.preventDefault();
      const point = worldPoint(event);
      const origin = { ...getPosition(node.dataset.node) };
      drag = {
        id: node.dataset.node,
        pointerId: event.pointerId,
        captureElement: node,
        origin,
        offsetX: origin.x - point.x,
        offsetY: origin.y - point.y,
        startX: event.clientX,
        startY: event.clientY,
        previousX: point.x,
        previousY: point.y,
        previousTime: performance.now(),
        moved: false,
        velocityX: 0,
        velocityY: 0,
        accelerationX: 0,
        accelerationY: 0,
        radius: node.querySelector(".node-hit").r.baseVal.value - 8,
      };
      const pose = poseFor(drag.id);
      const gripScale = Math.min(
        1,
        drag.radius / Math.max(1, Math.hypot(drag.offsetX, drag.offsetY)),
      );
      pose.gripX = -drag.offsetX * gripScale;
      pose.gripY = -drag.offsetY * gripScale;
      node.setPointerCapture(event.pointerId);
      hover(drag.id, 0);
    },
    { signal: listeners.signal },
  );
  graph.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const point = worldPoint(event);
      if (
        !drag.moved &&
        Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <=
          4
      )
        return;
      if (!drag.moved) {
        drag.moved = true;
        graph
          .querySelector(`[data-node="${drag.id}"]`)
          ?.classList.add("dragging");
      }
      const now = performance.now();
      const elapsed = Math.max(8, now - drag.previousTime);
      const blend = 1 - Math.exp(-elapsed / 35);
      const previousVelocityX = drag.velocityX;
      const previousVelocityY = drag.velocityY;
      drag.velocityX +=
        (((point.x - drag.previousX) * 1000) / elapsed - drag.velocityX) *
        blend;
      drag.velocityY +=
        (((point.y - drag.previousY) * 1000) / elapsed - drag.velocityY) *
        blend;
      drag.accelerationX = Math.max(
        -18000,
        Math.min(
          18000,
          ((drag.velocityX - previousVelocityX) * 1000) / elapsed,
        ),
      );
      drag.accelerationY = Math.max(
        -18000,
        Math.min(
          18000,
          ((drag.velocityY - previousVelocityY) * 1000) / elapsed,
        ),
      );
      setPosition(drag.id, {
        x: point.x + drag.offsetX,
        y: point.y + drag.offsetY,
      });
      Object.assign(drag, {
        previousX: point.x,
        previousY: point.y,
        previousTime: now,
      });
      flushGeometry();
    },
    { signal: listeners.signal },
  );
  graph.addEventListener(
    "pointerup",
    (event) => {
      if (drag?.pointerId === event.pointerId) release();
    },
    { signal: listeners.signal },
  );
  graph.addEventListener(
    "pointercancel",
    (event) => {
      if (drag?.pointerId === event.pointerId) release(true);
    },
    { signal: listeners.signal },
  );
  graph.addEventListener("lostpointercapture", () => release(true), {
    signal: listeners.signal,
  });
  graph.addEventListener("dragstart", (event) => event.preventDefault(), {
    signal: listeners.signal,
  });
  graph.addEventListener(
    "click",
    (event) => {
      if (event.detail && performance.now() < suppressClickUntil) {
        event.stopImmediatePropagation();
        event.preventDefault();
        suppressClickUntil = 0;
      }
    },
    { capture: true, signal: listeners.signal },
  );

  function reset() {
    release(true);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    lastPaint = 0;
    activeMotion = false;
    poses.clear();
    graph
      .querySelectorAll(".node-material")
      .forEach((material) => material.setAttribute("transform", "scale(1 1)"));
    graph
      .querySelectorAll(".node-body")
      .forEach((body) =>
        body.setAttribute(
          "d",
          jellyPath(
            jellyRestPoints(
              Number(body.dataset.radius),
              Number(body.dataset.corner),
            ),
          ),
        ),
      );
  }

  function discover() {
    if (!enabled() || document.hidden || destroyed) return;
    graph
      .querySelectorAll("[data-node]")
      .forEach((node) => poseFor(node.dataset.node));
    schedule();
  }
  function restart() {
    reset();
    discover();
  }
  const nodesObserver = new MutationObserver(discover);
  nodesObserver.observe(graph, { childList: true, subtree: true });
  const preferenceObserver = new MutationObserver(restart);
  preferenceObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-motion"],
  });
  reducedMotion.addEventListener("change", restart, {
    signal: listeners.signal,
  });
  document.addEventListener("visibilitychange", restart, {
    signal: listeners.signal,
  });
  window.addEventListener("blur", () => release(true), {
    signal: listeners.signal,
  });
  discover();
  return {
    cancelDrag: () => release(true),
    contact: (contacts) => {
      if (!enabled()) return;
      for (const { id, nx, ny, strength } of contacts) {
        if (!graph.querySelector(`[data-node="${id}"] .node-body`)) continue;
        const pose = poseFor(id);
        pose.skin.press(nx, ny, strength);
        applyPose(id, pose);
      }
      activeMotion = true;
      schedule();
    },
    takePose: (id) => {
      const pose = poses.get(id);
      poses.delete(id);
      const material = graph.querySelector(
        `[data-node="${id}"] .node-material`,
      );
      if (material) {
        material.setAttribute("transform", "scale(1 1)");
        const body = material.querySelector(".node-body");
        body.setAttribute(
          "d",
          jellyPath(
            jellyRestPoints(
              Number(body.dataset.radius),
              Number(body.dataset.corner),
            ),
          ),
        );
      }
      if (enabled()) poseFor(id);
      return pose;
    },
    adoptPose: (id, pose) => {
      if (!enabled()) return;
      const body = graph.querySelector(`[data-node="${id}"] .node-body`);
      if (!body) return;
      pose.body = body;
      pose.material = body.closest(".node-material");
      poses.set(id, pose);
      applyPose(id, pose);
      schedule();
    },
    destroy: () => {
      destroyed = true;
      nodesObserver.disconnect();
      preferenceObserver.disconnect();
      reset();
      listeners.abort();
    },
  };
}

export { jellyRestPoints, jellyPath, createElasticNodes };
