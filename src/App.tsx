import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { EditorMode, ExtractedVectorData } from './types';
import { FemaleMannequin } from './utils/three/MannequinModel';
import { VectorExtractor } from './utils/three/VectorExtractor';
import { PaperManager } from './utils/vector/PaperManager';
import { Header } from './components/Header';
import { PoseEditorView } from './components/PoseEditor/PoseEditorView';
import { VectorStudioView } from './components/VectorStudio/VectorStudioView';
import { ExportModal } from './components/ExportModal';

export const App: React.FC = () => {
  const [mode, setMode] = useState<EditorMode>('3d-pose');
  const [vectorData, setVectorData] = useState<ExtractedVectorData | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const mannequinRef = useRef<FemaleMannequin | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const paperManagerRef = useRef<PaperManager | null>(null);

  // 3Dシーン初期化完了時
  const handle3DInitialized = (mannequin: FemaleMannequin, camera: THREE.PerspectiveCamera) => {
    mannequinRef.current = mannequin;
    cameraRef.current = camera;
  };

  // 3Dポーズから2Dベクター＆下地塗りを抽出して2D編集画面へ遷移
  const handleGenerate2D = () => {
    if (!mannequinRef.current || !cameraRef.current) return;

    // 2Dキャンバスサイズ (860x1100) に合わせて抽出
    const extracted = VectorExtractor.extract(
      mannequinRef.current,
      cameraRef.current,
      860,
      1100
    );

    setVectorData(extracted);
    setMode('2d-vector');

    if (paperManagerRef.current) {
      paperManagerRef.current.loadExtractedData(extracted);
    }
  };

  return (
    <div className="app-container">
      {/* 共通ヘッダー */}
      <Header
        mode={mode}
        onModeChange={setMode}
        onGenerate2D={handleGenerate2D}
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
