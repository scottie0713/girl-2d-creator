import * as THREE from 'three';
import { BodyPartId, ExtractedVectorData, PartVectorData, Point2D, VectorPathSegment } from '../../types';
import { FemaleMannequin } from './MannequinModel';

interface EdgeInfo {
  v1: THREE.Vector3;
  v2: THREE.Vector3;
  face1: number;
  face2: number;
}

export class VectorExtractor {
  /**
   * 3Dマネキンの現在のアングル・ポーズから、
   * 部位ごとの2Dベクター線画（輪郭・稜線）および内側塗りつぶし領域を抽出
   */
  public static extract(
    mannequin: FemaleMannequin,
    camera: THREE.PerspectiveCamera,
    viewportWidth: number,
    viewportHeight: number
  ): ExtractedVectorData {
    mannequin.rootGroup.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const partsData: PartVectorData[] = [];

    mannequin.parts.forEach((partInfo) => {
      const partVector = this.extractPart(
        partInfo.id,
        partInfo.name,
        partInfo.mesh,
        camera,
        viewportWidth,
        viewportHeight
      );
      if (partVector) {
        partsData.push(partVector);
      }
    });

    // 視点からの距離（深度）でソート（奥から手前へ並べる）
    partsData.sort((a, b) => b.depth - a.depth);

    return {
      timestamp: Date.now(),
      width: viewportWidth,
      height: viewportHeight,
      camera: {
        fov: camera.fov,
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [0, 5, 0],
      },
      parts: partsData,
    };
  }

  private static extractPart(
    partId: BodyPartId,
    name: string,
    mesh: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ): PartVectorData | null {
    const geometry = mesh.geometry.clone();
    mesh.updateMatrixWorld(true);
    geometry.applyMatrix4(mesh.matrixWorld);

    const posAttr = geometry.getAttribute('position');
    const indexAttr = geometry.getIndex();
    if (!posAttr) return null;

    const vertices: THREE.Vector3[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      vertices.push(new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
    }

    // 面データの取得
    const faces: { a: number; b: number; c: number; normal: THREE.Vector3; frontFacing: boolean }[] = [];
    const numFaces = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

    let partCenter = new THREE.Vector3();
    let vertexCount = 0;

    for (let i = 0; i < numFaces; i++) {
      const a = indexAttr ? indexAttr.getX(i * 3) : i * 3;
      const b = indexAttr ? indexAttr.getX(i * 3 + 1) : i * 3 + 1;
      const c = indexAttr ? indexAttr.getX(i * 3 + 2) : i * 3 + 2;

      const va = vertices[a];
      const vb = vertices[b];
      const vc = vertices[c];

      partCenter.add(va).add(vb).add(vc);
      vertexCount += 3;

      // 面法線
      const cb = new THREE.Vector3().subVectors(vc, vb);
      const ab = new THREE.Vector3().subVectors(va, vb);
      const normal = new THREE.Vector3().crossVectors(cb, ab).normalize();

      // 視線方向との内積判定（裏表）
      const faceCenter = new THREE.Vector3().add(va).add(vb).add(vc).divideScalar(3);
      const viewDir = new THREE.Vector3().subVectors(camera.position, faceCenter).normalize();
      const dot = normal.dot(viewDir);

      faces.push({
        a,
        b,
        c,
        normal,
        frontFacing: dot > 0.001,
      });
    }

    if (vertexCount > 0) {
      partCenter.divideScalar(vertexCount);
    }
    const depth = camera.position.distanceTo(partCenter);

    // エッジの隣接辞書を作成
    const edgeMap = new Map<string, { f1: number; f2: number; v1: number; v2: number }>();
    const getEdgeKey = (i1: number, i2: number) => (i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`);

    faces.forEach((face, fIndex) => {
      const triEdges = [
        [face.a, face.b],
        [face.b, face.c],
        [face.c, face.a],
      ];
      triEdges.forEach(([v1, v2]) => {
        const key = getEdgeKey(v1, v2);
        const existing = edgeMap.get(key);
        if (!existing) {
          edgeMap.set(key, { f1: fIndex, f2: -1, v1, v2 });
        } else {
          existing.f2 = fIndex;
        }
      });
    });

    // 輪郭線（シルエットエッジ）と稜線（クリース）の抽出
    const silhouetteSegments: [Point2D, Point2D][] = [];
    const creaseSegments: [Point2D, Point2D][] = [];

    edgeMap.forEach((edge) => {
      const f1 = faces[edge.f1];
      const f2 = edge.f2 !== -1 ? faces[edge.f2] : null;

      const p1 = this.projectToScreen(vertices[edge.v1], camera, width, height);
      const p2 = this.projectToScreen(vertices[edge.v2], camera, width, height);
      if (!p1 || !p2) return;

      if (!f2) {
        // 境界エッジ
        if (f1.frontFacing) {
          silhouetteSegments.push([p1, p2]);
        }
      } else {
        // 表と裏の境界 = シルエットエッジ
        if (f1.frontFacing !== f2.frontFacing) {
          silhouetteSegments.push([p1, p2]);
        } else if (f1.frontFacing && f2.frontFacing) {
          // 両方表の場合、法線角度差をチェック（クリース）
          const angle = f1.normal.angleTo(f2.normal);
          if (angle > 0.85) {
            // 約48度以上のシャープエッジ
            creaseSegments.push([p1, p2]);
          }
        }
      }
    });

    // エッジ同士を繋いで連続パスに変換
    const outlinePaths = this.chainSegments(silhouetteSegments);
    const creasePaths = this.chainSegments(creaseSegments);

    // 塗りつぶし領域（表向き面の投影外周から閉じたポリゴン群を構築）
    const fillPolygon = this.buildFillPolygons(outlinePaths, silhouetteSegments);

    return {
      partId,
      name,
      outlinePaths,
      creasePaths,
      fillPolygon,
      depth,
    };
  }

  // 3Dワールド座標から2Dスクリーン座標への投影
  private static projectToScreen(
    v: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ): Point2D | null {
    const p = v.clone().project(camera);
    // カメラの後ろにある点はスキップ
    if (p.z > 1.0) return null;

    return {
      x: ((p.x + 1) * width) / 2,
      y: ((-p.y + 1) * height) / 2,
    };
  }

  // バラバラのエッジセグメントを連続したパス（Polyline）に連結する
  private static chainSegments(segments: [Point2D, Point2D][]): VectorPathSegment[] {
    if (segments.length === 0) return [];

    const threshold = 5.0; // 5px以内の近接端点を結合
    const used = new Array(segments.length).fill(false);
    const paths: VectorPathSegment[] = [];

    for (let i = 0; i < segments.length; i++) {
      if (used[i]) continue;
      used[i] = true;

      const path: Point2D[] = [segments[i][0], segments[i][1]];
      let extended = true;

      while (extended) {
        extended = false;
        const tail = path[path.length - 1];
        const head = path[0];

        for (let j = 0; j < segments.length; j++) {
          if (used[j]) continue;
          const [p1, p2] = segments[j];

          // tailに接続
          const dTailP1 = this.distSq(tail, p1);
          const dTailP2 = this.distSq(tail, p2);

          if (dTailP1 < threshold * threshold) {
            path.push(p2);
            used[j] = true;
            extended = true;
            break;
          } else if (dTailP2 < threshold * threshold) {
            path.push(p1);
            used[j] = true;
            extended = true;
            break;
          }

          // headに接続
          const dHeadP1 = this.distSq(head, p1);
          const dHeadP2 = this.distSq(head, p2);

          if (dHeadP1 < threshold * threshold) {
            path.unshift(p2);
            used[j] = true;
            extended = true;
            break;
          } else if (dHeadP2 < threshold * threshold) {
            path.unshift(p1);
            used[j] = true;
            extended = true;
            break;
          }
        }
      }

      // 始点と終点が近ければ閉じる
      const isClosed = this.distSq(path[0], path[path.length - 1]) < threshold * threshold * 2;
      if (path.length >= 3) {
        paths.push({
          points: this.simplifyPath(path, 1.2),
          closed: isClosed,
        });
      }
    }

    return paths;
  }

  // 閉じた塗りつぶし領域の生成
  private static buildFillPolygons(
    outlinePaths: VectorPathSegment[],
    allSegments: [Point2D, Point2D][]
  ): Point2D[][] {
    const polygons: Point2D[][] = [];

    // 既に閉じてある輪郭パスを採用
    outlinePaths.forEach((path) => {
      if (path.closed && path.points.length >= 3) {
        polygons.push(path.points);
      } else if (path.points.length >= 4) {
        // ほぼ閉じている場合も末尾と先頭を結んで閉路とする
        polygons.push([...path.points, path.points[0]]);
      }
    });

    return polygons;
  }

  // パスの簡略化（ラマー・ダグラス・ポイッカー法）で余計な頂点を減らし滑らかにする
  private static simplifyPath(points: Point2D[], tolerance: number): Point2D[] {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let index = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const d = this.perpendicularDistance(points[i], first, last);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > tolerance) {
      const recResults1 = this.simplifyPath(points.slice(0, index + 1), tolerance);
      const recResults2 = this.simplifyPath(points.slice(index), tolerance);
      return recResults1.slice(0, -1).concat(recResults2);
    } else {
      return [first, last];
    }
  }

  private static perpendicularDistance(p: Point2D, lineA: Point2D, lineB: Point2D): number {
    const dx = lineB.x - lineA.x;
    const dy = lineB.y - lineA.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag < 0.0001) return Math.sqrt(this.distSq(p, lineA));
    const u = ((p.x - lineA.x) * dx + (p.y - lineA.y) * dy) / (mag * mag);
    const clampedU = Math.max(0, Math.min(1, u));
    const projX = lineA.x + clampedU * dx;
    const projY = lineA.y + clampedU * dy;
    return Math.sqrt(this.distSq(p, { x: projX, y: projY }));
  }

  private static distSq(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  }
}
