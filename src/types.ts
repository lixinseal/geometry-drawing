export type Vec3 = [number, number, number];

export type ShapeKind =
  | "cube"
  | "cuboid"
  | "tetra"
  | "triPyramid"
  | "quadPyramid"
  | "triPrism"
  | "cylinder"
  | "cone"
  | "sphere";

export type ToolKind =
  | "select"
  | "point"
  | "line"
  | "extend"
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
      }
    | {
        type: "circle-angle";
        curveId: string;
        angleDegrees: number;
      }
    | {
        type: "circle-arc";
        curveId: string;
        arcLength: number;
      }
    | {
        type: "cylinder-surface";
        surfaceId: string;
        angleDegrees: number;
        height: number;
      }
    | {
        type: "cone-surface";
        surfaceId: string;
        angleDegrees: number;
        distanceFromApex: number;
      }
    | {
        type: "sphere-surface";
        surfaceId: string;
        azimuthDegrees: number;
        latitudeDegrees: number;
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

export interface CurveEntity {
  kind: "curve";
  id: string;
  curveType: "circle";
  center: Vec3;
  normal: Vec3;
  radius: number;
  label: string;
  visible: boolean;
  auxiliary: boolean;
  color?: string;
  dashed?: boolean;
}

export interface SurfaceEntity {
  kind: "surface";
  id: string;
  surfaceType: "cylinder" | "cone" | "sphere";
  label: string;
  visible: boolean;
  auxiliary: boolean;
  color?: string;
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

export type GeometryEntity =
  | PointEntity
  | EdgeEntity
  | FaceEntity
  | CurveEntity
  | SurfaceEntity;

export interface SceneState {
  version: 1;
  title: string;
  shape: ShapeKind;
  params: Record<string, number>;
  points: PointEntity[];
  edges: EdgeEntity[];
  faces: FaceEntity[];
  curves: CurveEntity[];
  surfaces: SurfaceEntity[];
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
