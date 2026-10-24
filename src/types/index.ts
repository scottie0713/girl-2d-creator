export type BodyPartId =
  | 'head'
  | 'neck'
  | 'chest'
  | 'waist'
  | 'pelvis'
  | 'upperArmL'
  | 'forearmL'
  | 'handL'
  | 'upperArmR'
  | 'forearmR'
  | 'handR'
  | 'thighL'
  | 'shinL'
  | 'footL'
  | 'thighR'
  | 'shinR'
  | 'footR';

export interface Point2D {
  x: number;
  y: number;
}

export interface VectorPathSegment {
  points: Point2D[];
  closed?: boolean;
}

export interface PartVectorData {
  partId: BodyPartId;
  name: string;
  outlinePaths: VectorPathSegment[]; // 外形輪郭線
  creasePaths: VectorPathSegment[];  // 内部ディテール稜線
  fillPolygon: Point2D[][];          // 塗りつぶし用閉路（複数アイランド対応）
  depth: number;                     // 視点からの平均深度（描画順・前後関係ソート用）
}

export interface ExtractedVectorData {
  timestamp: number;
  width: number;
  height: number;
  camera: {
    fov: number;
    position: [number, number, number];
    target: [number, number, number];
  };
  parts: PartVectorData[];
}

export interface LayerItem {
  id: string;
  partId: BodyPartId;
  name: string;
  type: 'line' | 'fill';
  visible: boolean;
  locked: boolean;
  opacity: number;
  color: string;
  strokeWidth: number;
}

export type EditorMode = '3d-pose' | '2d-vector';

export type VectorTool =
  | 'select'        // アンカー・ハンドル選択＆移動
  | 'transform'     // バウンディングボックス変形
  | 'liquify'       // ゆがみブラシ（イラストレーターの輪郭調整用）
  | 'warp'          // パペットワープ / 嘘パース誇張
  | 'pen'           // ベクターペン追加加筆
  | 'smooth'        // パス平滑化
  | 'eraser';       // 消しゴム

export interface PosePreset {
  id: string;
  name: string;
  category: 'basic' | 'cute' | 'dynamic' | 'sitting';
  description: string;
  rotations: Record<string, [number, number, number]>; // boneName -> eulerXYZ
}
