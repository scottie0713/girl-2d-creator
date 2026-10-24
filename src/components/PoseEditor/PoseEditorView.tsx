import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FemaleMannequin } from '../../utils/three/MannequinModel';
import { POSE_PRESETS } from '../../utils/three/PosePresets';
import { BodyPartId, PosePreset } from '../../types';
import { Camera, RotateCcw, Eye, Sparkles, Sliders } from 'lucide-react';

interface PoseEditorViewProps {
  onInitialized: (mannequin: FemaleMannequin, camera: THREE.PerspectiveCamera) => void;
}

export const PoseEditorView: React.FC<PoseEditorViewProps> = ({ onInitialized }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mannequinRef = useRef<FemaleMannequin | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [activePreset, setActivePreset] = useState<string>('s-curve');
  const [fov, setFov] = useState<number>(38); // 35-40mm近傍が自然なポートレート画角
  const [selectedPart, setSelectedPart] = useState<BodyPartId>('head');
  const [partRotations, setPartRotations] = useState<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131620);
    scene.fog = new THREE.FogExp2(0x131620, 0.04);

    // 2. Camera (女性素体の胸元・顔が中央付近になるよう設定)
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 100);
    camera.position.set(0, 5.0, 9.5);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 5.0, 0);
    controls.maxDistance = 25;
    controls.minDistance = 2;
    controlsRef.current = controls;

    // 5. Lighting (女性素体の曲線を美しく陰影付けする3点照明)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff6ed, 1.4);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x94b9ff, 0.6);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffa1c9, 0.5);
    rimLight.position.set(0, -3, -6);
    scene.add(rimLight);

    // 6. Ground Grid (薄いグリッドで空間認識をサポート)
    const grid = new THREE.GridHelper(20, 20, 0x3d445c, 0x222638);
    grid.position.y = 0;
    scene.add(grid);

    // 7. Female Mannequin
    const mannequin = new FemaleMannequin();
    scene.add(mannequin.rootGroup);
    mannequinRef.current = mannequin;

    // 初期ポーズ適用 (S字立ち)
    const initialPreset = POSE_PRESETS.find((p) => p.id === 's-curve');
    if (initialPreset) {
      mannequin.applyPose(initialPreset.rotations);
    }

    onInitialized(mannequin, camera);

    // 8. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // FOV更新 (パースの強さ)
  const handleFovChange = (newFov: number) => {
    setFov(newFov);
    if (cameraRef.current) {
      cameraRef.current.fov = newFov;
      cameraRef.current.updateProjectionMatrix();
    }
  };

  // プリセットポーズ選択
  const handleApplyPreset = (preset: PosePreset) => {
    setActivePreset(preset.id);
    if (mannequinRef.current) {
      mannequinRef.current.applyPose(preset.rotations);
      const cur = mannequinRef.current.getCurrentPose();
      const partRot = cur[selectedPart] || [0, 0, 0];
      setPartRotations({ x: partRot[0], y: partRot[1], z: partRot[2] });
    }
  };

  // アングルプリセット変更
  const setCameraAngle = (type: 'front' | 'aori' | 'fukan' | 'three-quarter') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    switch (type) {
      case 'front': // 正面目線
        cam.position.set(0, 5.2, 9.5);
        ctrl.target.set(0, 5.2, 0);
        break;
      case 'aori': // アオリ（ローアングル、脚長・迫力効果）
        cam.position.set(0, 1.8, 8.5);
        ctrl.target.set(0, 5.0, 0);
        break;
      case 'fukan': // 俯瞰（ハイアングル、頭部強調・小顔効果）
        cam.position.set(0, 8.8, 8.0);
        ctrl.target.set(0, 4.8, 0);
        break;
      case 'three-quarter': // ナナメ45度（王道の立体感）
        cam.position.set(5.5, 5.2, 7.5);
        ctrl.target.set(0, 5.0, 0);
        break;
    }
    ctrl.update();
  };

  // 関節手動回転
  const handleRotationChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const updated = { ...partRotations, [axis]: value };
    setPartRotations(updated);
    if (mannequinRef.current) {
      mannequinRef.current.setPartRotation(selectedPart, updated.x, updated.y, updated.z);
    }
  };

  return (
    <div className="pose-editor-container">
      {/* 3D WebGL Canvas */}
      <div className="canvas-3d-wrapper" ref={mountRef}>
        <div className="floating-3d-hints">
          <span>ドラッグ: 視点回転 | 右ドラッグ: 平行移動 | スクロール: ズーム</span>
        </div>
      </div>

      {/* 右側：ポーズ・カメラ設定パネル */}
      <div className="side-panel">
        <div className="panel-header">
          <span>3Dポージング設定</span>
          <button
            onClick={() => handleApplyPreset(POSE_PRESETS[0])}
            title="ポーズ初期化"
            style={{ display: 'flex', alignItems: 'center', color: 'var(--text-sub)' }}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* カメラ・画角アングル設定 */}
        <div className="panel-section">
          <div className="section-title">
            <Camera size={14} style={{ display: 'inline', marginRight: 6 }} />
            カメラ・画角アングル
          </div>

          <div className="angle-btn-group" style={{ marginBottom: 16 }}>
            <button className="angle-btn" onClick={() => setCameraAngle('front')}>
              正面アイレベル
            </button>
            <button className="angle-btn" onClick={() => setCameraAngle('three-quarter')}>
              ナナメ 45°
            </button>
            <button className="angle-btn" onClick={() => setCameraAngle('aori')}>
              アオリ (下から迫力)
            </button>
            <button className="angle-btn" onClick={() => setCameraAngle('fukan')}>
              フカン (上から小顔)
            </button>
          </div>

          <div className="slider-row">
            <div className="slider-label">
              <span>レンズ画角 (FOV)</span>
              <span>{fov}° {fov < 35 ? '(望遠/平面的)' : fov > 50 ? '(広角/パース強調)' : '(標準)'}</span>
            </div>
            <input
              type="range"
              min="20"
              max="75"
              value={fov}
              onChange={(e) => handleFovChange(Number(e.target.value))}
              className="slider-input"
            />
          </div>
        </div>

        {/* プリセットポーズ一覧 */}
        <div className="panel-section" style={{ flex: 1 }}>
          <div className="section-title">
            <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
            ポーズプリセット (女性素体)
          </div>

          <div className="preset-grid">
            {POSE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`preset-card ${activePreset === preset.id ? 'active' : ''}`}
                style={{
                  borderLeft: activePreset === preset.id ? '3px solid var(--primary)' : undefined,
                  background: activePreset === preset.id ? 'var(--bg-active)' : undefined,
                }}
                onClick={() => handleApplyPreset(preset)}
              >
                <div className="preset-name">{preset.name}</div>
                <div className="preset-desc">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 微調整スライダー（部位FK） */}
        <div className="panel-section">
          <div className="section-title">
            <Sliders size={14} style={{ display: 'inline', marginRight: 6 }} />
            部位の手動微調整 (FK)
          </div>

          <select
            value={selectedPart}
            onChange={(e) => {
              const part = e.target.value as BodyPartId;
              setSelectedPart(part);
              if (mannequinRef.current) {
                const cur = mannequinRef.current.getCurrentPose();
                const rot = cur[part] || [0, 0, 0];
                setPartRotations({ x: rot[0], y: rot[1], z: rot[2] });
              }
            }}
            style={{
              width: '100%',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 12,
            }}
          >
            <option value="head">頭部 (角度・向き)</option>
            <option value="neck">首 (傾き)</option>
            <option value="chest">胸部 (反り・ひねり)</option>
            <option value="waist">ウエスト (くびれひねり)</option>
            <option value="pelvis">骨盤 (傾き)</option>
            <option value="upperArmL">左上腕</option>
            <option value="forearmL">左前腕</option>
            <option value="upperArmR">右上腕</option>
            <option value="forearmR">右前腕</option>
            <option value="thighL">左太もも</option>
            <option value="shinL">左すね</option>
            <option value="thighR">右太もも</option>
            <option value="shinR">右すね</option>
          </select>

          <div className="slider-row">
            <div className="slider-label">
              <span>X軸 (前後傾き)</span>
              <span>{(partRotations.x * (180 / Math.PI)).toFixed(0)}°</span>
            </div>
            <input
              type="range"
              min="-1.5"
              max="1.5"
              step="0.05"
              value={partRotations.x}
              onChange={(e) => handleRotationChange('x', Number(e.target.value))}
              className="slider-input"
            />
          </div>

          <div className="slider-row">
            <div className="slider-label">
              <span>Y軸 (左右ひねり)</span>
              <span>{(partRotations.y * (180 / Math.PI)).toFixed(0)}°</span>
            </div>
            <input
              type="range"
              min="-1.5"
              max="1.5"
              step="0.05"
              value={partRotations.y}
              onChange={(e) => handleRotationChange('y', Number(e.target.value))}
              className="slider-input"
            />
          </div>

          <div className="slider-row">
            <div className="slider-label">
              <span>Z軸 (横倒し)</span>
              <span>{(partRotations.z * (180 / Math.PI)).toFixed(0)}°</span>
            </div>
            <input
              type="range"
              min="-1.5"
              max="1.5"
              step="0.05"
              value={partRotations.z}
              onChange={(e) => handleRotationChange('z', Number(e.target.value))}
              className="slider-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
