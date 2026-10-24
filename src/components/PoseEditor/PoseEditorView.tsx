import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VrmMannequin } from '../../utils/three/VrmMannequin';
import { StateStorage } from '../../utils/storage/StateStorage';
import { POSE_PRESETS } from '../../utils/three/PosePresets';
import { BodyPartId, PosePreset, Saved3DState } from '../../types';
import { Camera, RotateCcw, Sparkles, Sliders, Upload, Download, UserCheck, CheckCircle2 } from 'lucide-react';

interface PoseEditorViewProps {
  onInitialized: (
    vrmMannequin: VrmMannequin,
    camera: THREE.PerspectiveCamera,
    saveFn: () => void
  ) => void;
  onNextStep: () => void;
}

export const PoseEditorView: React.FC<PoseEditorViewProps> = ({ onInitialized, onNextStep }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<VrmMannequin | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activePreset, setActivePreset] = useState<string>('s-curve');
  const [fov, setFov] = useState<number>(38);
  const [selectedPart, setSelectedPart] = useState<BodyPartId>('head');
  const [partRotations, setPartRotations] = useState<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });
  const [isLoadingVrm, setIsLoadingVrm] = useState<boolean>(true);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // 3Dモデルの位置・ポーズ・カメラの保存
  const saveCurrent3DState = () => {
    if (!cameraRef.current || !controlsRef.current || !vrmRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    const vrm = vrmRef.current;

    const state: Saved3DState = {
      camera: {
        fov: cam.fov,
        position: [cam.position.x, cam.position.y, cam.position.z],
        target: [ctrl.target.x, ctrl.target.y, ctrl.target.z],
      },
      pose: vrm.getCurrentPose(),
      timestamp: Date.now(),
    };

    StateStorage.save3DState(state);
    const now = new Date();
    setLastSavedTime(
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    );
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131620);
    scene.fog = new THREE.FogExp2(0x131620, 0.04);

    // 2. Camera
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

    // カメラ変更時に保存
    controls.addEventListener('change', () => {
      saveCurrent3DState();
    });

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
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

    // 6. Ground Grid
    const grid = new THREE.GridHelper(20, 20, 0x3d445c, 0x222638);
    grid.position.y = 0;
    scene.add(grid);

    // 7. VRM素体
    const vrmMannequin = new VrmMannequin();
    scene.add(vrmMannequin.rootGroup);
    vrmRef.current = vrmMannequin;

    onInitialized(vrmMannequin, camera, saveCurrent3DState);

    // squoskie-1_2.vrm（下着完全素体）の自動ロード＆保存状態の復元
    setIsLoadingVrm(true);
    vrmMannequin
      .loadFromUrl('/models/squoskie-1_2.vrm')
      .then(() => {
        setIsLoadingVrm(false);

        // 前回保存された状態があれば復元
        const savedState = StateStorage.load3DState();
        if (savedState) {
          // カメラ復元
          camera.fov = savedState.camera.fov;
          setFov(savedState.camera.fov);
          camera.position.set(...savedState.camera.position);
          controls.target.set(...savedState.camera.target);
          camera.updateProjectionMatrix();
          controls.update();

          // ポーズ復元
          if (savedState.pose && Object.keys(savedState.pose).length > 0) {
            vrmMannequin.applyPose(savedState.pose);
          }
        } else {
          // 初期ポーズ (S字立ち)
          const initialPreset = POSE_PRESETS.find((p) => p.id === 's-curve');
          if (initialPreset) {
            vrmMannequin.applyPose(initialPreset.rotations);
          }
        }

        saveCurrent3DState();
      })
      .catch((err) => {
        console.error('VRM load failed:', err);
        setIsLoadingVrm(false);
      });

    // 8. 定期自動保存タイマー (2.5秒ごと)
    const autoSaveInterval = setInterval(() => {
      saveCurrent3DState();
    }, 2500);

    // 9. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

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
      clearInterval(autoSaveInterval);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ファイルアップロード
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vrmRef.current) return;

    setIsLoadingVrm(true);
    vrmRef.current
      .loadFromFile(file)
      .then(() => {
        setIsLoadingVrm(false);
        const initialPreset = POSE_PRESETS.find((p) => p.id === activePreset) || POSE_PRESETS[0];
        vrmRef.current?.applyPose(initialPreset.rotations);
        saveCurrent3DState();
      })
      .catch((err) => {
        setIsLoadingVrm(false);
        alert('VRMファイルの読み込みに失敗しました: ' + err.message);
      });
  };

  // 素体のみのGLBエクスポート
  const handleExportCleanGlb = () => {
    if (vrmRef.current && vrmRef.current.isLoaded) {
      vrmRef.current.exportCleanMannequinGlb('squoskie_clean_mannequin.glb');
    }
  };

  // FOV更新
  const handleFovChange = (newFov: number) => {
    setFov(newFov);
    if (cameraRef.current) {
      cameraRef.current.fov = newFov;
      cameraRef.current.updateProjectionMatrix();
      saveCurrent3DState();
    }
  };

  // プリセットポーズ適用
  const handleApplyPreset = (preset: PosePreset) => {
    setActivePreset(preset.id);
    if (vrmRef.current) {
      vrmRef.current.applyPose(preset.rotations);
      saveCurrent3DState();
    }
  };

  // アングルプリセット変更
  const setCameraAngle = (type: 'front' | 'aori' | 'fukan' | 'three-quarter') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    switch (type) {
      case 'front':
        cam.position.set(0, 5.2, 9.5);
        ctrl.target.set(0, 5.2, 0);
        break;
      case 'aori':
        cam.position.set(0, 1.8, 8.5);
        ctrl.target.set(0, 5.0, 0);
        break;
      case 'fukan':
        cam.position.set(0, 8.8, 8.0);
        ctrl.target.set(0, 4.8, 0);
        break;
      case 'three-quarter':
        cam.position.set(5.5, 5.2, 7.5);
        ctrl.target.set(0, 5.0, 0);
        break;
    }
    ctrl.update();
    saveCurrent3DState();
  };

  // 関節手動回転
  const handleRotationChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const updated = { ...partRotations, [axis]: value };
    setPartRotations(updated);
    if (vrmRef.current) {
      vrmRef.current.setPartRotation(selectedPart, updated.x, updated.y, updated.z);
      saveCurrent3DState();
    }
  };

  // 「次へ」ボタン押下時：保存して次画面へ
  const handleProceedToNext = () => {
    saveCurrent3DState();
    onNextStep();
  };

  return (
    <div className="pose-editor-container">
      {/* 3D WebGL Canvas */}
      <div className="canvas-3d-wrapper" ref={mountRef}>
        <div className="floating-3d-hints">
          <span>ドラッグ: 視点回転 | 右ドラッグ: 平行移動 | スクロール: ズーム</span>
        </div>

        {/* 自動保存インジケータ */}
        {lastSavedTime && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              background: 'rgba(22, 25, 34, 0.75)',
              backdropFilter: 'blur(8px)',
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <CheckCircle2 size={13} />
            <span>3D状態を自動保存済み ({lastSavedTime})</span>
          </div>
        )}

        {/* VRMローディング表示 */}
        {isLoadingVrm && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(22, 25, 34, 0.85)',
              padding: '16px 24px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: 'var(--text-main)',
            }}
          >
            <Sparkles className="animate-spin" size={20} color="var(--primary)" />
            <span>VRoid素体（squoskie）を読み込み・素体化中...</span>
          </div>
        )}
      </div>

      {/* 右側：ポーズ・素体設定パネル */}
      <div className="side-panel">
        <div className="panel-header">
          <span>1. 3Dポージング設定</span>
          <button
            onClick={() => handleApplyPreset(POSE_PRESETS[0])}
            title="ポーズ初期化"
            style={{ display: 'flex', alignItems: 'center', color: 'var(--text-sub)' }}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* 次へ進むアクションボタン（パネル最上部にも目立つように配置） */}
        <div style={{ padding: '16px 16px 0' }}>
          <button
            className="btn-primary"
            onClick={handleProceedToNext}
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: '0.92rem' }}
          >
            <span>保存して2D確認画面へ ➔</span>
          </button>
        </div>

        {/* モデル管理 & 素体エクスポートセクション */}
        <div className="panel-section">
          <div className="section-title">
            <UserCheck size={14} style={{ display: 'inline', marginRight: 6 }} />
            素体モデル管理
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn-secondary"
              onClick={handleExportCleanGlb}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.82rem',
                color: 'var(--accent-cyan)',
                borderColor: 'rgba(6,182,212,0.3)',
                background: 'rgba(6,182,212,0.08)',
              }}
              title="髪・服を除去した素体だけのGLBファイルをダウンロード"
            >
              <Download size={15} />
              <span>素体モデル保存 (.glb)</span>
            </button>

            <button
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              <Upload size={14} />
              <span>別のVRM/GLBを読込</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".vrm,.glb,.gltf"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>
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
            ポーズプリセット
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
            関節の手動微調整 (FK)
          </div>

          <select
            value={selectedPart}
            onChange={(e) => {
              const part = e.target.value as BodyPartId;
              setSelectedPart(part);
              setPartRotations({ x: 0, y: 0, z: 0 });
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
