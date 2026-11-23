import type {
  CurveEntity,
  EdgeEntity,
  FaceEntity,
  GeometryEntity,
  PointEntity,
  SceneState,
  ShapeDefinition,
  ShapeKind,
  SurfaceEntity,
  Vec3
} from "./types";

const EPSILON = 1e-7;

export const SHAPES: Record<ShapeKind, ShapeDefinition> = {
  cube: {
    label: "正方体",
    description: "六个全等正方形面",
    fields: [{ key: "edge", label: "棱长 a", defaultValue: 4 }]
  },
  cuboid: {
    label: "长方体",
    description: "输入长、宽、高",
    fields: [
      { key: "length", label: "长 a", defaultValue: 5 },
      { key: "width", label: "宽 b", defaultValue: 3.5 },
      { key: "height", label: "高 h", defaultValue: 3 }
    ]
  },
  tetra: {
    label: "正四面体",
    description: "六条棱长度相等",
    fields: [{ key: "edge", label: "棱长 a", defaultValue: 4 }]
  },
  triPyramid: {
    label: "正三棱锥",
    description: "底面正三角形，三条侧棱相等",
    fields: [
      { key: "base", label: "底边 a", defaultValue: 4 },
      { key: "lateral", label: "侧棱 l", defaultValue: 5 }
    ]
  },
  quadPyramid: {
    label: "正四棱锥",
    description: "底面正方形，四条侧棱相等",
    fields: [
      { key: "base", label: "底边 a", defaultValue: 4 },
      { key: "lateral", label: "侧棱 l", defaultValue: 5 }
    ]
  },
  triPrism: {
    label: "正三棱柱",
    description: "上下底面为等边三角形",
    fields: [
      { key: "base", label: "底边 a", defaultValue: 4 },
      { key: "height", label: "棱柱高 h", defaultValue: 5 }
    ]
  },
  cylinder: {
    label: "圆柱",
    description: "竖直轴线，底面位于基准面",
    fields: [
      { key: "radius", label: "底面半径 r", defaultValue: 2.5 },
      { key: "height", label: "高 h", defaultValue: 5 }
    ]
  },
  cone: {
    label: "圆锥",
    description: "竖直轴线，顶点位于底面正上方",
    fields: [
      { key: "radius", label: "底面半径 r", defaultValue: 2.5 },
      { key: "height", label: "高 h", defaultValue: 5 }
    ]
  },
  sphere: {
    label: "球体",
    description: "球心位于坐标原点",
    fields: [{ key: "radius", label: "半径 r", defaultValue: 3 }]
  }
};

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function normalize(a: Vec3): Vec3 {
  const magnitude = length(a);
  return magnitude < EPSILON ? [0, 0, 0] : scale(a, 1 / magnitude);
}

export function distance(a: Vec3, b: Vec3): number {
  return length(subtract(a, b));
}

export function angleDegrees(vertex: Vec3, a: Vec3, b: Vec3) {
  const first = normalize(subtract(a, vertex));
  const second = normalize(subtract(b, vertex));
  if (length(first) < EPSILON || length(second) < EPSILON) return null;
  const cosine = Math.max(-1, Math.min(1, dot(first, second)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return scale(add(a, b), 0.5);
}

export function toThreePoint(value: Vec3): [number, number, number] {
  return [value[0], value[2], value[1]];
}

function point(
  id: string,
  label: string,
  pos: Vec3,
  base = true
): PointEntity {
  return {
    kind: "point",
    id,
    label,
    pos,
    visible: true,
    base,
    auxiliary: !base
  };
}

function edge(
  id: string,
  a: string,
  b: string,
  options: Partial<EdgeEntity> = {}
): EdgeEntity {
  return {
    kind: "edge",
    id,
    a,
    b,
    visible: true,
    auxiliary: false,
    dashed: false,
    ...options
  };
}

function face(
  id: string,
  vertices: string[],
  options: Partial<FaceEntity> = {}
): FaceEntity {
  return {
    kind: "face",
    id,
    vertices,
    visible: true,
    auxiliary: false,
    ...options
  };
}

function curve(
  id: string,
  center: Vec3,
  radius: number,
  label: string,
  options: Partial<CurveEntity> = {}
): CurveEntity {
  return {
    kind: "curve",
    id,
    curveType: "circle",
    center,
    normal: [0, 0, 1],
    radius,
    label,
    visible: true,
    auxiliary: false,
    ...options
  };
}

function surface(
  id: string,
  surfaceType: SurfaceEntity["surfaceType"],
  label: string
): SurfaceEntity {
  return {
    kind: "surface",
    id,
    surfaceType,
    label,
    visible: true,
    auxiliary: false
  };
}

function scene(
  title: string,
  shape: ShapeKind,
  params: Record<string, number>,
  points: PointEntity[],
  edges: EdgeEntity[],
  faces: FaceEntity[],
  curves: CurveEntity[] = [],
  surfaces: SurfaceEntity[] = []
): SceneState {
  return {
    version: 1,
    title,
    shape,
    params,
    points,
    edges,
    faces,
    curves,
    surfaces,
    measurements: [],
    nextId: 1
  };
}

function validatePositive(params: Record<string, number>, keys: string[]) {
  for (const key of keys) {
    if (!Number.isFinite(params[key]) || params[key] <= 0) {
      throw new Error("所有长度参数都必须大于 0");
    }
  }
}

export function buildSolid(
  shape: ShapeKind,
  params: Record<string, number>
): SceneState {
  if (shape === "cube" || shape === "cuboid") {
    const keys =
      shape === "cube" ? ["edge"] : ["length", "width", "height"];
    validatePositive(params, keys);
    const a = shape === "cube" ? params.edge : params.length;
    const b = shape === "cube" ? params.edge : params.width;
    const h = shape === "cube" ? params.edge : params.height;
    const x = a / 2;
    const y = b / 2;
    const points = [
      point("A", "A", [-x, -y, 0]),
      point("B", "B", [x, -y, 0]),
      point("C", "C", [x, y, 0]),
      point("D", "D", [-x, y, 0]),
      point("A1", "A₁", [-x, -y, h]),
      point("B1", "B₁", [x, -y, h]),
      point("C1", "C₁", [x, y, h]),
      point("D1", "D₁", [-x, y, h])
    ];
    const edges = [
      edge("AB", "A", "B"),
      edge("BC", "B", "C"),
      edge("CD", "C", "D"),
      edge("DA", "D", "A"),
      edge("A1B1", "A1", "B1"),
      edge("B1C1", "B1", "C1"),
      edge("C1D1", "C1", "D1"),
      edge("D1A1", "D1", "A1"),
      edge("AA1", "A", "A1"),
      edge("BB1", "B", "B1"),
      edge("CC1", "C", "C1"),
      edge("DD1", "D", "D1")
    ];
    const faces = [
      face("ABCD", ["A", "B", "C", "D"]),
      face("A1B1C1D1", ["A1", "B1", "C1", "D1"]),
      face("ABB1A1", ["A", "B", "B1", "A1"]),
      face("BCC1B1", ["B", "C", "C1", "B1"]),
      face("CDD1C1", ["C", "D", "D1", "C1"]),
      face("DAA1D1", ["D", "A", "A1", "D1"])
    ];
    return scene(
      `${shape === "cube" ? "正方体" : "长方体"} ABCD-A₁B₁C₁D₁`,
      shape,
      params,
      points,
      edges,
      faces
    );
  }

  if (shape === "tetra") {
    validatePositive(params, ["edge"]);
    const a = params.edge;
    const radius = a / Math.sqrt(3);
    const height = a * Math.sqrt(2 / 3);
    const points = [
      point("A", "A", [radius, 0, 0]),
      point("B", "B", [-radius / 2, a / 2, 0]),
      point("C", "C", [-radius / 2, -a / 2, 0]),
      point("D", "D", [0, 0, height])
    ];
    const edges = [
      edge("AB", "A", "B"),
      edge("BC", "B", "C"),
      edge("CA", "C", "A"),
      edge("AD", "A", "D"),
      edge("BD", "B", "D"),
      edge("CD", "C", "D")
    ];
    const faces = [
      face("ABC", ["A", "B", "C"]),
      face("ABD", ["A", "B", "D"]),
      face("BCD", ["B", "C", "D"]),
      face("CAD", ["C", "A", "D"])
    ];
    return scene(
      "正四面体 ABCD",
      shape,
      params,
      points,
      edges,
      faces
    );
  }

  if (shape === "triPyramid") {
    validatePositive(params, ["base", "lateral"]);
    const a = params.base;
    const lateral = params.lateral;
    const radius = a / Math.sqrt(3);
    if (lateral <= radius + EPSILON) {
      throw new Error("侧棱 l 必须大于底面外接圆半径 a/√3");
    }
    const height = Math.sqrt(lateral * lateral - radius * radius);
    const points = [
      point("A", "A", [radius, 0, 0]),
      point("B", "B", [-radius / 2, a / 2, 0]),
      point("C", "C", [-radius / 2, -a / 2, 0]),
      point("P", "P", [0, 0, height])
    ];
    const edges = [
      edge("AB", "A", "B"),
      edge("BC", "B", "C"),
      edge("CA", "C", "A"),
      edge("PA", "P", "A"),
      edge("PB", "P", "B"),
      edge("PC", "P", "C")
    ];
    const faces = [
      face("ABC", ["A", "B", "C"]),
      face("PAB", ["P", "A", "B"]),
      face("PBC", ["P", "B", "C"]),
      face("PCA", ["P", "C", "A"])
    ];
    return scene(
      "正三棱锥 P-ABC",
      shape,
      params,
      points,
      edges,
      faces
    );
  }

  if (shape === "quadPyramid") {
    validatePositive(params, ["base", "lateral"]);
    const a = params.base;
    const lateral = params.lateral;
    const half = a / 2;
    const baseRadius = a / Math.SQRT2;
    if (lateral <= baseRadius + EPSILON) {
      throw new Error("侧棱 l 必须大于底面外接圆半径 a/√2");
    }
    const height = Math.sqrt(lateral * lateral - baseRadius * baseRadius);
    const points = [
      point("A", "A", [-half, -half, 0]),
      point("B", "B", [half, -half, 0]),
      point("C", "C", [half, half, 0]),
      point("D", "D", [-half, half, 0]),
      point("P", "P", [0, 0, height])
    ];
    const edges = [
      edge("AB", "A", "B"),
      edge("BC", "B", "C"),
      edge("CD", "C", "D"),
      edge("DA", "D", "A"),
      edge("PA", "P", "A"),
      edge("PB", "P", "B"),
      edge("PC", "P", "C"),
      edge("PD", "P", "D")
    ];
    const faces = [
      face("ABCD", ["A", "B", "C", "D"]),
      face("PAB", ["P", "A", "B"]),
      face("PBC", ["P", "B", "C"]),
      face("PCD", ["P", "C", "D"]),
      face("PDA", ["P", "D", "A"])
    ];
    return scene(
      "正四棱锥 P-ABCD",
      shape,
      params,
      points,
      edges,
      faces
    );
  }

  if (shape === "triPrism") {
    validatePositive(params, ["base", "height"]);
    const a = params.base;
    const height = params.height;
    const radius = a / Math.sqrt(3);
    const base = [
      point("A", "A", [radius, 0, 0]),
      point("B", "B", [-radius / 2, a / 2, 0]),
      point("C", "C", [-radius / 2, -a / 2, 0])
    ];
    const top = [
      point("A1", "A₁", [radius, 0, height]),
      point("B1", "B₁", [-radius / 2, a / 2, height]),
      point("C1", "C₁", [-radius / 2, -a / 2, height])
    ];
    const edges = [
      edge("AB", "A", "B"),
      edge("BC", "B", "C"),
      edge("CA", "C", "A"),
      edge("A1B1", "A1", "B1"),
      edge("B1C1", "B1", "C1"),
      edge("C1A1", "C1", "A1"),
      edge("AA1", "A", "A1"),
      edge("BB1", "B", "B1"),
      edge("CC1", "C", "C1")
    ];
    const faces = [
      face("ABC", ["A", "B", "C"]),
      face("A1B1C1", ["A1", "B1", "C1"]),
      face("ABB1A1", ["A", "B", "B1", "A1"]),
      face("BCC1B1", ["B", "C", "C1", "B1"]),
      face("CAA1C1", ["C", "A", "A1", "C1"])
    ];
    return scene(
      "正三棱柱 ABC-A₁B₁C₁",
      shape,
      params,
      [...base, ...top],
      edges,
      faces
    );
  }

  if (shape === "cylinder") {
    validatePositive(params, ["radius", "height"]);
    const radius = params.radius;
    const height = params.height;
    const points = [
      point("O", "O", [0, 0, 0]),
      point("O1", "O₁", [0, 0, height]),
      point("A", "A", [radius, 0, 0]),
      point("A1", "A₁", [radius, 0, height]),
      point("B", "B", [0, radius, 0]),
      point("B1", "B₁", [0, radius, height])
    ];
    return scene(
      "圆柱 O-O₁",
      shape,
      params,
      points,
      [
        edge("OO1", "O", "O1", { dashed: true }),
        edge("OA", "O", "A", { dashed: true }),
        edge("O1A1", "O1", "A1", { dashed: true }),
        edge("AA1", "A", "A1"),
        edge("BB1", "B", "B1")
      ],
      [],
      [
        curve("C_bottom", [0, 0, 0], radius, "下底圆"),
        curve("C_top", [0, 0, height], radius, "上底圆")
      ],
      [surface("S_cylinder", "cylinder", "圆柱侧面")]
    );
  }

  if (shape === "cone") {
    validatePositive(params, ["radius", "height"]);
    const radius = params.radius;
    const height = params.height;
    return scene(
      "圆锥 P-O",
      shape,
      params,
      [
        point("O", "O", [0, 0, 0]),
        point("A", "A", [radius, 0, 0]),
        point("B", "B", [0, radius, 0]),
        point("P", "P", [0, 0, height])
      ],
      [
        edge("OP", "O", "P", { dashed: true }),
        edge("OA", "O", "A", { dashed: true }),
        edge("PA", "P", "A"),
        edge("PB", "P", "B")
      ],
      [],
      [curve("C_base", [0, 0, 0], radius, "底面圆")],
      [surface("S_cone", "cone", "圆锥侧面")]
    );
  }

  validatePositive(params, ["radius"]);
  const radius = params.radius;
  return scene(
    `球 O（半径 ${radius}）`,
    shape,
    params,
    [
      point("O", "O", [0, 0, 0]),
      point("N", "N", [0, 0, radius]),
      point("S", "S", [0, 0, -radius]),
      point("A", "A", [radius, 0, 0]),
      point("B", "B", [-radius, 0, 0]),
      point("C", "C", [0, radius, 0]),
      point("D", "D", [0, -radius, 0])
    ],
    [
      edge("ON", "O", "N", { dashed: true }),
      edge("OS", "O", "S", { dashed: true }),
      edge("OA", "O", "A", { dashed: true })
    ],
    [],
    [curve("C_equator", [0, 0, 0], radius, "赤道圆")],
    [surface("S_sphere", "sphere", "球面")]
  );
}

export function findPoint(scene: SceneState, id: string) {
  return scene.points.find((item) => item.id === id);
}

export function findEdge(scene: SceneState, id: string) {
  return scene.edges.find((item) => item.id === id);
}

export function findFace(scene: SceneState, id: string) {
  return scene.faces.find((item) => item.id === id);
}

export function findCurve(scene: SceneState, id: string) {
  return scene.curves.find((item) => item.id === id);
}

export function findSurface(scene: SceneState, id: string) {
  return scene.surfaces.find((item) => item.id === id);
}

function circleBasis(normal: Vec3): [Vec3, Vec3] {
  const unitNormal = normalize(normal);
  if (Math.abs(unitNormal[2]) > 0.999) {
    return [
      [1, 0, 0],
      [0, 1, 0]
    ];
  }
  const axisU = normalize(cross([0, 0, 1], unitNormal));
  return [axisU, normalize(cross(unitNormal, axisU))];
}

export function pointOnCircle(
  curveEntity: CurveEntity,
  angleRadians: number
): Vec3 {
  const [axisU, axisV] = circleBasis(curveEntity.normal);
  return add(
    curveEntity.center,
    add(
      scale(axisU, curveEntity.radius * Math.cos(angleRadians)),
      scale(axisV, curveEntity.radius * Math.sin(angleRadians))
    )
  );
}

export function getCirclePositions(
  curveEntity: CurveEntity,
  segments = 128
): Vec3[] {
  const safeSegments = Math.max(24, segments);
  return Array.from({ length: safeSegments + 1 }, (_, index) =>
    pointOnCircle(curveEntity, (index / safeSegments) * Math.PI * 2)
  );
}

export function cylinderSurfacePoint(
  scene: SceneState,
  angleDegrees: number,
  height: number
): Vec3 | null {
  if (scene.shape !== "cylinder") return null;
  const radius = scene.params.radius;
  const maxHeight = scene.params.height;
  if (
    !Number.isFinite(angleDegrees) ||
    !Number.isFinite(height) ||
    height < 0 ||
    height > maxHeight + EPSILON
  ) {
    return null;
  }
  const angle = (angleDegrees * Math.PI) / 180;
  return [
    radius * Math.cos(angle),
    radius * Math.sin(angle),
    Math.min(maxHeight, Math.max(0, height))
  ];
}

export function coneSurfacePoint(
  scene: SceneState,
  angleDegrees: number,
  distanceFromApex: number
): Vec3 | null {
  if (scene.shape !== "cone") return null;
  const radius = scene.params.radius;
  const height = scene.params.height;
  const generatrixLength = Math.hypot(radius, height);
  if (
    !Number.isFinite(angleDegrees) ||
    !Number.isFinite(distanceFromApex) ||
    distanceFromApex < 0 ||
    distanceFromApex > generatrixLength + EPSILON
  ) {
    return null;
  }
  const ratio = 1 - Math.min(generatrixLength, distanceFromApex) / generatrixLength;
  const angle = (angleDegrees * Math.PI) / 180;
  return [
    radius * ratio * Math.cos(angle),
    radius * ratio * Math.sin(angle),
    height * ratio
  ];
}

export function sphereSurfacePoint(
  scene: SceneState,
  azimuthDegrees: number,
  latitudeDegrees: number
): Vec3 | null {
  if (scene.shape !== "sphere") return null;
  if (
    !Number.isFinite(azimuthDegrees) ||
    !Number.isFinite(latitudeDegrees) ||
    latitudeDegrees < -90 ||
    latitudeDegrees > 90
  ) {
    return null;
  }
  const radius = scene.params.radius;
  const azimuth = (azimuthDegrees * Math.PI) / 180;
  const latitude = (latitudeDegrees * Math.PI) / 180;
  const horizontalRadius = radius * Math.cos(latitude);
  return [
    horizontalRadius * Math.cos(azimuth),
    horizontalRadius * Math.sin(azimuth),
    radius * Math.sin(latitude)
  ];
}

export function projectPointToSurface(
  scene: SceneState,
  surfaceEntity: SurfaceEntity,
  position: Vec3
): Vec3 | null {
  if (surfaceEntity.surfaceType === "cylinder" && scene.shape === "cylinder") {
    const height = scene.params.height;
    const angle = Math.atan2(position[1], position[0]);
    return cylinderSurfacePoint(
      scene,
      (angle * 180) / Math.PI,
      Math.min(height, Math.max(0, position[2]))
    );
  }
  if (surfaceEntity.surfaceType === "cone" && scene.shape === "cone") {
    const angle = Math.atan2(position[1], position[0]);
    const height = scene.params.height;
    const radius = scene.params.radius;
    const baseRadius = Math.hypot(position[0], position[1]);
    const radialRatio = baseRadius / Math.max(radius, EPSILON);
    const heightRatio = Math.max(0, Math.min(1, 1 - position[2] / height));
    const ratio = Math.min(radialRatio, heightRatio);
    const generatrixLength = Math.hypot(radius, height);
    return coneSurfacePoint(
      scene,
      (angle * 180) / Math.PI,
      generatrixLength * (1 - ratio)
    );
  }
  if (surfaceEntity.surfaceType === "sphere" && scene.shape === "sphere") {
    const magnitude = length(position);
    if (magnitude < EPSILON) return null;
    return scale(position, scene.params.radius / magnitude);
  }
  return null;
}

export function sceneBoundsPoints(scene: SceneState): Vec3[] {
  const positions = scene.points
    .filter((item) => item.visible)
    .map((item) => item.pos);
  scene.curves
    .filter((item) => item.visible)
    .forEach((item) => positions.push(...getCirclePositions(item, 32)));
  if (scene.shape === "cone") {
    positions.push([0, 0, scene.params.height]);
  }
  if (scene.shape === "sphere") {
    const r = scene.params.radius;
    positions.push([-r, -r, -r], [r, r, r]);
  }
  return positions;
}

export function getEdgePositions(
  scene: SceneState,
  edgeEntity: EdgeEntity
): [Vec3, Vec3] | null {
  const a = findPoint(scene, edgeEntity.a);
  const b = findPoint(scene, edgeEntity.b);
  return a && b ? [a.pos, b.pos] : null;
}

export function getFacePositions(
  scene: SceneState,
  faceEntity: FaceEntity
): Vec3[] {
  return faceEntity.vertices
    .map((id) => findPoint(scene, id)?.pos)
    .filter((value): value is Vec3 => Boolean(value));
}

export function faceNormal(
  scene: SceneState,
  faceEntity: FaceEntity
): Vec3 | null {
  const points = getFacePositions(scene, faceEntity);
  if (points.length < 3) return null;
  const normal = cross(
    subtract(points[1], points[0]),
    subtract(points[2], points[0])
  );
  return length(normal) < EPSILON ? null : normalize(normal);
}

export function arePointsCoplanar(points: Vec3[]) {
  if (points.length <= 3) return true;
  const normal = cross(
    subtract(points[1], points[0]),
    subtract(points[2], points[0])
  );
  if (length(normal) < EPSILON) return false;
  const unitNormal = normalize(normal);
  const scale = Math.max(
    1,
    ...points.map((point) => distance(point, points[0]))
  );
  return points
    .slice(3)
    .every(
      (point) =>
        Math.abs(dot(subtract(point, points[0]), unitNormal)) <
        scale * 1e-5
    );
}

export function orderCoplanarIds(scene: SceneState, ids: string[]) {
  if (ids.length < 4) return ids;
  const points = ids
    .map((id) => findPoint(scene, id))
    .filter((point): point is PointEntity => Boolean(point));
  if (points.length !== ids.length) return ids;

  const normal = cross(
    subtract(points[1].pos, points[0].pos),
    subtract(points[2].pos, points[0].pos)
  );
  if (length(normal) < EPSILON) return ids;
  const axisU = normalize(subtract(points[1].pos, points[0].pos));
  const axisV = normalize(cross(normal, axisU));
  const center = scale(
    points.reduce((sum, point) => add(sum, point.pos), [0, 0, 0] as Vec3),
    1 / points.length
  );

  return points
    .map((point) => {
      const relative = subtract(point.pos, center);
      return {
        id: point.id,
        angle: Math.atan2(dot(relative, axisV), dot(relative, axisU))
      };
    })
    .sort((a, b) => a.angle - b.angle)
    .map((item) => item.id);
}

export function projectPointToLine(
  target: Vec3,
  lineA: Vec3,
  lineB: Vec3
): Vec3 {
  const direction = subtract(lineB, lineA);
  const denominator = dot(direction, direction);
  if (denominator < EPSILON) return lineA;
  const t = dot(subtract(target, lineA), direction) / denominator;
  return add(lineA, scale(direction, t));
}

export function intersectSegmentPlane(
  start: Vec3,
  end: Vec3,
  planePoint: Vec3,
  normal: Vec3
): Vec3 | null {
  const direction = subtract(end, start);
  const denominator = dot(direction, normal);
  if (Math.abs(denominator) < EPSILON) return null;
  const t = dot(subtract(planePoint, start), normal) / denominator;
  if (t < -EPSILON || t > 1 + EPSILON) return null;
  return add(start, scale(direction, Math.max(0, Math.min(1, t))));
}

export function makeAuxPoint(
  scene: SceneState,
  pos: Vec3,
  preferredLabel = ""
): PointEntity {
  const label =
    preferredLabel || nextPointLabel(new Set(scene.points.map((p) => p.label)));
  const item = point(
    `P_${scene.nextId++}`,
    label,
    pos,
    false
  );
  item.color = "#0f766e";
  scene.points.push(item);
  return item;
}

export function makeAuxEdge(
  scene: SceneState,
  a: string,
  b: string,
  options: Partial<EdgeEntity> = {}
): EdgeEntity {
  const item = edge(`E_${scene.nextId++}`, a, b, {
    auxiliary: true,
    color: "#0f766e",
    ...options
  });
  scene.edges.push(item);
  return item;
}

export function makeAuxFace(
  scene: SceneState,
  vertices: string[],
  label?: string
): FaceEntity {
  const pointNames = vertices
    .map((id) => findPoint(scene, id)?.label || id)
    .join("");
  const item = face(`F_${scene.nextId++}`, vertices, {
    auxiliary: true,
    color: "#d97706",
    label: label || `平面 ${pointNames}`
  });
  scene.faces.push(item);
  return item;
}

function nextPointLabel(used: Set<string>) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  for (const letter of letters) {
    if (!used.has(letter)) return letter;
  }
  let index = 1;
  while (used.has(`P${index}`)) index += 1;
  return `P${index}`;
}

export function entityDisplayName(
  scene: SceneState,
  entity: GeometryEntity
): string {
  if (entity.kind === "point") return `点 ${entity.label || entity.id}`;
  if (entity.kind === "edge") {
    if (entity.label) return entity.label;
    const a = findPoint(scene, entity.a)?.label || entity.a;
    const b = findPoint(scene, entity.b)?.label || entity.b;
    return `棱 ${a}${b}`;
  }
  if (entity.kind === "curve") return entity.label || "圆";
  if (entity.kind === "surface") return entity.label;
  return entity.label || `面 ${entity.vertices.join("")}`;
}

export function cloneScene(scene: SceneState): SceneState {
  return JSON.parse(JSON.stringify(scene)) as SceneState;
}

export function removeEntityCascade(scene: SceneState, entityId: string) {
  const target = [
    ...scene.points,
    ...scene.edges,
    ...scene.faces,
    ...scene.curves,
    ...scene.surfaces
  ].find((item) => item.id === entityId);
  if (!target) return;

  const removed = new Set<string>([entityId]);
  scene.edges = scene.edges.filter((item) => {
    if (removed.has(item.a) || removed.has(item.b)) {
      removed.add(item.id);
      return false;
    }
    return true;
  });
  scene.faces = scene.faces.filter((item) => {
    if (item.vertices.some((id) => removed.has(id))) {
      removed.add(item.id);
      return false;
    }
    return true;
  });
  scene.points = scene.points.filter((item) => !removed.has(item.id));
  scene.edges = scene.edges.filter((item) => !removed.has(item.id));
  scene.faces = scene.faces.filter((item) => !removed.has(item.id));
  scene.curves = scene.curves.filter((item) => !removed.has(item.id));
  scene.surfaces = scene.surfaces.filter((item) => !removed.has(item.id));
}

export function normalizeSceneData(value: unknown): SceneState | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<SceneState> & Record<string, unknown>;
  if (
    data.version !== 1 ||
    typeof data.title !== "string" ||
    !Array.isArray(data.points) ||
    !Array.isArray(data.edges) ||
    !Array.isArray(data.faces) ||
    !data.points.every(
      (point) =>
        point?.kind === "point" &&
        typeof point.id === "string" &&
        Array.isArray(point.pos) &&
        point.pos.length === 3
    )
  ) {
    return null;
  }
  const shape = data.shape;
  if (typeof shape !== "string" || !(shape in SHAPES)) return null;
  data.curves = Array.isArray(data.curves) ? data.curves : [];
  data.surfaces = Array.isArray(data.surfaces) ? data.surfaces : [];
  data.measurements = Array.isArray(data.measurements) ? data.measurements : [];
  data.params = typeof data.params === "object" && data.params ? data.params : {};
  data.nextId = Number.isFinite(data.nextId) ? Number(data.nextId) : 1;
  return data as SceneState;
}
