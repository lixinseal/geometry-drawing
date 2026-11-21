export type Vec3 = [number, number, number];

export type ShapeKind =
  | "cube"
  | "cuboid"
  | "tetra"
  | "triPyramid"
  | "quadPyramid"
  | "triPrism";

export type ToolKind =
  | "select"
  | "point"
  | "line"
  | "midpoint"
  | "measure-length"
  | "measure-angle"
  | "measure-edge-angle"
  | "perpendicular"
  | "parallel"
  | "plane"
  | "intersection"
  | "delete";

export interface PointEntity {
  kind: "point";
  id: string;
  label: string;
  pos: Vec3;
  visible: boolean;
  base: boolean;
  auxiliary: boolean;
  internal?: boolean;
  color?: string;
  constraint?:
    | {
        type: "edge-distance";
        edgeId: string;
        anchorId: string;
        distance: number;
      }
    | {
        type: "coordinates";
        x: number;
        y: number;
        z: number;
      };
}

export interface EdgeEntity {
  kind: "edge";
  id: string;
  a: string;
  b: string;
  visible: boolean;
  auxiliary: boolean;
  dashed: boolean;
  color?: string;
  label?: string;
}

export interface FaceEntity {
  kind: "face";
  id: string;
  vertices: string[];
  visible: boolean;
  auxiliary: boolean;
  color?: string;
  label?: string;
}

export interface MeasurementEntity {
  kind: "measurement";
  id: string;
  type: "length" | "angle";
  points: string[];
  value: number;
  label: string;
  visible: boolean;
  color: string;
}

export type GeometryEntity = PointEntity | EdgeEntity | FaceEntity;

export interface SceneState {
  version: 1;
  title: string;
  shape: ShapeKind;
  params: Record<string, number>;
  points: PointEntity[];
  edges: EdgeEntity[];
  faces: FaceEntity[];
  measurements?: MeasurementEntity[];
  nextId: number;
}

export interface ShapeDefinition {
  label: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    defaultValue: number;
  }>;
}
