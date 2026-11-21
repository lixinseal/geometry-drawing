import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  CSS2DObject,
  CSS2DRenderer
} from "three/addons/renderers/CSS2DRenderer.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import {
  entityDisplayName,
  findEdge,
  findFace,
  findPoint,
  getEdgePositions,
  getFacePositions,
  toThreePoint
} from "./geometry";
import type {
  EdgeEntity,
  FaceEntity,
  GeometryEntity,
  MeasurementEntity,
  PointEntity,
  SceneState,
  Vec3
} from "./types";

interface PickTarget {
  entityId: string;
  entityKind: "point" | "edge" | "face";
  object: THREE.Object3D;
}

export interface SnapResult {
  entity: GeometryEntity;
  kind: "point" | "edge";
  position: Vec3;
  screen: { x: number; y: number };
}

export class GeometryScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 500);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer = new CSS2DRenderer();
  private readonly controls: OrbitControls;
  private readonly sceneRoot = new THREE.Group();
  private readonly snapRoot = new THREE.Group();
  private readonly pickTargets: PickTarget[] = [];
  private readonly lineMaterials: LineMaterial[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private currentScene: SceneState | null = null;
  private selectedIds = new Set<string>();
  private needsRender = true;
  private hasFitCamera = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene.background = new THREE.Color(0xf4f7f8);
    this.camera.position.set(8, 7, 12);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, coarsePointer ? 1.5 : 2)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.touchAction = "none";
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer.domElement.className = "label-layer";
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.inset = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    this.container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.enablePan = true;
    this.controls.panSpeed = 1.15;
    this.controls.screenSpacePanning = true;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: null as unknown as THREE.MOUSE
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    this.controls.target.set(0, 1.5, 0);
    this.renderer.domElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    this.controls.addEventListener("change", () => {
      this.needsRender = true;
    });

    const ambient = new THREE.AmbientLight(0xffffff, 1.25);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(8, 14, 7);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd9f3ef, 0.9);
    fill.position.set(-8, 4, -6);
    this.scene.add(fill);

    const grid = new THREE.GridHelper(24, 24, 0x9bacb4, 0xd9e1e5);
    grid.position.y = 0;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.65;
    this.scene.add(grid);
    this.scene.add(this.sceneRoot);
    this.scene.add(this.snapRoot);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.animate();
  }

  setScene(sceneData: SceneState, selectedIds: Set<string>, fit = false) {
    this.clearSnap();
    this.currentScene = sceneData;
    this.selectedIds = selectedIds;
    this.rebuild();
    if (fit || !this.hasFitCamera) {
      this.fitCamera();
      this.hasFitCamera = true;
    }
    this.needsRender = true;
  }

  renderSelection(sceneData: SceneState, selectedIds: Set<string>) {
    this.clearSnap();
    this.currentScene = sceneData;
    this.selectedIds = selectedIds;
    this.rebuild();
    this.needsRender = true;
  }

  fitCamera() {
    if (!this.currentScene) return;
    const visiblePoints = this.currentScene.points.filter(
      (item) => item.visible
    );
    if (!visiblePoints.length) return;
    const box = new THREE.Box3();
    visiblePoints.forEach((item) => {
      box.expandByPoint(this.toThree(item.pos));
    });
    if (box.isEmpty()) return;

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 1);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (radius / Math.sin(fov / 2)) * 1.18;
    const direction = new THREE.Vector3(1.15, 0.9, 1.4).normalize();

    this.controls.target.copy(sphere.center);
    this.camera.position
      .copy(sphere.center)
      .addScaledVector(direction, distance);
    this.camera.near = Math.max(0.03, distance / 100);
    this.camera.far = distance * 30;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.needsRender = true;
  }

  resetView() {
    this.controls.target.set(0, 1.5, 0);
    this.fitCamera();
  }

  cameraState() {
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray()
    };
  }

  panByPixels(deltaX: number, deltaY: number) {
    const height = Math.max(this.container.clientHeight, 1);
    const distance = this.camera.position.distanceTo(this.controls.target);
    const scale =
      (2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) /
      height;
    const right = new THREE.Vector3()
      .setFromMatrixColumn(this.camera.matrix, 0)
      .multiplyScalar(-deltaX * scale);
    const up = new THREE.Vector3()
      .setFromMatrixColumn(this.camera.matrix, 1)
      .multiplyScalar(deltaY * scale);
    const offset = right.add(up);
    this.camera.position.add(offset);
    this.controls.target.add(offset);
    this.controls.update();
    this.needsRender = true;
  }

  pick(clientX: number, clientY: number): GeometryEntity | null {
    if (!this.currentScene) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.params.Line = { threshold: 0.09 };

    const priority: Array<"point" | "edge"> = ["point", "edge"];
    for (const kind of priority) {
      const targets = this.pickTargets.filter(
        (target) => target.entityKind === kind
      );
      if (!targets.length) continue;
      const intersections = this.raycaster.intersectObjects(
        targets.map((target) => target.object),
        false
      );
      if (intersections.length) {
        const hit = intersections[0];
        const candidate = targets.find(
          (target) => target.object === hit.object
        );
        if (candidate) return this.entityById(candidate.entityId);
      }
    }

    const faceTargets = this.pickTargets.filter(
      (target) => target.entityKind === "face"
    );
    const auxiliaryTargets = faceTargets.filter((target) => {
      const face = this.currentScene
        ? findFace(this.currentScene, target.entityId)
        : null;
      return face?.auxiliary;
    });
    const baseTargets = faceTargets.filter(
      (target) => !auxiliaryTargets.includes(target)
    );
    for (const targets of [auxiliaryTargets, baseTargets]) {
      if (!targets.length) continue;
      const intersections = this.raycaster.intersectObjects(
        targets.map((target) => target.object),
        false
      );
      if (intersections.length) {
        const hit = intersections[0];
        const candidate = targets.find(
          (target) => target.object === hit.object
        );
        if (candidate) return this.entityById(candidate.entityId);
      }
    }
    return null;
  }

  hover(clientX: number, clientY: number): GeometryEntity | null {
    return this.pick(clientX, clientY);
  }

  snapAt(clientX: number, clientY: number): SnapResult | null {
    if (!this.currentScene) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    let bestPoint: SnapResult | null = null;
    let pointDistance = 22;
    for (const item of this.currentScene.points) {
      if (!item.visible || item.internal || !item.label) continue;
      const screen = this.projectToScreen(this.toThree(item.pos));
      const currentDistance = Math.hypot(
        localX - screen.x,
        localY - screen.y
      );
      if (currentDistance < pointDistance) {
        pointDistance = currentDistance;
        bestPoint = {
          entity: item,
          kind: "point",
          position: item.pos,
          screen
        };
      }
    }
    if (bestPoint) return bestPoint;

    let bestEdge: SnapResult | null = null;
    let edgeDistance = 14;
    for (const item of this.currentScene.edges) {
      if (!item.visible) continue;
      const positions = getEdgePositions(this.currentScene, item);
      if (!positions) continue;
      const start3 = this.toThree(positions[0]);
      const end3 = this.toThree(positions[1]);
      const start = this.projectToScreen(start3);
      const end = this.projectToScreen(end3);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const denominator = dx * dx + dy * dy;
      if (denominator < 1e-8) continue;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((localX - start.x) * dx + (localY - start.y) * dy) / denominator
        )
      );
      const projected = {
        x: start.x + dx * t,
        y: start.y + dy * t
      };
      const currentDistance = Math.hypot(
        localX - projected.x,
        localY - projected.y
      );
      if (currentDistance < edgeDistance) {
        edgeDistance = currentDistance;
        bestEdge = {
          entity: item,
          kind: "edge",
          position: this.fromThree(start3.clone().lerp(end3, t)),
          screen: projected
        };
      }
    }
    return bestEdge;
  }

  showSnap(snap: SnapResult | null) {
    this.clearSnap();
    if (!snap) return;
    const span = this.modelSpan();
    const world = this.toThree(snap.position);

    if (snap.kind === "edge") {
      const edge = findEdge(this.currentScene!, snap.entity.id);
      if (edge) {
        const positions = getEdgePositions(this.currentScene!, edge);
        if (positions) {
          const [start, end] = positions.map((position) =>
            this.toThree(position)
          );
          const geometry = new LineGeometry();
          geometry.setPositions([
            start.x,
            start.y,
            start.z,
            end.x,
            end.y,
            end.z
          ]);
          const material = new LineMaterial({
            color: 0xe8742d,
            linewidth: 4.5,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            alphaToCoverage: true
          });
          material.resolution.set(
            this.container.clientWidth,
            this.container.clientHeight
          );
          const line = new Line2(geometry, material);
          line.renderOrder = 30;
          this.snapRoot.add(line);
        }
      }
    }

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(span * 0.032, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xe8742d,
        transparent: true,
        opacity: snap.kind === "point" ? 0.24 : 0.72,
        depthTest: false
      })
    );
    halo.position.copy(world);
    halo.renderOrder = 31;
    this.snapRoot.add(halo);
    this.needsRender = true;
  }

  clearSnap() {
    this.snapRoot.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose();
        const material = child.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      }
    });
    this.snapRoot.clear();
    this.needsRender = true;
  }

  placementPoint(clientX: number, clientY: number) {
    if (!this.currentScene) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    let nearestEdge: { point: THREE.Vector3; distance: number } | null = null;
    const edgeTargets = this.pickTargets.filter(
      (target) => target.entityKind === "edge"
    );
    for (const target of edgeTargets) {
      const edgeEntity = findEdge(this.currentScene!, target.entityId);
      if (!edgeEntity) continue;
      const positions = getEdgePositions(this.currentScene!, edgeEntity);
      if (!positions) continue;
      const start = this.toThree(positions[0]);
      const end = this.toThree(positions[1]);
      const pointOnRay = new THREE.Vector3();
      const pointOnSegment = new THREE.Vector3();
      const distanceSq = this.raycaster.ray.distanceSqToSegment(
        start,
        end,
        pointOnRay,
        pointOnSegment
      );
      if (!Number.isFinite(distanceSq)) continue;
      const distance = Math.sqrt(distanceSq);
      if (distance > this.modelSpan() * 0.025) continue;
      if (!nearestEdge || distance < nearestEdge.distance) {
        nearestEdge = {
          point: pointOnSegment.clone(),
          distance
        };
      }
    }
    if (nearestEdge) {
      return {
        kind: "edge" as const,
        position: this.fromThree(nearestEdge.point)
      };
    }

    const faceTargets = this.pickTargets.filter(
      (target) => target.entityKind === "face"
    );
    const faceHit = this.raycaster.intersectObjects(
      faceTargets.map((target) => target.object),
      false
    )[0];
    if (faceHit) {
      return {
        kind: "face" as const,
        position: this.fromThree(faceHit.point)
      };
    }

    const basePoint = new THREE.Vector3();
    const basePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (this.raycaster.ray.intersectPlane(basePlane, basePoint)) {
      return {
        kind: "base" as const,
        position: this.fromThree(basePoint)
      };
    }
    return null;
  }

  private projectToScreen(world: THREE.Vector3) {
    const projected = world.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((1 - projected.y) / 2) * rect.height
    };
  }

  screenPositionForEntity(id: string) {
    if (!this.currentScene) return null;
    const entity = this.entityById(id);
    if (!entity) return null;
    let world: THREE.Vector3 | null = null;

    if (entity.kind === "point") {
      world = this.toThree(entity.pos);
    } else if (entity.kind === "edge") {
      const positions = getEdgePositions(this.currentScene, entity);
      if (positions) {
        world = this.toThree(positions[0]).add(this.toThree(positions[1]));
        world.multiplyScalar(0.5);
      }
    } else {
      const positions = getFacePositions(this.currentScene, entity);
      if (positions.length) {
        world = positions
          .map((position) => this.toThree(position))
          .reduce((sum, position) => sum.add(position), new THREE.Vector3())
          .multiplyScalar(1 / positions.length);
      }
    }

    if (!world) return null;
    const local = this.projectToScreen(world);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + local.x,
      y: rect.top + local.y
    };
  }

  exportPng() {
    this.renderFrame(true);
    return this.renderer.domElement.toDataURL("image/png");
  }

  private entityById(id: string): GeometryEntity | null {
    if (!this.currentScene) return null;
    return (
      findPoint(this.currentScene, id) ||
      findEdge(this.currentScene, id) ||
      findFace(this.currentScene, id) ||
      null
    );
  }

  private toThree(value: Vec3) {
    return new THREE.Vector3(...toThreePoint(value));
  }

  private fromThree(value: THREE.Vector3): Vec3 {
    return [value.x, value.z, value.y];
  }

  private rebuild() {
    this.clearRoot();
    if (!this.currentScene) return;
    this.currentScene.faces
      .filter((item) => item.visible)
      .forEach((item) => this.buildFace(item));
    this.currentScene.edges
      .filter((item) => item.visible)
      .forEach((item) => this.buildEdge(item));
    this.currentScene.points
      .filter((item) => item.visible)
      .forEach((item) => this.buildPoint(item));
    (this.currentScene.measurements || [])
      .filter((item) => item.visible)
      .forEach((item) => this.buildMeasurement(item));
  }

  private clearRoot() {
    this.pickTargets.length = 0;
    this.lineMaterials.length = 0;
    this.sceneRoot.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose();
        const material = child.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      }
    });
    this.sceneRoot.clear();
  }

  private buildPoint(item: PointEntity) {
    if (!item.label) return;
    const sizeBase = this.modelSpan();
    const selected = this.selectedIds.has(item.id);
    const radiusFactor = item.base
      ? selected
        ? 0.02
        : 0.0125
      : selected
        ? 0.024
        : 0.017;
    const radius = sizeBase * radiusFactor;
    const geometry = new THREE.SphereGeometry(radius, 18, 18);
    const material = new THREE.MeshBasicMaterial({
      color: item.color
        ? new THREE.Color(item.color)
        : selected
          ? 0xe8742d
          : 0x263b45,
      depthTest: false
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(this.toThree(item.pos));
    sphere.renderOrder = 20;
    sphere.userData = { entityId: item.id, entityKind: "point" };
    this.sceneRoot.add(sphere);

    const hitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(sizeBase * 0.04, 12, 12),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false
      })
    );
    hitTarget.position.copy(sphere.position);
    hitTarget.userData = { entityId: item.id, entityKind: "point" };
    this.sceneRoot.add(hitTarget);
    this.pickTargets.push({
      entityId: item.id,
      entityKind: "point",
      object: hitTarget
    });

    const labelElement = document.createElement("div");
    labelElement.className = `entity-label${
      this.selectedIds.has(item.id) ? " selected" : ""
    }`;
    labelElement.textContent = item.label;
    const label = new CSS2DObject(labelElement);
    label.position.copy(sphere.position);
    label.position.y += Math.max(0.1, radius * 2.6);
    this.sceneRoot.add(label);
  }

  private buildEdge(item: EdgeEntity) {
    if (!this.currentScene) return;
    const positions = getEdgePositions(this.currentScene, item);
    if (!positions) return;
    const [a, b] = positions.map((value) => this.toThree(value));
    const geometry = new LineGeometry();
    geometry.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
    const selected = this.selectedIds.has(item.id);
    const material = new LineMaterial({
      color: new THREE.Color(
        item.color ||
          (selected ? "#e8742d" : item.auxiliary ? "#0f766e" : "#26343b")
      ),
      linewidth: selected ? 4 : item.auxiliary ? 2.3 : 1.8,
      dashed: item.dashed,
      dashSize: 0.16,
      gapSize: 0.1,
      alphaToCoverage: true
    });
    material.resolution.set(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.lineMaterials.push(material);
    const line = new Line2(geometry, material);
    if (item.dashed) line.computeLineDistances();
    line.renderOrder = selected ? 17 : 10;
    line.userData = { entityId: item.id, entityKind: "edge" };
    this.sceneRoot.add(line);
    this.pickTargets.push({
      entityId: item.id,
      entityKind: "edge",
      object: line
    });
  }

  private buildMeasurement(item: MeasurementEntity) {
    if (!this.currentScene || item.points.length < 2) return;
    const points = item.points
      .map((id) => findPoint(this.currentScene!, id)?.pos)
      .filter((value): value is Vec3 => Boolean(value));
    if (points.length !== item.points.length) return;
    const span = this.modelSpan();
    let position: THREE.Vector3;

    if (item.type === "length") {
      position = this.toThree(points[0])
        .add(this.toThree(points[1]))
        .multiplyScalar(0.5);
      position.y += span * 0.05;
    } else {
      const vertex = this.toThree(points[0]);
      const first = this.toThree(points[1]).sub(vertex).normalize();
      const second = this.toThree(points[2]).sub(vertex).normalize();
      const bisector = first.add(second);
      if (bisector.lengthSq() < 1e-8) {
        bisector.set(0, 1, 0);
      } else {
        bisector.normalize();
      }
      position = vertex
        .clone()
        .addScaledVector(bisector, span * 0.16)
        .add(new THREE.Vector3(0, span * 0.04, 0));
    }

    const element = document.createElement("div");
    element.className = "measurement-label";
    element.textContent = item.label;
    element.style.color = item.color;
    const label = new CSS2DObject(element);
    label.position.copy(position);
    this.sceneRoot.add(label);
  }

  private buildFace(item: FaceEntity) {
    if (!this.currentScene) return;
    const positions = getFacePositions(this.currentScene, item);
    if (positions.length < 3) return;
    const vertices = positions.map((value) => this.toThree(value));
    const trianglePoints: number[] = [];
    for (let index = 1; index < vertices.length - 1; index += 1) {
      trianglePoints.push(
        vertices[0].x,
        vertices[0].y,
        vertices[0].z,
        vertices[index].x,
        vertices[index].y,
        vertices[index].z,
        vertices[index + 1].x,
        vertices[index + 1].y,
        vertices[index + 1].z
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(trianglePoints, 3)
    );
    geometry.computeVertexNormals();

    const selected = this.selectedIds.has(item.id);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(
        item.color ||
          (selected ? "#f59e0b" : item.auxiliary ? "#f59e0b" : "#8ca5af")
      ),
      transparent: true,
      opacity: selected ? 0.34 : item.auxiliary ? 0.2 : 0.075,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = item.auxiliary ? 12 : 2;
    mesh.userData = { entityId: item.id, entityKind: "face" };
    this.sceneRoot.add(mesh);
    this.pickTargets.push({
      entityId: item.id,
      entityKind: "face",
      object: mesh
    });

    if (item.auxiliary) {
      const center = vertices
        .reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3())
        .multiplyScalar(1 / vertices.length);
      const labelElement = document.createElement("div");
      labelElement.className = `entity-label face-label${
        selected ? " selected" : ""
      }`;
      labelElement.textContent =
        item.label || `平面 ${item.id.replace(/^F_/, "")}`;
      const label = new CSS2DObject(labelElement);
      label.position.copy(center);
      this.sceneRoot.add(label);
    }
  }

  private modelSpan() {
    if (!this.currentScene?.points.length) return 4;
    const box = new THREE.Box3();
    this.currentScene.points.forEach((item) => {
      box.expandByPoint(this.toThree(item.pos));
    });
    const size = box.getSize(new THREE.Vector3());
    return Math.max(size.x, size.y, size.z, 2);
  }

  private resize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
    this.lineMaterials.forEach((material) =>
      material.resolution.set(width, height)
    );
    this.needsRender = true;
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    const changed = this.controls.update();
    if (changed || this.needsRender) this.renderFrame();
  }

  private renderFrame(force = false) {
    if (!force && !this.needsRender) return;
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    this.needsRender = false;
  }
}
