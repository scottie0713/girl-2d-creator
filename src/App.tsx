import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { EditorMode, ExtractedVectorData } from './types';
import { VrmMannequin } from './utils/three/VrmMannequin';
import { VectorExtractor } from './utils/three/VectorExtractor';
import { PaperManager } from './utils/vector/PaperManager';
import { Header } from './components/Header';
import { PoseEditorView } from './components/PoseEditor/PoseEditorView';
import { VectorStudioView } from './components/VectorStudio/VectorStudioView';
import { PreviewModal } from './components/PreviewModal';
import { ExportModal } from './components/ExportModal';

export const App: React.FC = () => {
  const [mode, setMode] = useState<EditorMode>('3d-pose');
  const [vectorData, setVectorData] = useState<ExtractedVectorData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const vrmMannequinRef = useRef<VrmMannequin | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const paperManagerRef = useRef<PaperManager | null>(null);

  // 3Dシーン初期化完了時
  const handle3DInitialized = (
    vrmMannequin: VrmMannequin,
    camera: THREE.PerspectiveCamera
  ) => {
    vrmMannequinRef.current = vrmMannequin;
    cameraRef.current = camera;
  };

  // 3Dポーズから2Dベクターを抽出してプレビューを開く
  const handleOpenPreview = () => {
    if (!cameraRef.current || !vrmMannequinRef.current || !vrmMannequinRef.current.isLoaded) return;

    const extracted = VectorExtractor.extract(
      vrmMannequinRef.current,
      cameraRef.current,
      860,
      1100
    );

    if (!extracted) return;

    setVectorData(extracted);
    setIsPreviewOpen(true);
  };

  // プレビューで構図OK時 ➔ 2Dベクタースタジオへ進む
  const handleConfirmPreview = () => {
    setIsPreviewOpen(false);
    setMode('2d-vector');

    if (paperManagerRef.current && vectorData) {
      paperManagerRef.current.loadExtractedData(vectorData);
    }
  };

  // 3Dに戻る
  const handleBackTo3D = () => {
    setIsPreviewOpen(false);
    setMode('3d-pose');
  };

  return (
    <div className="app-container">
      {/* 共通ヘッダー */}
      <Header
        mode={mode}
        onModeChange={(newMode) => {
          if (newMode === '2d-vector' && !vectorData) {
            handleOpenPreview();
          } else {
            setMode(newMode);
          }
        }}
        onGenerate2D={handleOpenPreview}
        onOpenExport={() => setIsExportOpen(true)}
        has2DData={vectorData !== null}
      />

      {/* メインワークスペース */}
      <main className="content-area">
        {/* Step 1: 3Dポージング画面（裏でWebGLコンテキストを保持） */}
        <div style={{ width: '100%', height: '100%', display: mode === '3d-pose' ? 'block' : 'none' }}>
          <PoseEditorView onInitialized={handle3DInitialized} />
        </div>

        {/* Step 2: 2Dベクター＆嘘パース調整画面 */}
        <div style={{ width: '100%', height: '100%', display: mode === '2d-vector' ? 'block' : 'none' }}>
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

      {/* Step 1.5: 2D化プレビュー＆構図確認モーダル */}
      <PreviewModal
        isOpen={isPreviewOpen}
        vectorData={vectorData}
        onConfirm={handleConfirmPreview}
        onBackTo3D={handleBackTo3D}
      />

      {/* レイヤー保存（PSD/SVG/PNG）モーダル */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        paperManager={paperManagerRef.current}
      />
    </div>
  );
};
export default App;
