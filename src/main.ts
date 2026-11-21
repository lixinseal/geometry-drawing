import "./style.css";
import {
  Angle,
  Box,
  Check,
  CirclePlus,
  CircleDot,
  CornerDownRight,
  Crosshair,
  Equal,
  Eye,
  EyeOff,
  FolderOpen,
  ImageDown,
  Minus,
  MoveRight,
  MousePointer2,
  MousePointerClick,
  Plus,
  Redo2,
  Ruler,
  RotateCcw,
  Rotate3D,
  Save,
  Shapes,
  Split,
  Trash2,
  Triangle,
  Undo2,
  createIcons
} from "lucide";
import {
  SHAPES,
  angleDegrees,
  arePointsCoplanar,
  buildSolid,
  cloneScene,
  distance,
  entityDisplayName,
  faceNormal,
  findEdge,
  findFace,
  findPoint,
  getEdgePositions,
  getFacePositions,
  intersectSegmentPlane,
  makeAuxEdge,
  makeAuxFace,
  makeAuxPoint,
  orderCoplanarIds,
  projectPointToLine,
  removeEntityCascade,
  validateSceneData
} from "./geometry";
import { GeometryScene, type SnapResult } from "./scene";
import type {
  EdgeEntity,
  FaceEntity,
  GeometryEntity,
  MeasurementEntity,
  PointEntity,
  SceneState,
  ShapeKind,
  ToolKind,
  Vec3
} from "./types";

const ICONS = {
  Angle,
  Box,
  Check,
  CirclePlus,
  CircleDot,
  CornerDownRight,
  Crosshair,
  Equal,
  Eye,
  EyeOff,
  FolderOpen,
  ImageDown,
  Minus,
  MoveRight,
  MousePointer2,
  MousePointerClick,
  Plus,
  Redo2,
  Ruler,
  RotateCcw,
  Rotate3D,
  Save,
  Shapes,
  Split,
  Trash2,
  Triangle,
  Undo2
};

const TOOL_LABELS: Record<ToolKind, string> = {
  select: "选择",
  point: "点",
  line: "连线",
  extend: "延长线",
  midpoint: "中点",
  "measure-length": "长度测量",
  "measure-angle": "角度测量",
  "measure-edge-angle": "两边角测量",
  perpendicular: "垂线",
  parallel: "平行",
  plane: "平面",
  intersection: "交点",
  delete: "删除"
};

const TOOL_INSTRUCTIONS: Record<ToolKind, string> = {
  select: "点击点、棱或面查看对象信息",
  point: "点击面、棱或空白基准面添加任意点",
  line: "依次点击两个点创建辅助线段",
  extend: "点击一条棱或辅助线段，再选择延长方向和长度",
  midpoint: "依次点击两个点，生成它们的中点",
  "measure-length": "依次点击两个点，计算它们之间的空间距离",
  "measure-angle": "依次点击：第一条边上的点 → 顶点 → 第二条边上的点",
  "measure-edge-angle": "先点击顶点，再点击两条经过该顶点的棱",
  perpendicular: "先点击一个点，再点击一条棱",
  parallel: "先点击一个点，再点击一条棱",
  plane: "依次点击三个不共线的点",
  intersection: "先点击线段，再点击一个平面",
  delete: "点击一个辅助点、辅助线或辅助面删除"
};

const STORAGE_KEY = "geometry-drawing-offline-v1";
const CONSTRUCTION_COLORS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#dc2626",
  "#c75b20",
  "#15803d",
  "#475569"
];
const icon = (name: string) =>
  `<i data-lucide="${name}" aria-hidden="true"></i>`;

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

function refreshIcons() {
  createIcons({ icons: ICONS });
}

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits)).toString();
}

function formatPoint(value: [number, number, number]) {
  return `(${value.map((item) => round(item)).join(", ")})`;
}

function faceArea(scene: SceneState, face: FaceEntity) {
  const points = getFacePositions(scene, face);
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[index][0] - points[0][0];
    const b = points[index][1] - points[0][1];
    const c = points[index][2] - points[0][2];
    const d = points[index + 1][0] - points[0][0];
    const e = points[index + 1][1] - points[0][1];
    const f = points[index + 1][2] - points[0][2];
    const crossX = b * f - c * e;
    const crossY = c * d - a * f;
    const crossZ = a * e - b * d;
    area += Math.hypot(crossX, crossY, crossZ) / 2;
  }
  return area;
}

class GeometryApp {
  private readonly viewport = mustElement<HTMLDivElement>("viewport");
  private readonly shapeSelect =
    mustElement<HTMLSelectElement>("shape-select");
  private readonly parameterFields =
    mustElement<HTMLDivElement>("parameter-fields");
  private readonly shapeMessage =
    mustElement<HTMLParagraphElement>("shape-message");
  private readonly pointMode =
    mustElement<HTMLSelectElement>("point-mode");
  private readonly pointEdgeSelect =
    mustElement<HTMLSelectElement>("point-edge-select");
  private readonly pointAnchorSelect =
    mustElement<HTMLSelectElement>("point-anchor-select");
  private readonly pointDistance =
    mustElement<HTMLInputElement>("point-distance");
  private readonly pointDistanceHint =
    mustElement<HTMLParagraphElement>("point-distance-hint");
  private readonly edgePointFields =
    mustElement<HTMLDivElement>("edge-point-fields");
  private readonly coordinatePointFields =
    mustElement<HTMLDivElement>("coordinate-point-fields");
  private readonly pointX = mustElement<HTMLInputElement>("point-x");
  private readonly pointY = mustElement<HTMLInputElement>("point-y");
  private readonly pointZ = mustElement<HTMLInputElement>("point-z");
  private readonly toolGrid = mustElement<HTMLDivElement>("tool-grid");
  private readonly measurementToolGrid =
    mustElement<HTMLDivElement>("measurement-tool-grid");
  private readonly finishPlaneButton =
    mustElement<HTMLButtonElement>("finish-plane-btn");
  private readonly extensionControls =
    mustElement<HTMLDivElement>("extension-controls");
  private readonly extensionSource =
    mustElement<HTMLElement>("extension-source");
  private readonly extensionEndpointA =
    mustElement<HTMLButtonElement>("extension-endpoint-a");
  private readonly extensionEndpointB =
    mustElement<HTMLButtonElement>("extension-endpoint-b");
  private readonly extensionLength =
    mustElement<HTMLInputElement>("extension-length");
  private readonly extensionHint =
    mustElement<HTMLParagraphElement>("extension-hint");
  private readonly createExtensionButton =
    mustElement<HTMLButtonElement>("create-extension-btn");
  private readonly objectList = mustElement<HTMLDivElement>("object-list");
  private readonly measurementList =
    mustElement<HTMLDivElement>("measurement-list");
  private readonly measurementCount =
    mustElement<HTMLSpanElement>("measurement-count");
  private readonly measurementProgress =
    mustElement<HTMLParagraphElement>("measurement-progress");
  private readonly selectionTitle =
    mustElement<HTMLHeadingElement>("selection-title");
  private readonly selectionDetails =
    mustElement<HTMLDListElement>("selection-details");
  private readonly colorEditor =
    mustElement<HTMLDivElement>("color-editor");
  private readonly colorSwatches =
    mustElement<HTMLDivElement>("color-swatches");
  private readonly colorPicker =
    mustElement<HTMLInputElement>("color-picker");
  private readonly colorValue =
    mustElement<HTMLElement>("color-value");
  private readonly toolStatus = mustElement<HTMLSpanElement>("tool-status");
  private readonly operationStatus =
    mustElement<HTMLSpanElement>("operation-status");
  private readonly sceneTitle = mustElement<HTMLDivElement>("scene-title");
  private readonly hoverChip = mustElement<HTMLDivElement>("hover-chip");
  private readonly undoButton = mustElement<HTMLButtonElement>("undo-btn");
  private readonly redoButton = mustElement<HTMLButtonElement>("redo-btn");
  private readonly renderer3d: GeometryScene;

  private sceneData: SceneState;
  private selectedIds = new Set<string>();
  private activeTool: ToolKind = "select";
  private toolPicks: GeometryEntity[] = [];
  private extensionEndpoint: "a" | "b" = "b";
  private history: SceneState[] = [];
  private future: SceneState[] = [];
  private pointerStart: { x: number; y: number } | null = null;
  private rightPanStart: { x: number; y: number; pointerId: number } | null =
    null;
  private hoverFrame = 0;

  constructor() {
    this.renderer3d = new GeometryScene(this.viewport);
    this.sceneData = this.loadInitialScene();
    this.syncFormToScene();
    this.bindEvents();
    this.refreshAll(true);
    this.operationStatus.textContent = TOOL_INSTRUCTIONS.select;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (coarsePointer) {
      mustElement<HTMLSpanElement>("interaction-tip").textContent =
        "单指旋转 · 双指平移缩放 · Pencil 点选构造";
    }
  }

  get sceneSnapshot() {
    return this.sceneData;
  }

  projectEntity(id: string) {
    return this.renderer3d.screenPositionForEntity(id);
  }

  pickAt(x: number, y: number) {
    const entity = this.renderer3d.pick(x, y);
    return entity
      ? { id: entity.id, kind: entity.kind, name: entityDisplayName(this.sceneData, entity) }
      : null;
  }

  snapAt(x: number, y: number) {
    const snap = this.renderer3d.snapAt(x, y);
    return snap
      ? {
          id: snap.entity.id,
          kind: snap.kind,
          name: entityDisplayName(this.sceneData, snap.entity),
          position: snap.position
        }
      : null;
  }

  cameraState() {
    return this.renderer3d.cameraState();
  }

  private loadInitialScene(): SceneState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (validateSceneData(parsed)) {
          parsed.measurements ??= [];
          return parsed;
        }
      }
    } catch {
      // Ignore an invalid autosave and start with a clean shape.
    }
    return buildSolid("cube", { edge: 4 });
  }

  private bindEvents() {
    this.shapeSelect.addEventListener("change", () => {
      this.populateParameterFields();
      this.shapeMessage.textContent = "";
      this.shapeMessage.classList.remove("error");
    });

    mustElement<HTMLButtonElement>("create-shape-btn").addEventListener(
      "click",
      () => this.createShape()
    );

    this.pointMode.addEventListener("change", () => {
      this.updatePointModeFields();
    });
    this.pointEdgeSelect.addEventListener("change", () => {
      this.refreshPointAnchorOptions(true);
    });
    mustElement<HTMLButtonElement>("create-exact-point-btn").addEventListener(
      "click",
      () => this.createExactPoint()
    );
    this.colorPicker.addEventListener("change", () => {
      this.applySelectedColor(this.colorPicker.value);
    });
    this.renderColorSwatches();

    const handleToolClick = (event: Event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-tool]"
      );
      if (!target) return;
      this.setTool(target.dataset.tool as ToolKind);
    };
    this.toolGrid.addEventListener("click", handleToolClick);
    this.measurementToolGrid.addEventListener("click", handleToolClick);
    this.finishPlaneButton.addEventListener("click", () => {
      if (this.activeTool === "plane" && this.toolPicks.length === 3) {
        this.finishConstruction();
      }
    });
    this.extensionEndpointA.addEventListener("click", () =>
      this.setExtensionEndpoint("a")
    );
    this.extensionEndpointB.addEventListener("click", () =>
      this.setExtensionEndpoint("b")
    );
    this.extensionLength.addEventListener("input", () =>
      this.updateExtensionPreview()
    );
    this.createExtensionButton.addEventListener("click", () =>
      this.createExtension()
    );

    this.viewport.addEventListener("pointerdown", (event) => {
      if (event.button === 2) {
        event.preventDefault();
        this.rightPanStart = {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId
        };
        this.viewport.setPointerCapture(event.pointerId);
        this.renderer3d.clearSnap();
        return;
      }
      if (event.button !== 0) return;
      this.pointerStart = { x: event.clientX, y: event.clientY };
    });

    this.viewport.addEventListener("pointerup", (event) => {
      if (event.button === 2) {
        if (this.rightPanStart?.pointerId === event.pointerId) {
          this.rightPanStart = null;
          this.viewport.releasePointerCapture(event.pointerId);
        }
        return;
      }
      if (!this.pointerStart || event.button !== 0) return;
      const moved = Math.hypot(
        event.clientX - this.pointerStart.x,
        event.clientY - this.pointerStart.y
      );
      this.pointerStart = null;
      if (moved > 6) return;
      const snap = this.renderer3d.snapAt(event.clientX, event.clientY);
      if (this.activeTool === "point") {
        this.addArbitraryPoint(event.clientX, event.clientY, snap);
        return;
      }
      const entity =
        snap?.entity ||
        this.renderer3d.pick(event.clientX, event.clientY);
      if (entity) this.handleEntityPick(entity);
    });

    this.viewport.addEventListener("pointermove", (event) => {
      if (this.rightPanStart && (event.buttons & 2) !== 0) {
        const deltaX = event.clientX - this.rightPanStart.x;
        const deltaY = event.clientY - this.rightPanStart.y;
        this.rightPanStart.x = event.clientX;
        this.rightPanStart.y = event.clientY;
        this.renderer3d.panByPixels(deltaX, deltaY);
        this.hoverChip.hidden = true;
        this.viewport.style.cursor = "grabbing";
        return;
      }
      cancelAnimationFrame(this.hoverFrame);
      this.hoverFrame = requestAnimationFrame(() => {
        const snap = this.renderer3d.snapAt(event.clientX, event.clientY);
        const entity =
          snap?.entity ||
          this.renderer3d.hover(event.clientX, event.clientY);
        this.renderer3d.showSnap(snap);
        if (!entity) {
          this.hoverChip.hidden = true;
          this.hoverChip.classList.remove("snap");
          this.viewport.style.cursor = "default";
          return;
        }
        const rect = this.viewport.getBoundingClientRect();
        this.hoverChip.hidden = false;
        this.hoverChip.classList.toggle("snap", Boolean(snap));
        this.hoverChip.textContent = `${
          snap ? "吸附 · " : ""
        }${entityDisplayName(this.sceneData, entity)}`;
        this.hoverChip.style.left = `${event.clientX - rect.left}px`;
        this.hoverChip.style.top = `${event.clientY - rect.top}px`;
        this.viewport.style.cursor =
          this.activeTool === "select" ? "pointer" : "crosshair";
      });
    });

    this.viewport.addEventListener("pointerleave", () => {
      this.hoverChip.hidden = true;
      this.hoverChip.classList.remove("snap");
      this.renderer3d.clearSnap();
      this.viewport.style.cursor = "default";
    });

    this.viewport.addEventListener("pointercancel", (event) => {
      if (this.rightPanStart?.pointerId === event.pointerId) {
        this.rightPanStart = null;
        this.viewport.style.cursor = "default";
      }
    });

    this.undoButton.addEventListener("click", () => this.undo());
    this.redoButton.addEventListener("click", () => this.redo());
    mustElement<HTMLButtonElement>("save-btn").addEventListener("click", () =>
      this.saveScene()
    );
    mustElement<HTMLButtonElement>("load-btn").addEventListener("click", () =>
      mustElement<HTMLInputElement>("file-input").click()
    );
    mustElement<HTMLInputElement>("file-input").addEventListener(
      "change",
      (event) => void this.loadScene(event)
    );
    mustElement<HTMLButtonElement>("export-btn").addEventListener("click", () =>
      this.exportPng()
    );
    mustElement<HTMLButtonElement>("reset-view-btn").addEventListener(
      "click",
      () => this.renderer3d.fitCamera()
    );

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) this.redo();
        else this.undo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        this.redo();
      } else if (event.key === "Escape") {
        this.clearToolPicks();
        this.operationStatus.textContent = TOOL_INSTRUCTIONS[this.activeTool];
      }
    });
  }

  private populateParameterFields() {
    const definition = SHAPES[this.shapeSelect.value as ShapeKind];
    this.parameterFields.textContent = "";
    definition.fields.forEach((field) => {
      const label = document.createElement("label");
      label.className = "field";
      const caption = document.createElement("span");
      caption.textContent = field.label;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0.1";
      input.step = "0.1";
      input.value = String(
        this.sceneData.shape === this.shapeSelect.value &&
          this.sceneData.params[field.key]
          ? this.sceneData.params[field.key]
          : field.defaultValue
      );
      input.dataset.param = field.key;
      input.setAttribute("inputmode", "decimal");
      label.append(caption, input);
      this.parameterFields.appendChild(label);
    });
  }

  private syncFormToScene() {
    this.shapeSelect.value = this.sceneData.shape;
    this.populateParameterFields();
  }

  private updatePointModeFields() {
    const edgeMode = this.pointMode.value === "edge";
    this.edgePointFields.hidden = !edgeMode;
    this.coordinatePointFields.hidden = edgeMode;
  }

  private renderColorSwatches() {
    this.colorSwatches.textContent = "";
    CONSTRUCTION_COLORS.forEach((color) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-swatch";
      button.dataset.color = color;
      button.title = color;
      button.setAttribute("aria-label", `设置颜色 ${color}`);
      button.style.backgroundColor = color;
      button.addEventListener("click", () => this.applySelectedColor(color));
      this.colorSwatches.appendChild(button);
    });
  }

  private editableColorEntity() {
    const selected = this.selectedEntities();
    if (selected.length !== 1) return null;
    const entity = selected[0];
    if (entity.kind === "point") return entity.base ? null : entity;
    return entity.auxiliary ? entity : null;
  }

  private refreshColorEditor() {
    const entity = this.editableColorEntity();
    if (!entity) {
      this.colorEditor.hidden = true;
      return;
    }
    const fallback =
      entity.kind === "face" ? "#d97706" : "#0f766e";
    const color = (entity.color || fallback).toLowerCase();
    this.colorEditor.hidden = false;
    this.colorPicker.value = color;
    this.colorValue.textContent = color;
    this.colorSwatches
      .querySelectorAll<HTMLButtonElement>(".color-swatch")
      .forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.color?.toLowerCase() === color
        );
      });
  }

  private applySelectedColor(color: string) {
    const entity = this.editableColorEntity();
    if (!entity || !/^#[0-9a-f]{6}$/i.test(color)) return;
    if (entity.color?.toLowerCase() === color.toLowerCase()) return;
    this.mutate(
      (draft) => {
        const target =
          draft.points.find((item) => item.id === entity.id) ||
          draft.edges.find((item) => item.id === entity.id) ||
          draft.faces.find((item) => item.id === entity.id);
        if (target) target.color = color;
      },
      `${entityDisplayName(this.sceneData, entity)}的颜色已更新`
    );
    this.refreshAll();
  }

  private refreshPointEditor() {
    const previousEdge = this.pointEdgeSelect.value;
    this.pointEdgeSelect.textContent = "";
    this.sceneData.edges.forEach((edge) => {
      const option = document.createElement("option");
      option.value = edge.id;
      option.textContent = entityDisplayName(this.sceneData, edge);
      this.pointEdgeSelect.appendChild(option);
    });

    if (
      previousEdge &&
      this.sceneData.edges.some((edge) => edge.id === previousEdge)
    ) {
      this.pointEdgeSelect.value = previousEdge;
    }
    this.refreshPointAnchorOptions(true);
    this.updatePointModeFields();
  }

  private refreshPointAnchorOptions(forceDistance: boolean) {
    const edge = findEdge(this.sceneData, this.pointEdgeSelect.value);
    const previousAnchor = this.pointAnchorSelect.value;
    this.pointAnchorSelect.textContent = "";
    if (!edge) {
      this.pointDistance.value = "";
      this.pointDistanceHint.textContent = "当前场景没有可用棱";
      return;
    }

    const start = findPoint(this.sceneData, edge.a);
    const end = findPoint(this.sceneData, edge.b);
    if (!start || !end) return;
    [start, end].forEach((point) => {
      const option = document.createElement("option");
      option.value = point.id;
      option.textContent = `点 ${point.label || point.id}`;
      this.pointAnchorSelect.appendChild(option);
    });
    if ([start.id, end.id].includes(previousAnchor)) {
      this.pointAnchorSelect.value = previousAnchor;
    }

    const edgeLength = distance(start.pos, end.pos);
    this.pointDistance.max = edgeLength.toFixed(6);
    this.pointDistanceHint.textContent = `可填 0 到 ${round(edgeLength)}`;
    const current = Number(this.pointDistance.value);
    if (
      forceDistance ||
      !Number.isFinite(current) ||
      current <= 0 ||
      current > edgeLength
    ) {
      this.pointDistance.value = (edgeLength / 2).toFixed(2);
    }
  }

  private createExactPoint() {
    if (this.pointMode.value === "coordinates") {
      const position: [number, number, number] = [
        Number(this.pointX.value),
        Number(this.pointY.value),
        Number(this.pointZ.value)
      ];
      if (position.some((value) => !Number.isFinite(value))) {
        this.showToolError("请输入有效的 x、y、z 坐标");
        return;
      }
      this.createPointWithConstraint(position, {
        type: "coordinates",
        x: position[0],
        y: position[1],
        z: position[2]
      });
      return;
    }

    const edge = findEdge(this.sceneData, this.pointEdgeSelect.value);
    const anchor = findPoint(
      this.sceneData,
      this.pointAnchorSelect.value
    );
    if (!edge || !anchor) {
      this.showToolError("请先选择一条棱和距离起点");
      return;
    }
    const edgePositions = getEdgePositions(this.sceneData, edge);
    if (!edgePositions) return;
    const otherId = edge.a === anchor.id ? edge.b : edge.a;
    const other = findPoint(this.sceneData, otherId);
    if (!other) return;

    const edgeLength = distance(edgePositions[0], edgePositions[1]);
    const amount = Number(this.pointDistance.value);
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > edgeLength + 1e-7
    ) {
      this.showToolError(`距离必须位于 0 到 ${round(edgeLength)} 之间`);
      return;
    }

    if (Math.abs(amount) < 1e-7) {
      this.selectedIds = new Set([anchor.id]);
      this.operationStatus.textContent = "距离为 0，已选择起点";
      this.refreshSelection();
      return;
    }
    if (Math.abs(amount - edgeLength) < 1e-7) {
      this.selectedIds = new Set([other.id]);
      this.operationStatus.textContent = "距离等于棱长，已选择另一端点";
      this.refreshSelection();
      return;
    }

    const direction = [
      other.pos[0] - anchor.pos[0],
      other.pos[1] - anchor.pos[1],
      other.pos[2] - anchor.pos[2]
    ] as [number, number, number];
    const factor = amount / edgeLength;
    const position: [number, number, number] = [
      anchor.pos[0] + direction[0] * factor,
      anchor.pos[1] + direction[1] * factor,
      anchor.pos[2] + direction[2] * factor
    ];
    this.createPointWithConstraint(
      position,
      {
        type: "edge-distance",
        edgeId: edge.id,
        anchorId: anchor.id,
        distance: amount
      },
      `在${entityDisplayName(this.sceneData, edge)} 上，距 ${anchor.label} ${round(amount)}`
    );
  }

  private createPointWithConstraint(
    position: [number, number, number],
    constraint: PointEntity["constraint"],
    message = `坐标 ${formatPoint(position)}`
  ) {
    const duplicate = this.sceneData.points.find(
      (point) => distance(point.pos, position) < 1e-6
    );
    if (duplicate) {
      this.selectedIds = new Set([duplicate.id]);
      this.operationStatus.textContent = "该位置已经存在点";
      this.refreshSelection();
      return;
    }

    let createdId = "";
    this.mutate(
      (draft) => {
        const created = makeAuxPoint(draft, position);
        created.constraint = constraint;
        createdId = created.id;
      },
      `已创建精确点：${message}`
    );
    this.selectedIds = new Set([createdId]);
    this.refreshAll();
  }

  private readParameters() {
    const params: Record<string, number> = {};
    this.parameterFields
      .querySelectorAll<HTMLInputElement>("input[data-param]")
      .forEach((input) => {
        params[input.dataset.param || ""] = Number(input.value);
      });
    return params;
  }

  private createShape() {
    try {
      const shape = this.shapeSelect.value as ShapeKind;
      const params = this.readParameters();
      const nextScene = buildSolid(shape, params);
      this.history.push(cloneScene(this.sceneData));
      this.future = [];
      this.sceneData = nextScene;
      this.selectedIds.clear();
      this.clearToolPicks(false);
      this.shapeMessage.textContent = `${SHAPES[shape].label}已生成`;
      this.shapeMessage.classList.remove("error");
      this.operationStatus.textContent = "基础几何体已重新生成";
      this.persist();
      this.refreshAll(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "参数无效";
      this.shapeMessage.textContent = message;
      this.shapeMessage.classList.add("error");
    }
  }

  private setTool(tool: ToolKind) {
    this.activeTool = tool;
    this.extensionEndpoint = "b";
    this.renderer3d.clearExtensionPreview();
    this.clearToolPicks(false);
    document
      .querySelectorAll<HTMLButtonElement>("[data-tool]")
      .forEach((button) =>
        button.classList.toggle("active", button.dataset.tool === tool)
      );
    this.toolStatus.textContent = `${TOOL_LABELS[tool]}工具`;
    this.operationStatus.textContent = TOOL_INSTRUCTIONS[tool];
    this.renderMeasurementProgress();
    this.updateFinishPlaneButton();
    this.renderer3d.clearSnap();
    this.renderer3d.renderSelection(this.sceneData, this.selectedIds);
  }

  private handleEntityPick(entity: GeometryEntity) {
    if (this.activeTool === "select") {
      this.selectedIds = new Set([entity.id]);
      this.refreshSelection();
      this.operationStatus.textContent = entityDisplayName(
        this.sceneData,
        entity
      );
      return;
    }

    if (this.activeTool === "delete") {
      if (!entity.auxiliary) {
        this.showToolError("基础体对象不能删除，请重新生成几何体");
        return;
      }
      this.mutate(
        (draft) => removeEntityCascade(draft, entity.id),
        `${entityDisplayName(this.sceneData, entity)}已删除`
      );
      this.selectedIds.clear();
      this.refreshAll();
      return;
    }

    if (this.activeTool === "extend") {
      if (entity.kind !== "edge") {
        this.showToolError("延长线工具需要选择棱或辅助线段");
        return;
      }
      this.selectExtensionEdge(entity);
      return;
    }

    const expectedKind = this.expectedKindForPick();
    if (entity.kind !== expectedKind) {
      const label =
        expectedKind === "point"
          ? "点"
          : expectedKind === "edge"
            ? "棱或线段"
            : "面";
      this.showToolError(`当前步骤需要选择${label}`);
      return;
    }

    this.toolPicks.push(entity);
    this.selectedIds = new Set(this.toolPicks.map((item) => item.id));
    this.renderMeasurementProgress();
    this.updateFinishPlaneButton();
    this.renderer3d.renderSelection(this.sceneData, this.selectedIds);
    this.refreshSelection();

    if (!this.hasEnoughPicks()) {
      this.operationStatus.textContent = this.nextPickInstruction();
      return;
    }

    this.finishConstruction();
  }

  private addArbitraryPoint(
    clientX: number,
    clientY: number,
    snap?: SnapResult | null
  ) {
    if (snap?.kind === "point") {
      this.selectedIds = new Set([snap.entity.id]);
      this.refreshSelection();
      this.operationStatus.textContent = "该位置已经存在点";
      return;
    }

    const placement =
      snap?.kind === "edge"
        ? { kind: snap.kind, position: snap.position }
        : this.renderer3d.placementPoint(clientX, clientY);
    if (!placement) {
      this.showToolError("无法确定落点，请点击几何体表面或空白基准面");
      return;
    }

    this.mutate(
      (draft) => {
        makeAuxPoint(draft, placement.position);
      },
      placement.kind === "face"
        ? "已在所选表面添加点"
        : placement.kind === "edge"
          ? "已在所选棱上添加点"
          : "已在水平基准面添加点"
    );
    const created = this.sceneData.points.at(-1);
    this.selectedIds = created ? new Set([created.id]) : new Set();
    this.refreshAll();
  }

  private expectedKindForPick(): "point" | "edge" | "face" {
    if (this.activeTool === "extend") return "edge";
    if (
      this.activeTool === "line" ||
      this.activeTool === "midpoint" ||
      this.activeTool === "measure-length" ||
      this.activeTool === "measure-angle" ||
      this.activeTool === "plane"
    ) {
      return "point";
    }
    if (
      this.activeTool === "perpendicular" ||
      this.activeTool === "parallel"
    ) {
      return this.toolPicks.length === 0 ? "point" : "edge";
    }
    if (this.activeTool === "measure-edge-angle") {
      return this.toolPicks.length === 0 ? "point" : "edge";
    }
    if (this.activeTool === "intersection") {
      return this.toolPicks.length === 0 ? "edge" : "face";
    }
    return "point";
  }

  private hasEnoughPicks() {
    return (
      (this.activeTool === "line" && this.toolPicks.length === 2) ||
      (this.activeTool === "midpoint" && this.toolPicks.length === 2) ||
      (this.activeTool === "measure-length" &&
        this.toolPicks.length === 2) ||
      (this.activeTool === "measure-angle" &&
        this.toolPicks.length === 3) ||
      (this.activeTool === "measure-edge-angle" &&
        this.toolPicks.length === 3) ||
      (this.activeTool === "perpendicular" && this.toolPicks.length === 2) ||
      (this.activeTool === "parallel" && this.toolPicks.length === 2) ||
      (this.activeTool === "plane" && this.toolPicks.length === 4) ||
      (this.activeTool === "intersection" && this.toolPicks.length === 2)
    );
  }

  private nextPickInstruction() {
    switch (this.activeTool) {
      case "perpendicular":
      case "parallel":
        return "已选择点，现在点击一条棱";
      case "intersection":
        return "已选择线段，现在点击一个平面";
      case "measure-length":
        return this.toolPicks.length === 0
          ? "请点击距离测量的第一个点"
          : "已选择第一个点，请点击第二个点";
      case "measure-angle":
        if (this.toolPicks.length === 0) {
          return "请点击第一条边上的点";
        }
        return this.toolPicks.length === 1
          ? "已选择第一条射线，请点击角的顶点"
          : "已选择顶点，请点击第二条边上的点";
      case "measure-edge-angle":
        if (this.toolPicks.length === 0) {
          return "请点击角的顶点";
        }
        return this.toolPicks.length === 1
          ? "已选择顶点，请点击第一条经过该顶点的棱"
          : "请点击第二条经过该顶点的棱";
      case "plane":
        if (this.toolPicks.length === 3) {
          return "已选择 3 个点，可点击第 4 个点，或点击“完成三点平面”";
        }
        return `已选择 ${this.toolPicks.length} 个点，还需要 ${
          3 - this.toolPicks.length
        } 个`;
      default:
        return "已选择第一个点，请选择第二个点";
    }
  }

  private extensionEdge(): EdgeEntity | null {
    const candidate = this.toolPicks[0];
    return this.activeTool === "extend" && candidate?.kind === "edge"
      ? candidate
      : null;
  }

  private selectExtensionEdge(edge: EdgeEntity) {
    const start = findPoint(this.sceneData, edge.a);
    const end = findPoint(this.sceneData, edge.b);
    if (!start || !end || distance(start.pos, end.pos) < 1e-7) {
      this.showToolError("所选线段长度无效，无法延长");
      return;
    }

    this.toolPicks = [edge];
    this.selectedIds = new Set([edge.id]);
    this.extensionEndpoint = "b";
    this.extensionSource.textContent = `${entityDisplayName(
      this.sceneData,
      edge
    )} · ${round(distance(start.pos, end.pos), 3)}`;
    this.extensionLength.value = round(distance(start.pos, end.pos), 3);
    this.extensionEndpointA.textContent = `从 ${start.label} 向外`;
    this.extensionEndpointB.textContent = `从 ${end.label} 向外`;
    this.renderExtensionControls();
    this.renderer3d.renderSelection(this.sceneData, this.selectedIds);
    this.refreshSelection();
    this.operationStatus.textContent =
      "已选择线段，请选择延长端点并输入延长长度";
  }

  private setExtensionEndpoint(endpoint: "a" | "b") {
    this.extensionEndpoint = endpoint;
    this.renderExtensionControls();
    const plan = this.extensionPlan();
    if (plan) {
      this.operationStatus.textContent = `将从点 ${plan.from.label} 向外延长`;
    }
  }

  private extensionPlan() {
    const edge = this.extensionEdge();
    if (!edge) return null;

    const endpointId =
      this.extensionEndpoint === "a" ? edge.a : edge.b;
    const otherId = this.extensionEndpoint === "a" ? edge.b : edge.a;
    const from = findPoint(this.sceneData, endpointId);
    const other = findPoint(this.sceneData, otherId);
    const amount = Number(this.extensionLength.value);
    if (!from || !other || !Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    const segmentLength = distance(from.pos, other.pos);
    if (segmentLength < 1e-7) return null;
    const ratio = amount / segmentLength;
    const position: Vec3 = [
      from.pos[0] + (from.pos[0] - other.pos[0]) * ratio,
      from.pos[1] + (from.pos[1] - other.pos[1]) * ratio,
      from.pos[2] + (from.pos[2] - other.pos[2]) * ratio
    ];
    return { edge, from, other, amount, position };
  }

  private renderExtensionControls() {
    const edge = this.extensionEdge();
    const active = this.activeTool === "extend" && Boolean(edge);
    this.extensionControls.hidden = !active;
    if (!edge || !active) {
      this.renderer3d.clearExtensionPreview();
      return;
    }

    this.extensionEndpointA.classList.toggle(
      "active",
      this.extensionEndpoint === "a"
    );
    this.extensionEndpointB.classList.toggle(
      "active",
      this.extensionEndpoint === "b"
    );
    this.extensionEndpointA.setAttribute(
      "aria-pressed",
      String(this.extensionEndpoint === "a")
    );
    this.extensionEndpointB.setAttribute(
      "aria-pressed",
      String(this.extensionEndpoint === "b")
    );
    this.updateExtensionPreview();
  }

  private updateExtensionPreview() {
    const plan = this.extensionPlan();
    if (!plan) {
      this.renderer3d.clearExtensionPreview();
      this.extensionHint.textContent = "请输入大于 0 的延长长度";
      this.extensionHint.classList.add("error");
      return;
    }

    this.extensionHint.classList.remove("error");
    this.extensionHint.textContent = `从点 ${plan.from.label} 向外延长 ${round(
      plan.amount,
      3
    )}，新线段将与原线段共线。`;
    this.renderer3d.setExtensionPreview(plan.from.pos, plan.position);
  }

  private createExtension() {
    const edge = this.extensionEdge();
    if (!edge) {
      this.showToolError("请先选择一条棱或辅助线段");
      return;
    }

    const plan = this.extensionPlan();
    if (!plan) {
      this.operationStatus.textContent = "请输入大于 0 的有效延长长度";
      this.extensionHint.textContent = "请输入大于 0 的延长长度";
      this.extensionHint.classList.add("error");
      return;
    }

    const existingPoint = this.sceneData.points.find(
      (item) => distance(item.pos, plan.position) < 1e-7
    );
    const existingEdge = existingPoint
      ? this.sceneData.edges.find(
          (item) =>
            (item.a === plan.from.id && item.b === existingPoint.id) ||
            (item.a === existingPoint.id && item.b === plan.from.id)
        )
      : null;
    if (existingEdge) {
      this.selectedIds = new Set([existingEdge.id]);
      this.operationStatus.textContent = "该位置已经存在相同的延长线";
      this.refreshSelection();
      return;
    }

    let createdEdgeId = "";
    const color = edge.color || "#0f766e";
    this.mutate(
      (draft) => {
        let endpoint = draft.points.find(
          (item) => distance(item.pos, plan.position) < 1e-7
        );
        if (!endpoint) {
          endpoint = makeAuxPoint(draft, plan.position);
          endpoint.color = color;
        }
        createdEdgeId = makeAuxEdge(draft, plan.from.id, endpoint.id, {
          dashed: true,
          color
        }).id;
      },
      `已从点 ${plan.from.label} 向外延长 ${round(plan.amount, 3)}`
    );

    this.selectedIds = new Set([createdEdgeId]);
    this.clearToolPicks(false);
    this.operationStatus.textContent = `已从点 ${plan.from.label} 向外延长 ${round(
      plan.amount,
      3
    )}`;
    this.refreshAll();
  }

  private finishConstruction() {
    const picks = this.toolPicks;
    let selectCreatedId: string | null = null;
    let switchToSelect = false;
    let completionMessage = "";
    if (this.activeTool === "line") {
      const [a, b] = picks as PointEntity[];
      const existing = this.sceneData.edges.find(
        (item) =>
          (item.a === a.id && item.b === b.id) ||
          (item.a === b.id && item.b === a.id)
      );
      if (existing) {
        this.selectedIds = new Set([existing.id]);
        this.showToolError("这两点之间已经有线段");
        return;
      }
      this.mutate(
        (draft) => {
          makeAuxEdge(draft, a.id, b.id);
        },
        `已连接 ${a.label} 与 ${b.label}`
      );
    } else if (this.activeTool === "midpoint") {
      const [a, b] = picks as PointEntity[];
      const position: [number, number, number] = [
        (a.pos[0] + b.pos[0]) / 2,
        (a.pos[1] + b.pos[1]) / 2,
        (a.pos[2] + b.pos[2]) / 2
      ];
      this.mutate(
        (draft) => {
          makeAuxPoint(draft, position);
        },
        `已生成 ${a.label}${b.label} 的中点`
      );
    } else if (this.activeTool === "measure-length") {
      const [a, b] = picks as PointEntity[];
      const value = distance(a.pos, b.pos);
      const label = `${a.label}${b.label} = ${round(value, 4)}`;
      this.mutate(
        (draft) => {
          draft.measurements ||= [];
          draft.measurements.push({
            kind: "measurement",
            id: `MS_${draft.nextId++}`,
            type: "length",
            points: [a.id, b.id],
            value,
            label,
            visible: true,
            color: "#7c3aed"
          });
        },
        `已测量 ${a.label}${b.label} = ${round(value, 4)}`
      );
    } else if (this.activeTool === "measure-angle") {
      const [a, vertex, b] = picks as PointEntity[];
      const value = angleDegrees(vertex.pos, a.pos, b.pos);
      if (value === null) {
        this.showToolError("两条边不能退化为零长度");
        return;
      }
      const label = `∠${a.label}${vertex.label}${b.label} = ${round(
        value,
        1
      )}°`;
      this.mutate(
        (draft) => {
          draft.measurements ||= [];
          draft.measurements.push({
            kind: "measurement",
            id: `MS_${draft.nextId++}`,
            type: "angle",
            points: [vertex.id, a.id, b.id],
            value,
            label,
            visible: true,
            color: "#c2410c"
          });
        },
        `已测量 ${label}`
      );
    } else if (this.activeTool === "measure-edge-angle") {
      const [vertex, firstEdge, secondEdge] = picks as [
        PointEntity,
        EdgeEntity,
        EdgeEntity
      ];
      if (firstEdge.id === secondEdge.id) {
        this.showToolError("请选择两条不同的棱");
        return;
      }
      if (
        firstEdge.a !== vertex.id &&
        firstEdge.b !== vertex.id
      ) {
        this.showToolError("第一条棱不经过所选顶点");
        return;
      }
      if (
        secondEdge.a !== vertex.id &&
        secondEdge.b !== vertex.id
      ) {
        this.showToolError("第二条棱不经过所选顶点");
        return;
      }
      const firstId =
        firstEdge.a === vertex.id ? firstEdge.b : firstEdge.a;
      const secondId =
        secondEdge.a === vertex.id ? secondEdge.b : secondEdge.a;
      const firstPoint = findPoint(this.sceneData, firstId);
      const secondPoint = findPoint(this.sceneData, secondId);
      if (!firstPoint || !secondPoint) {
        this.showToolError("无法确定两条棱的另一端点");
        return;
      }
      const value = angleDegrees(
        vertex.pos,
        firstPoint.pos,
        secondPoint.pos
      );
      if (value === null) {
        this.showToolError("两条棱不能退化为零长度");
        return;
      }
      const label = `∠${firstPoint.label}${vertex.label}${secondPoint.label} = ${round(
        value,
        1
      )}°`;
      this.mutate(
        (draft) => {
          draft.measurements ||= [];
          draft.measurements.push({
            kind: "measurement",
            id: `MS_${draft.nextId++}`,
            type: "angle",
            points: [vertex.id, firstPoint.id, secondPoint.id],
            value,
            label,
            visible: true,
            color: "#b45309"
          });
        },
        `已测量 ${label}`
      );
    } else if (this.activeTool === "perpendicular") {
      const [target, edgeEntity] = picks as [PointEntity, EdgeEntity];
      const edgePositions = getEdgePositions(this.sceneData, edgeEntity);
      if (!edgePositions) return;
      const foot = projectPointToLine(
        target.pos,
        edgePositions[0],
        edgePositions[1]
      );
      this.mutate(
        (draft) => {
          const footPoint = makeAuxPoint(draft, foot);
          makeAuxEdge(draft, target.id, footPoint.id, {
            dashed: true
          });
        },
        `已从点 ${target.label} 向所选棱作垂线`
      );
    } else if (this.activeTool === "parallel") {
      const [target, edgeEntity] = picks as [PointEntity, EdgeEntity];
      const edgePositions = getEdgePositions(this.sceneData, edgeEntity);
      if (!edgePositions) return;
      const direction = [
        edgePositions[1][0] - edgePositions[0][0],
        edgePositions[1][1] - edgePositions[0][1],
        edgePositions[1][2] - edgePositions[0][2]
      ] as [number, number, number];
      const edgeLength = distance(edgePositions[0], edgePositions[1]);
      const halfLength = Math.max(edgeLength * 0.68, 1);
      const p1 = target.pos;
      const p2: [number, number, number] = [
        target.pos[0] + direction[0] * (halfLength / edgeLength),
        target.pos[1] + direction[1] * (halfLength / edgeLength),
        target.pos[2] + direction[2] * (halfLength / edgeLength)
      ];
      this.mutate(
        (draft) => {
          const start = makeAuxPoint(draft, p1);
          start.label = "";
          start.internal = true;
          start.visible = false;
          const end = makeAuxPoint(draft, p2);
          end.label = "";
          end.internal = true;
          end.visible = false;
          makeAuxEdge(draft, start.id, end.id, {
            dashed: true
          });
        },
        `已过点 ${target.label} 作平行线`
      );
    } else if (this.activeTool === "plane") {
      const planePicks = picks as PointEntity[];
      if (!arePointsCoplanar(planePicks.map((point) => point.pos))) {
        this.showToolError("所选四点不共面，无法构造一个平面");
        return;
      }
      const selectedNames = planePicks.map((point) => point.label).join("、");
      const pointIds = planePicks.map((point) => point.id);
      this.mutate(
        (draft) => {
          const orderedIds =
            pointIds.length === 4
              ? orderCoplanarIds(draft, pointIds)
              : pointIds;
          selectCreatedId = makeAuxFace(draft, orderedIds).id;
          switchToSelect = true;
          completionMessage = `已通过 ${selectedNames} 建立平面`;
        },
        `已通过 ${selectedNames} 建立平面`
      );
    } else if (this.activeTool === "intersection") {
      const [edgeEntity, faceEntity] = picks as [EdgeEntity, FaceEntity];
      const linePoints = getEdgePositions(this.sceneData, edgeEntity);
      const normal = faceNormal(this.sceneData, faceEntity);
      const facePoints = getFacePositions(this.sceneData, faceEntity);
      if (!linePoints || !normal || !facePoints.length) return;
      const intersection = intersectSegmentPlane(
        linePoints[0],
        linePoints[1],
        facePoints[0],
        normal
      );
      if (!intersection) {
        this.showToolError("所选线段与平面在当前线段范围内没有交点");
        return;
      }
      this.mutate(
        (draft) => {
          makeAuxPoint(draft, intersection);
        },
        "已生成线段与平面的交点"
      );
    }

    this.clearToolPicks(false);
    this.selectedIds = selectCreatedId
      ? new Set([selectCreatedId])
      : new Set();
    if (switchToSelect) this.setTool("select");
    if (completionMessage) this.operationStatus.textContent = completionMessage;
    this.refreshAll();
  }

  private mutate(
    operation: (draft: SceneState) => void,
    message: string
  ) {
    this.history.push(cloneScene(this.sceneData));
    if (this.history.length > 60) this.history.shift();
    operation(this.sceneData);
    this.future = [];
    this.operationStatus.textContent = message;
    this.persist();
  }

  private undo() {
    const previous = this.history.pop();
    if (!previous) return;
    this.future.push(cloneScene(this.sceneData));
    this.sceneData = previous;
    this.selectedIds.clear();
    this.clearToolPicks(false);
    this.operationStatus.textContent = "已撤销";
    this.syncFormToScene();
    this.persist();
    this.refreshAll();
  }

  private redo() {
    const next = this.future.pop();
    if (!next) return;
    this.history.push(cloneScene(this.sceneData));
    this.sceneData = next;
    this.selectedIds.clear();
    this.clearToolPicks(false);
    this.operationStatus.textContent = "已重做";
    this.syncFormToScene();
    this.persist();
    this.refreshAll();
  }

  private refreshAll(fit = false) {
    this.sceneTitle.textContent = this.sceneData.title;
    this.renderer3d.setScene(this.sceneData, this.selectedIds, fit);
    this.refreshPointEditor();
    this.renderMeasurements();
    this.renderObjectList();
    this.renderExtensionControls();
    this.refreshSelection();
    this.undoButton.disabled = this.history.length === 0;
    this.redoButton.disabled = this.future.length === 0;
    refreshIcons();
  }

  private refreshSelection() {
    this.renderer3d.renderSelection(this.sceneData, this.selectedIds);
    this.colorEditor.hidden = true;
    const selected = this.selectedEntities();
    if (!selected.length) {
      this.selectionTitle.textContent = "未选择对象";
      this.selectionDetails.innerHTML =
        "<div><dt>提示</dt><dd>点击图形中的点、棱或面</dd></div>";
      return;
    }
    if (selected.length > 1) {
      this.selectionTitle.textContent = `已选择 ${selected.length} 个对象`;
      this.selectionDetails.innerHTML = selected
        .map(
          (entity) =>
            `<div><dt>${entity.kind === "point" ? "点" : entity.kind === "edge" ? "棱" : "面"}</dt><dd>${entityDisplayName(this.sceneData, entity)}</dd></div>`
        )
        .join("");
      return;
    }

    const entity = selected[0];
    this.selectionTitle.textContent = entityDisplayName(this.sceneData, entity);
    const rows: Array<[string, string]> = [];
    if (entity.kind === "point") {
      rows.push(["坐标", formatPoint(entity.pos)]);
      rows.push(["类型", entity.base ? "基础顶点" : "辅助点"]);
      if (entity.constraint?.type === "edge-distance") {
        const constrainedEdge = findEdge(
          this.sceneData,
          entity.constraint.edgeId
        );
        const anchor = findPoint(
          this.sceneData,
          entity.constraint.anchorId
        );
        rows.push([
          "定位",
          `在${constrainedEdge ? entityDisplayName(this.sceneData, constrainedEdge) : entity.constraint.edgeId} 上，距 ${anchor?.label || entity.constraint.anchorId} ${round(entity.constraint.distance)}`
        ]);
      } else if (entity.constraint?.type === "coordinates") {
        rows.push([
          "定位",
          `坐标 (${round(entity.constraint.x)}, ${round(entity.constraint.y)}, ${round(entity.constraint.z)})`
        ]);
      }
    } else if (entity.kind === "edge") {
      const positions = getEdgePositions(this.sceneData, entity);
      rows.push([
        "端点",
        entity.kind === "edge"
          ? `${findPoint(this.sceneData, entity.a)?.label || entity.a} - ${
              findPoint(this.sceneData, entity.b)?.label || entity.b
            }`
          : ""
      ]);
      if (positions) {
        rows.push(["长度", round(distance(positions[0], positions[1]))]);
      }
      rows.push(["类型", entity.auxiliary ? "辅助线" : "基础棱"]);
    } else {
      rows.push([
        "顶点",
        entity.vertices
          .map((id) => findPoint(this.sceneData, id)?.label || id)
          .join(" · ")
      ]);
      rows.push(["面积", round(faceArea(this.sceneData, entity))]);
      rows.push(["类型", entity.auxiliary ? "辅助平面" : "基础面"]);
    }
    this.selectionDetails.innerHTML = rows
      .map(
        ([term, description]) =>
          `<div><dt>${term}</dt><dd>${description}</dd></div>`
      )
      .join("");
    this.refreshColorEditor();
  }

  private selectedEntities(): GeometryEntity[] {
    return [...this.selectedIds]
      .map(
        (id) =>
          findPoint(this.sceneData, id) ||
          findEdge(this.sceneData, id) ||
          findFace(this.sceneData, id)
      )
      .filter((item): item is GeometryEntity => Boolean(item));
  }

  private renderObjectList() {
    this.objectList.textContent = "";
    const groups: Array<{
      title: string;
      entities: Array<PointEntity | EdgeEntity | FaceEntity>;
    }> = [
      {
        title: "点",
        entities: this.sceneData.points.filter((item) => !item.internal)
      },
      { title: "线", entities: this.sceneData.edges },
      { title: "面", entities: this.sceneData.faces }
    ];

    groups.forEach((group) => {
      if (!group.entities.length) return;
      const heading = document.createElement("div");
      heading.className = "object-group-title";
      heading.textContent = `${group.title} · ${group.entities.length}`;
      this.objectList.appendChild(heading);

      group.entities.forEach((entity) => {
        const row = document.createElement("div");
        row.className = "object-row";
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.classList.toggle("selected", this.selectedIds.has(entity.id));
        row.classList.toggle("hidden", !entity.visible);

        const dot = document.createElement("span");
        dot.className = `object-dot ${entity.kind}`;
        if (entity.color) {
          dot.style.backgroundColor = entity.color;
        }
        const name = document.createElement("span");
        name.className = "object-name";
        name.textContent = entityDisplayName(this.sceneData, entity);
        const eye = document.createElement("button");
        eye.type = "button";
        eye.className = "eye-btn";
        eye.title = entity.visible ? "隐藏" : "显示";
        eye.innerHTML = icon(entity.visible ? "eye" : "eye-off");
        eye.addEventListener("click", (event) => {
          event.stopPropagation();
          this.history.push(cloneScene(this.sceneData));
          entity.visible = !entity.visible;
          this.future = [];
          this.persist();
          this.refreshAll();
        });

        row.append(dot, name, eye);
        row.addEventListener("click", () => {
          this.selectedIds = new Set([entity.id]);
          this.refreshSelection();
          this.renderObjectList();
          refreshIcons();
        });
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.selectedIds = new Set([entity.id]);
            this.refreshSelection();
            this.renderObjectList();
            refreshIcons();
          }
        });
        this.objectList.appendChild(row);
      });
    });

    mustElement<HTMLSpanElement>("object-count").textContent = String(
      this.sceneData.points.length +
        this.sceneData.edges.length +
        this.sceneData.faces.length +
        (this.sceneData.measurements?.length || 0)
    );
  }

  private renderMeasurements() {
    this.renderMeasurementProgress();
    const measurements = this.sceneData.measurements || [];
    this.measurementCount.textContent = String(measurements.length);
    this.measurementList.textContent = "";
    if (!measurements.length) {
      const empty = document.createElement("p");
      empty.className = "measurement-empty";
      empty.textContent = "选择长度或角度工具开始测量";
      this.measurementList.appendChild(empty);
      return;
    }

    measurements.forEach((measurement) => {
      const row = document.createElement("div");
      row.className = "measurement-row";
      const dot = document.createElement("span");
      dot.className = "measurement-color";
      dot.style.backgroundColor = measurement.color;
      const value = document.createElement("span");
      value.className = "measurement-value";
      value.textContent = measurement.label;
      value.title = measurement.label;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "measurement-remove";
      remove.title = "删除测量结果";
      remove.innerHTML = icon("trash-2");
      remove.addEventListener("click", () => {
        this.mutate(
          (draft) => {
            draft.measurements = (draft.measurements || []).filter(
              (item) => item.id !== measurement.id
            );
          },
          "测量结果已删除"
        );
        this.refreshAll();
      });
      row.append(dot, value, remove);
      this.measurementList.appendChild(row);
    });
  }

  private renderMeasurementProgress() {
    const isMeasurement =
      this.activeTool === "measure-length" ||
      this.activeTool === "measure-angle" ||
      this.activeTool === "measure-edge-angle";
    if (!isMeasurement) {
      this.measurementProgress.hidden = true;
      return;
    }
    const required = this.activeTool === "measure-length" ? 2 : 3;
    const labels = this.toolPicks
      .map((entity) =>
        entity.kind === "point" ? entity.label || entity.id : entity.id
      )
      .join(" → ");
    this.measurementProgress.hidden = false;
    this.measurementProgress.textContent = `${TOOL_LABELS[this.activeTool]}：已选 ${this.toolPicks.length}/${required}${
      labels ? `（${labels}）` : ""
    } · ${this.nextPickInstruction()}`;
  }

  private clearToolPicks(refresh = true) {
    this.toolPicks = [];
    this.renderMeasurementProgress();
    this.updateFinishPlaneButton();
    this.renderExtensionControls();
    if (refresh) this.refreshSelection();
  }

  private updateFinishPlaneButton() {
    this.finishPlaneButton.hidden = !(
      this.activeTool === "plane" && this.toolPicks.length === 3
    );
  }

  private showToolError(message: string) {
    this.operationStatus.textContent = message;
    this.clearToolPicks(false);
    this.selectedIds.clear();
    this.refreshSelection();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sceneData));
    } catch {
      // The explicit save command still lets the user keep a JSON copy.
    }
  }

  private saveScene() {
    const blob = new Blob([JSON.stringify(this.sceneData, null, 2)], {
      type: "application/json"
    });
    this.downloadUrl(
      URL.createObjectURL(blob),
      `${this.sceneData.title || "geometry-scene"}.json`
    );
    this.operationStatus.textContent = "场景 JSON 已保存";
  }

  private async loadScene(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!validateSceneData(parsed)) throw new Error("文件不是有效的场景 JSON");
      parsed.measurements ??= [];
      this.history.push(cloneScene(this.sceneData));
      this.sceneData = parsed;
      this.future = [];
      this.selectedIds.clear();
      this.clearToolPicks(false);
      this.syncFormToScene();
      this.persist();
      this.operationStatus.textContent = "场景已打开";
      this.refreshAll(true);
    } catch (error) {
      this.showToolError(
        error instanceof Error ? error.message : "无法读取场景文件"
      );
    }
  }

  private exportPng() {
    const url = this.renderer3d.exportPng();
    this.downloadUrl(url, `${this.sceneData.title || "geometry-scene"}.png`);
    this.operationStatus.textContent = "PNG 已导出";
  }

  private downloadUrl(url: string, filename: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.replace(/[\\/:*?"<>|]/g, "-");
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (url.startsWith("blob:")) {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

const app = new GeometryApp();

(window as typeof window & {
  __geometryDebug: {
    project: (id: string) => { x: number; y: number } | null;
    pick: (x: number, y: number) => { id: string; kind: string; name: string } | null;
    snap: (
      x: number,
      y: number
    ) => {
      id: string;
      kind: string;
      name: string;
      position: Vec3;
    } | null;
    camera: () => { position: number[]; target: number[] };
    scene: () => SceneState;
  };
}).__geometryDebug = {
  project: (id) => app.projectEntity(id),
  pick: (x, y) => app.pickAt(x, y),
  snap: (x, y) => app.snapAt(x, y),
  camera: () => app.cameraState(),
  scene: () => cloneScene(app.sceneSnapshot)
};

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service Worker registration failed", error);
    });
  });
}
