import * as THREE from 'three';
import { BodyPartId } from '../../types';

export interface PartMeshInfo {
  id: BodyPartId;
  name: string;
  group: THREE.Group;
  mesh: THREE.Mesh;
  pivot: THREE.Vector3;
}

export class FemaleMannequin {
  public rootGroup: THREE.Group;
  public parts: Map<BodyPartId, PartMeshInfo> = new Map();
  public jointGroups: Map<string, THREE.Group> = new Map();
  
  // Materials
  private baseMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'FemaleMannequin';

    // クリーンでソフトな素体マテリアル（光沢を抑えたクレイ調）
    this.baseMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5ede6,
      roughness: 0.5,
      metalness: 0.05,
      flatShading: false,
    });

    this.buildModel();
  }

  private createSmoothCapsule(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments: number = 24,
    heightSegments: number = 12
  ): THREE.BufferGeometry {
    // なめらかな丸みを持つシリンダー／カプセル形状
    const geom = new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      radialSegments,
      heightSegments,
      false
    );
    geom.computeVertexNormals();
    return geom;
  }

  private createHeadGeometry(): THREE.BufferGeometry {
    // 髪・顔パーツなし。女性特有のたまご型頭部（顎にかけて細身になる美しいシルエット）
    const points: THREE.Vector2[] = [];
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI;
      const y = Math.cos(theta) * 0.95; // 頭頂から顎先
      let r = Math.sin(theta);
      // 頭頂はやや丸く、顎先にかけて細くなるテーパー
      if (y < 0) {
        r *= 1.0 - Math.pow(-y / 0.95, 1.3) * 0.45;
      } else {
        r *= 0.9 + Math.pow(y / 0.95, 2.0) * 0.1;
      }
      points.push(new THREE.Vector2(Math.max(0.001, r * 0.72), y * 0.9));
    }
    const geom = new THREE.LatheGeometry(points, 32);
    // 前後に少し平たく、横から見てもバランスの良い形状にスケール
    geom.scale(1.0, 1.15, 1.12);
    geom.computeVertexNormals();
    return geom;
  }

  private createChestGeometry(): THREE.BufferGeometry {
    // 女性の胸部（背中の反りとバストラインのなだらかなボリューム）
    const geom = new THREE.CylinderGeometry(0.72, 0.58, 1.15, 28, 12);
    geom.scale(1.15, 1.0, 0.92);
    geom.computeVertexNormals();
    return geom;
  }

  private createWaistGeometry(): THREE.BufferGeometry {
    // ウエスト（くびれ）
    const geom = new THREE.CylinderGeometry(0.56, 0.65, 0.95, 24, 10);
    geom.scale(1.08, 1.0, 0.82);
    geom.computeVertexNormals();
    return geom;
  }

  private createPelvisGeometry(): THREE.BufferGeometry {
    // 骨盤・ヒップ（女性らしい丸みのあるライン）
    const geom = new THREE.CylinderGeometry(0.66, 0.76, 1.05, 28, 12);
    geom.scale(1.22, 1.0, 0.98);
    geom.computeVertexNormals();
    return geom;
  }

  private createLimbGeometry(
    rTop: number,
    rMid: number,
    rBot: number,
    length: number
  ): THREE.BufferGeometry {
    // 自然なテーパーと筋肉のふくらみを持つ手足
    const points: THREE.Vector2[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0 (top) to 1 (bot)
      const y = (0.5 - t) * length;
      let r = rTop * (1 - t) + rBot * t;
      // 中央やや上部に自然なふくらみ
      const bulge = Math.sin(t * Math.PI) * (rMid - (rTop + rBot) / 2);
      r += bulge;
      points.push(new THREE.Vector2(Math.max(0.02, r), y));
    }
    const geom = new THREE.LatheGeometry(points, 24);
    geom.computeVertexNormals();
    return geom;
  }

  private registerPart(
    id: BodyPartId,
    name: string,
    geom: THREE.BufferGeometry,
    parentGroup: THREE.Group,
    pivotOffset: THREE.Vector3,
    meshOffset: THREE.Vector3 = new THREE.Vector3(),
    rotationOffset: THREE.Euler = new THREE.Euler()
  ): { jointGroup: THREE.Group; meshGroup: THREE.Group } {
    // 各関節グループ（回転のピボットとなる点）
    const jointGroup = new THREE.Group();
    jointGroup.name = `joint_${id}`;
    jointGroup.position.copy(pivotOffset);
    parentGroup.add(jointGroup);

    // メッシュを含むグループ
    const meshGroup = new THREE.Group();
    meshGroup.name = `meshGroup_${id}`;

    const partMat = this.baseMaterial.clone();
    partMat.name = `mat_${id}`;
    const mesh = new THREE.Mesh(geom, partMat);
    mesh.name = `mesh_${id}`;
    mesh.position.copy(meshOffset);
    mesh.rotation.copy(rotationOffset);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { partId: id, partName: name };

    meshGroup.add(mesh);
    jointGroup.add(meshGroup);

    this.parts.set(id, {
      id,
      name,
      group: jointGroup,
      mesh,
      pivot: pivotOffset,
    });

    this.jointGroups.set(id, jointGroup);
    return { jointGroup, meshGroup };
  }

  private buildModel() {
    // 全体ルート位置設定（足元がy=0付近になるように配置）
    const baseHeight = 5.2;

    // --- 骨盤・ベース ---
    const pelvisJoint = new THREE.Group();
    pelvisJoint.name = 'joint_pelvis_root';
    pelvisJoint.position.set(0, baseHeight, 0);
    this.rootGroup.add(pelvisJoint);

    const pelvisGeom = this.createPelvisGeometry();
    const pelvis = this.registerPart(
      'pelvis',
      '骨盤・ヒップ',
      pelvisGeom,
      pelvisJoint,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.4, 0)
    );

    // --- ウエスト (腹部) ---
    const waistGeom = this.createWaistGeometry();
    const waist = this.registerPart(
      'waist',
      'ウエスト・腹部',
      waistGeom,
      pelvisJoint,
      new THREE.Vector3(0, 0.25, 0),
      new THREE.Vector3(0, 0.45, 0)
    );

    // --- 胸部 ---
    const chestGeom = this.createChestGeometry();
    const chest = this.registerPart(
      'chest',
      '胸部',
      chestGeom,
      waist.jointGroup,
      new THREE.Vector3(0, 0.9, 0),
      new THREE.Vector3(0, 0.55, 0)
    );

    // --- 首 ---
    const neckGeom = this.createSmoothCapsule(0.24, 0.28, 0.6, 20, 8);
    const neck = this.registerPart(
      'neck',
      '首',
      neckGeom,
      chest.jointGroup,
      new THREE.Vector3(0, 1.15, 0.05),
      new THREE.Vector3(0, 0.28, 0),
      new THREE.Euler(0.08, 0, 0)
    );

    // --- 頭部（目鼻口なしの美しい素体頭部） ---
    const headGeom = this.createHeadGeometry();
    this.registerPart(
      'head',
      '頭部',
      headGeom,
      neck.jointGroup,
      new THREE.Vector3(0, 0.55, 0),
      new THREE.Vector3(0, 0.72, 0)
    );

    // --- 左腕系 ---
    const upperArmGeomL = this.createLimbGeometry(0.26, 0.25, 0.2, 1.35);
    const upperArmL = this.registerPart(
      'upperArmL',
      '左上腕',
      upperArmGeomL,
      chest.jointGroup,
      new THREE.Vector3(0.85, 0.9, 0),
      new THREE.Vector3(0, -0.65, 0)
    );

    const forearmGeomL = this.createLimbGeometry(0.2, 0.19, 0.15, 1.25);
    const forearmL = this.registerPart(
      'forearmL',
      '左前腕',
      forearmGeomL,
      upperArmL.jointGroup,
      new THREE.Vector3(0, -1.35, 0),
      new THREE.Vector3(0, -0.6, 0)
    );

    const handGeomL = this.createSmoothCapsule(0.14, 0.08, 0.55, 16, 6);
    handGeomL.scale(1.2, 1.0, 0.5);
    this.registerPart(
      'handL',
      '左手',
      handGeomL,
      forearmL.jointGroup,
      new THREE.Vector3(0, -1.25, 0),
      new THREE.Vector3(0, -0.28, 0)
    );

    // --- 右腕系 ---
    const upperArmGeomR = this.createLimbGeometry(0.26, 0.25, 0.2, 1.35);
    const upperArmR = this.registerPart(
      'upperArmR',
      '右上腕',
      upperArmGeomR,
      chest.jointGroup,
      new THREE.Vector3(-0.85, 0.9, 0),
      new THREE.Vector3(0, -0.65, 0)
    );

    const forearmGeomR = this.createLimbGeometry(0.2, 0.19, 0.15, 1.25);
    const forearmR = this.registerPart(
      'forearmR',
      '右前腕',
      forearmGeomR,
      upperArmR.jointGroup,
      new THREE.Vector3(0, -1.35, 0),
      new THREE.Vector3(0, -0.6, 0)
    );

    const handGeomR = this.createSmoothCapsule(0.14, 0.08, 0.55, 16, 6);
    handGeomR.scale(1.2, 1.0, 0.5);
    this.registerPart(
      'handR',
      '右手',
      handGeomR,
      forearmR.jointGroup,
      new THREE.Vector3(0, -1.3, 0),
      new THREE.Vector3(0, -0.28, 0)
    );

    // --- 左脚系 ---
    const thighGeomL = this.createLimbGeometry(0.42, 0.44, 0.3, 2.2);
    const thighL = this.registerPart(
      'thighL',
      '左太もも',
      thighGeomL,
      pelvisJoint,
      new THREE.Vector3(0.48, -0.65, 0),
      new THREE.Vector3(0, -1.05, 0)
    );

    const shinGeomL = this.createLimbGeometry(0.3, 0.28, 0.18, 2.1);
    const shinL = this.registerPart(
      'shinL',
      '左すね',
      shinGeomL,
      thighL.jointGroup,
      new THREE.Vector3(0, -2.15, 0),
      new THREE.Vector3(0, -1.0, 0)
    );

    const footGeomL = this.createSmoothCapsule(0.18, 0.12, 0.8, 16, 6);
    footGeomL.scale(1.0, 0.6, 1.5);
    this.registerPart(
      'footL',
      '左足',
      footGeomL,
      shinL.jointGroup,
      new THREE.Vector3(0, -2.05, 0),
      new THREE.Vector3(0, -0.15, 0.25),
      new THREE.Euler(0.4, 0, 0)
    );

    // --- 右脚系 ---
    const thighGeomR = this.createLimbGeometry(0.42, 0.44, 0.3, 2.2);
    const thighR = this.registerPart(
      'thighR',
      '右太もも',
      thighGeomR,
      pelvisJoint,
      new THREE.Vector3(-0.48, -0.65, 0),
      new THREE.Vector3(0, -1.05, 0)
    );

    const shinGeomR = this.createLimbGeometry(0.3, 0.28, 0.18, 2.1);
    const shinR = this.registerPart(
      'shinR',
      '右すね',
      shinGeomR,
      thighR.jointGroup,
      new THREE.Vector3(0, -2.15, 0),
      new THREE.Vector3(0, -1.0, 0)
    );

    const footGeomR = this.createSmoothCapsule(0.18, 0.12, 0.8, 16, 6);
    footGeomR.scale(1.0, 0.6, 1.5);
    this.registerPart(
      'footR',
      '右足',
      footGeomR,
      shinR.jointGroup,
      new THREE.Vector3(0, -2.05, 0),
      new THREE.Vector3(0, -0.15, 0.25),
      new THREE.Euler(0.4, 0, 0)
    );
  }

  // ポーズの適用
  public applyPose(rotations: Record<string, [number, number, number]>) {
    // リセット
    this.jointGroups.forEach((group) => {
      group.rotation.set(0, 0, 0);
    });

    // 適用
    Object.entries(rotations).forEach(([partId, [x, y, z]]) => {
      const joint = this.jointGroups.get(partId);
      if (joint) {
        joint.rotation.set(x, y, z);
      }
    });

    this.rootGroup.updateMatrixWorld(true);
  }

  // 特定パーツの回転設定
  public setPartRotation(partId: BodyPartId, x: number, y: number, z: number) {
    const joint = this.jointGroups.get(partId);
    if (joint) {
      joint.rotation.set(x, y, z);
      this.rootGroup.updateMatrixWorld(true);
    }
  }

  // 現在の回転状態を取得
  public getCurrentPose(): Record<string, [number, number, number]> {
    const pose: Record<string, [number, number, number]> = {};
    this.jointGroups.forEach((group, key) => {
      pose[key] = [group.rotation.x, group.rotation.y, group.rotation.z];
    });
    return pose;
  }
}
