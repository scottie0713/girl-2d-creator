import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { EditorMode, ExtractedVectorData } from './types';
import { VrmMannequin } from './utils/three/VrmMannequin';
import { VectorExtractor } from './utils/three/VectorExtractor';
import { PaperManager } from './utils/vector/PaperManager';
import { ExportManager } from './utils/export/ExportManager';
import { Header } from './components/Header';
import { PoseEditorView } from './components/PoseEditor/PoseEditorView';
import { PreviewScreenView } from './components/PreviewScreen/PreviewScreenView';
import { VectorStudioView } from './components/VectorStudio/VectorStudioView';
import { ExportModal } from './components/ExportModal';

export const App: React.FC = () => {
  const [mode, setMode] = useState<EditorMode>('3d-pose');
  const [vectorData, setVectorData] = useState<ExtractedVectorData | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const vrmMannequinRef = useRef<VrmMannequin | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const save3DStateFnRef = useRef<(() => void) | null>(null);
  const paperManagerRef = useRef<PaperManager | null>(null);

  // 3Dシーン初期化完了時
  const handle3DInitialized = (
    vrmMannequin: VrmMannequin,
    camera: THREE.PerspectiveCamera,
    saveFn: () => void
  ) => {
    vrmMannequinRef.current = vrmMannequin;
    cameraRef.current = camera;
    save3DStateFnRef.current = saveFn;
  };

  // 画面1 ➔ 画面2: 3D状態を保存し、2D構図確認画面へ遷移
  const handleProceedToPreview = () => {
    if (!cameraRef.current || !vrmMannequinRef.current || !vrmMannequinRef.current.isLoaded) return;

    // 1. 3D状態の確実な保存
    if (save3DStateFnRef.current) {
      save3DStateFnRef.current();
    }

    // 2. 2Dベクター＆下地塗りの抽出
    const extracted = VectorExtractor.extract(
      vrmMannequinRef.current,
      cameraRef.current,
      860,
      1100
    );

    if (!extracted) return;

    setVectorData(extracted);
    setMode('2d-preview');
  };

  // 画面2 ➔ 画面3: レイヤーファイルを自動保存し、2D調整スタジオへ遷移
  const handleConfirmAndProceedToStudio = async (format: 'psd' | 'svg' | 'zip') => {
    if (!vectorData) return;

    // 一時的なオフスクリーンCanvasを使ってレイヤーファイルを生成・保存
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 860 * 2;
    offscreenCanvas.height = 1100 * 2;
    const tempManager = new PaperManager(offscreenCanvas);
    tempManager.loadExtractedData(vectorData);

    try {
      if (format === 'psd') {
        await ExportManager.exportPSD(tempManager, 'squoskie_2d_layers.psd');
      } else if (format === 'svg') {
        ExportManager.exportSVG(tempManager, 'squoskie_2d_vector.svg');
      } else if (format === 'zip') {
        await ExportManager.exportPNGZip(tempManager, 'squoskie_2d_png_layers.zip');
      }
    } catch (err) {
      console.warn('Auto export error:', err);
    }

    // 画面3へ遷移
    setMode('2d-studio');

    if (paperManagerRef.current) {
      paperManagerRef.current.loadExtractedData(vectorData);
    }
  };

  // 画面2 ➔ 画面1へ戻る
  const handleBackToPose = () => {
    setMode('3d-pose');
  };

  return (
    <div className="app-container">
      {/* 共通ヘッダー（3ステップ切り替え） */}
      <Header
        mode={mode}
        onModeChange={(newMode) => {
          if (newMode === '3d-pose') {
            setMode('3d-pose');
          } else if (newMode === '2d-preview') {
            if (vectorData) {
              setMode('2d-preview');
            } else {
              handleProceedToPreview();
            }
          } else if (newMode === '2d-studio') {
            if (vectorData) {
              setMode('2d-studio');
            } else {
              handleProceedToPreview();
            }
          }
        }}
        onProceedToPreview={handleProceedToPreview}
        onProceedToStudio={() => handleConfirmAndProceedToStudio('psd')}
        onBackToPose={handleBackToPose}
        onOpenExport={() => setIsExportOpen(true)}
        has2DData={vectorData !== null}
      />

      {/* メインワークスペース（完全独立3画面） */}
      <main className="content-area">
        {/* 画面1: 3Dポージング画面（裏でWebGLコンテキストを破棄せず保持） */}
        <div style={{ width: '100%', height: '100%', display: mode === '3d-pose' ? 'block' : 'none' }}>
          <PoseEditorView
            onInitialized={handle3DInitialized}
            onNextStep={handleProceedToPreview}
          />
        </div>

        {/* 画面2: 2D構図確認画面（完全独立画面） */}
        <div style={{ width: '100%', height: '100%', display: mode === '2d-preview' ? 'block' : 'none' }}>
          <PreviewScreenView
            vectorData={vectorData}
            onBackToPose={handleBackToPose}
            onConfirmAndProceed={handleConfirmAndProceedToStudio}
          />
        </div>

        {/* 画面3: 2Dベクター＆嘘パース調整画面（完全独立画面） */}
        <div style={{ width: '100%', height: '100%', display: mode === '2d-studio' ? 'block' : 'none' }}>
          <VectorStudioView
            vectorData={vectorData}
            onManagerReady={(manager) => {
              paperManagerRef.current = manager;
              if (vectorData) {
                manager.loadExtractedData(vectorData);
              }
            }}
          />
        </div>
      </main>

      {/* 画面3用のレイヤー再保存モーダル */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        paperManager={paperManagerRef.current}
      />
    </div>
  );
};
export default App;
