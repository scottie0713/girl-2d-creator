import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { saveAs } from 'file-saver';
import { BodyPartId } from '../../types';

export class VrmMannequin {
  public rootGroup: THREE.Group;
  public modelScene: THREE.Group | null = null;
  public bones: Map<string, THREE.Bone> = new Map();
  public bodyMeshes: THREE.SkinnedMesh[] = [];
  public hiddenMeshes: THREE.Object3D[] = [];
  public isLoaded: boolean = false;

  // ボーン名の標準マッピング（VRoid / VRM Humanoid標準）
  private boneMap: Record<BodyPartId, string[]> = {
    pelvis: ['J_Bip_C_Hips', 'Hips', 'hip', 'hips'],
    waist: ['J_Bip_C_Spine', 'Spine', 'spine'],
    chest: ['J_Bip_C_Chest', 'J_Bip_C_UpperChest', 'Chest', 'UpperChest', 'chest'],
    neck: ['J_Bip_C_Neck', 'Neck', 'neck'],
    head: ['J_Bip_C_Head', 'Head', 'head'],
    upperArmL: ['J_Bip_L_UpperArm', 'LeftUpperArm', 'LeftArm', 'upper_arm.L'],
    forearmL: ['J_Bip_L_LowerArm', 'LeftLowerArm', 'LeftForeArm', 'forearm.L'],
    handL: ['J_Bip_L_Hand', 'LeftHand', 'hand.L'],
    upperArmR: ['J_Bip_R_UpperArm', 'RightUpperArm', 'RightArm', 'upper_arm.R'],
    forearmR: ['J_Bip_R_LowerArm', 'RightLowerArm', 'RightForeArm', 'forearm.R'],
    handR: ['J_Bip_R_Hand', 'RightHand', 'hand.R'],
    thighL: ['J_Bip_L_UpperLeg', 'LeftUpperLeg', 'thigh.L'],
    shinL: ['J_Bip_L_LowerLeg', 'LeftLowerLeg', 'shin.L'],
    footL: ['J_Bip_L_Foot', 'LeftFoot', 'foot.L'],
    thighR: ['J_Bip_R_UpperLeg', 'RightUpperLeg', 'thigh.R'],
    shinR: ['J_Bip_R_LowerLeg', 'RightLowerLeg', 'shin.R'],
    footR: ['J_Bip_R_Foot', 'RightFoot', 'foot.R'],
  };

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'VrmMannequinRoot';
  }

  /**
   * VRM / GLB モデルを読み込んで素体化
   */
  public async loadFromUrl(url: string): Promise<void> {
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          this.processLoadedModel(gltf.scene);
          resolve();
        },
        undefined,
        (err) => {
          console.error('Failed to load VRM model:', err);
          reject(err);
        }
      );
    });
  }

  /**
   * File（ドラッグ＆ドロップ）からVRMモデルを読み込み
   */
  public async loadFromFile(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          this.processLoadedModel(gltf.scene);
          resolve();
        },
        (err) => {
          console.error('Failed to parse VRM model:', err);
          reject(err);
        }
      );
    });
  }

  private processLoadedModel(scene: THREE.Group) {
    // 既存モデルのクリア
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]);
    }
    this.bones.clear();
    this.bodyMeshes = [];
    this.hiddenMeshes = [];

    this.modelScene = scene;
    this.rootGroup.add(scene);

    // VRoidモデルのスケール・位置を整える（身長基準）
    // 通常VRoidは約1.4m〜1.6m。素体全体が見えやすいスケールに調整
    const bbox = new THREE.Box3().setFromObject(scene);
    const height = bbox.max.y - bbox.min.y;
    if (height > 0) {
      const targetHeight = 9.0;
      const scale = targetHeight / height;
      scene.scale.set(scale, scale, scale);
      // 足元をy=0に揃える
      scene.position.y = -bbox.min.y * scale;
    }

    // 1. ボーン（スケルトン）の収集
    scene.traverse((obj) => {
      if (obj instanceof THREE.Bone) {
        this.bones.set(obj.name, obj);
      }
    });

    // 2. メッシュの走査と「素体化（髪・服・目鼻口の除去）」
    scene.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh || obj instanceof THREE.Mesh) {
        const name = (obj.name || '').toLowerCase();
        const matName = Array.isArray(obj.material)
          ? obj.material.map((m) => m.name.toLowerCase()).join(' ')
          : (obj.material?.name || '').toLowerCase();

        // 髪の毛（Hair）の判定
        const isHair =
          name.includes('hair') ||
          name.includes('sec_hair') ||
          matName.includes('hair');

        // 服・靴・衣装（Outfit / Clothes）の判定
        const isCloth =
          name.includes('cloth') ||
          name.includes('tops') ||
          name.includes('bottoms') ||
          name.includes('outfit') ||
          name.includes('shoes') ||
          name.includes('dress') ||
          name.includes('jacket') ||
          name.includes('accessory') ||
          matName.includes('cloth') ||
          matName.includes('tops') ||
          matName.includes('bottoms') ||
          matName.includes('shoes');

        // 顔の目・眉・アイライン・ハイライトなどの装飾パーツ
        // （素体頭部のベース肌メッシュのみ残す）
        const isFaceFeature =
          name.includes('eyeline') ||
          name.includes('eyebrow') ||
          name.includes('eyeiris') ||
          name.includes('eye_') ||
          name.includes('mouth_') ||
          matName.includes('eyeline') ||
          matName.includes('eyebrow') ||
          matName.includes('eyeiris') ||
          matName.includes('eye_');

        if (isHair || isCloth || isFaceFeature) {
          // 髪・服・顔パーツを非表示
          obj.visible = false;
          this.hiddenMeshes.push(obj);
        } else {
          // 素体（Body / 肌）メッシュ
          obj.visible = true;
          obj.castShadow = true;
          obj.receiveShadow = true;

          // 素体マテリアルを美しいクレイ調の肌色に統一（陰影が明瞭になる）
          if (obj.material) {
            const cleanMat = new THREE.MeshStandardMaterial({
              color: 0xf6eae1,
              roughness: 0.45,
              metalness: 0.05,
              flatShading: false,
            });
            cleanMat.name = 'mat_vrm_clean_skin';
            obj.material = cleanMat;
          }

          if (obj instanceof THREE.SkinnedMesh) {
            this.bodyMeshes.push(obj);
          }
        }
      }
    });

    this.isLoaded = true;
    this.rootGroup.updateMatrixWorld(true);
  }

  // ボーンの取得
  public getBone(partId: BodyPartId): THREE.Bone | null {
    const candidates = this.boneMap[partId] || [];
    for (const name of candidates) {
      const bone = this.bones.get(name);
      if (bone) return bone;
    }
    return null;
  }

  // ポーズの適用
  public applyPose(rotations: Record<string, [number, number, number]>) {
    Object.entries(rotations).forEach(([partId, [x, y, z]]) => {
      const bone = this.getBone(partId as BodyPartId);
      if (bone) {
        bone.rotation.set(x, y, z);
      }
    });
    this.rootGroup.updateMatrixWorld(true);
  }

  // 特定パーツの回転設定
  public setPartRotation(partId: BodyPartId, x: number, y: number, z: number) {
    const bone = this.getBone(partId);
    if (bone) {
      bone.rotation.set(x, y, z);
      this.rootGroup.updateMatrixWorld(true);
    }
  }

  // 現在の全パーツのポーズ（オイラー回転）を取得
  public getCurrentPose(): Record<string, [number, number, number]> {
    const pose: Record<string, [number, number, number]> = {};
    const partIds: BodyPartId[] = [
      'pelvis', 'waist', 'chest', 'neck', 'head',
      'upperArmL', 'forearmL', 'handL',
      'upperArmR', 'forearmR', 'handR',
      'thighL', 'shinL', 'footL',
      'thighR', 'shinR', 'footR',
    ];
    partIds.forEach((partId) => {
      const bone = this.getBone(partId);
      if (bone) {
        pose[partId] = [bone.rotation.x, bone.rotation.y, bone.rotation.z];
      }
    });
    return pose;
  }


  /**
   * 髪・服・目鼻口を完全に除外した「素体のみの3Dモデル（.glb）」をエクスポートして保存
   */
  public exportCleanMannequinGlb(filename = 'vroid_clean_mannequin.glb') {
    if (!this.modelScene) return;

    // 非表示にした髪・服を一時的に切り離して、素体のみのクローンを作成
    const exportScene = this.modelScene.clone(true);

    // 不要メッシュの完全除去
    const toRemove: THREE.Object3D[] = [];
    exportScene.traverse((child) => {
      if (!child.visible) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((child) => {
      child.parent?.remove(child);
    });

    const exporter = new GLTFExporter();
    exporter.parse(
      exportScene,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
        saveAs(blob, filename);
      },
      (err) => {
        console.error('Failed to export clean mannequin GLB:', err);
      },
      { binary: true }
    );
  }
}
