import React, { useEffect, useRef, useState } from 'react';
import { PaperManager } from '../../utils/vector/PaperManager';
import { ExtractedVectorData, LayerItem, VectorTool } from '../../types';
import {
  MousePointer,
  Sparkles,
  Maximize2,
  Sliders,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Smile,
  Layers,
  Palette,
  CheckCircle2,
} from 'lucide-react';

interface VectorStudioViewProps {
  vectorData: ExtractedVectorData | null;
  onManagerReady: (manager: PaperManager) => void;
}

export const VectorStudioView: React.FC<VectorStudioViewProps> = ({
  vectorData,
  onManagerReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<PaperManager | null>(null);

  const [currentTool, setCurrentTool] = useState<VectorTool>('select');
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [strokeWidth, setStrokeWidth] = useState<number>(2.2);
  const [brushRadius, setBrushRadius] = useState<number>(45);
  const [showFaceGuide, setShowFaceGuide] = useState<boolean>(true);
  const [skinColor, setSkinColor] = useState<string>('#fcf4ed');

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    // キャンバス解像度の最適化 (900x1200の縦長ポートレートイラスト比率)
    const dpr = Math.min(window.devicePixelRatio, 2);
    const logicalW = 860;
    const logicalH = 1100;
    canvas.width = logicalW * dpr;
    canvas.height = logicalH * dpr;
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;

    const manager = new PaperManager(canvas, {
      onLayersChange: (newLayers) => setLayers(newLayers),
      onSelectionChange: (id) => setSelectedLayerId(id),
    });
    managerRef.current = manager;
    onManagerReady(manager);

    if (vectorData) {
      manager.loadExtractedData(vectorData);
    }
  }, [vectorData]);

  const handleToolChange = (tool: VectorTool) => {
    setCurrentTool(tool);
    if (managerRef.current) {
      managerRef.current.setTool(tool);
    }
  };

  const handleStrokeWidthChange = (val: number) => {
    setStrokeWidth(val);
    if (managerRef.current) {
      managerRef.current.setStrokeWidth(val);
    }
  };

  const handleBrushRadiusChange = (val: number) => {
    setBrushRadius(val);
    if (managerRef.current) {
      managerRef.current.setBrushRadius(val);
    }
  };

  const toggleFaceGuide = () => {
    const nextState = !showFaceGuide;
    setShowFaceGuide(nextState);
    if (managerRef.current) {
      managerRef.current.toggleFaceGuide(nextState);
    }
  };

  const handleLayerVisibility = (layerId: string, currentVal: boolean) => {
    if (managerRef.current) {
      managerRef.current.setLayerVisibility(layerId, !currentVal);
    }
  };

  const handleLayerLock = (layerId: string, currentVal: boolean) => {
    if (managerRef.current) {
      managerRef.current.setLayerLocked(layerId, !currentVal);
    }
  };

  const handleSkinColorChange = (hex: string) => {
    setSkinColor(hex);
    if (managerRef.current) {
      // 全ての下地レイヤーに適用
      layers
        .filter((l) => l.type === 'fill')
        .forEach((l) => {
          managerRef.current?.setLayerColor(l.id, hex);
        });
    }
  };

  return (
    <div className="vector-studio-container">
      {/* 左側ツールバー */}
      <div className="tool-sidebar">
        <button
          className={`tool-btn ${currentTool === 'select' ? 'active' : ''}`}
          onClick={() => handleToolChange('select')}
          title="選択・アンカーポイント/ベジエ変形 (V)"
        >
          <MousePointer size={18} />
        </button>

        <button
          className={`tool-btn ${currentTool === 'liquify' ? 'active' : ''}`}
          onClick={() => handleToolChange('liquify')}
          title="ゆがみブラシ (輪郭や嘘パースの整形) (W)"
        >
          <Sparkles size={18} />
        </button>

        <button
          className={`tool-btn ${currentTool === 'warp' ? 'active' : ''}`}
          onClick={() => handleToolChange('warp')}
          title="パペット変形・部位の誇張拡大 (E)"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {/* 中央キャンバス＆上部プロパティバー */}
      <div className="vector-canvas-wrapper">
        {/* 上部フローティング設定バー */}
        <div className="floating-properties-bar">
          {currentTool === 'liquify' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ゆがみブラシサイズ:</span>
              <input
                type="range"
                min="15"
                max="120"
                value={brushRadius}
                onChange={(e) => handleBrushRadiusChange(Number(e.target.value))}
                style={{ width: 90 }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{brushRadius}px</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>線画の太さ:</span>
              <input
                type="range"
                min="0.8"
                max="6.0"
                step="0.2"
                value={strokeWidth}
                onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                style={{ width: 90 }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{strokeWidth}px</span>
            </div>
          )}

          <div style={{ width: 1, height: 18, background: 'var(--border-color)' }} />

          {/* 下地カラー選択 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>下地肌色:</span>
            <input
              type="color"
              value={skinColor}
              onChange={(e) => handleSkinColorChange(e.target.value)}
              style={{
                width: 24,
                height: 24,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
          </div>

          <div style={{ width: 1, height: 18, background: 'var(--border-color)' }} />

          {/* 顔の十字アタリ線トグル */}
          <button
            className={`btn-secondary ${showFaceGuide ? 'active' : ''}`}
            onClick={toggleFaceGuide}
            style={{
              padding: '4px 10px',
              fontSize: '0.8rem',
              borderColor: showFaceGuide ? 'var(--accent-cyan)' : undefined,
              color: showFaceGuide ? 'var(--accent-cyan)' : 'var(--text-muted)',
            }}
            title="目・鼻・口の配置目安となる十字ガイド線の表示切替"
          >
            <Smile size={14} />
            <span>顔の十字アタリ線: {showFaceGuide ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Paper.js Canvas */}
        <canvas ref={canvasRef} className="vector-canvas" />
      </div>

      {/* 右側レイヤーパネル */}
      <div className="layer-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} />
            <span>部位別レイヤー</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{layers.length} レイヤー</span>
        </div>

        <div className="layer-list">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className={`layer-item ${selectedLayerId === layer.id ? 'active' : ''}`}
            >
              {/* 表示・非表示切替 */}
              <button
                className="layer-icon-btn"
                onClick={() => handleLayerVisibility(layer.id, layer.visible)}
              >
                {layer.visible ? <Eye size={15} /> : <EyeOff size={15} color="#ef4444" />}
              </button>

              {/* ロック切替 */}
              <button
                className="layer-icon-btn"
                onClick={() => handleLayerLock(layer.id, layer.locked)}
              >
                {layer.locked ? <Lock size={15} color="#f59e0b" /> : <Unlock size={15} />}
              </button>

              {/* カラーチップ */}
              <div
                className="layer-color-preview"
                style={{
                  backgroundColor: layer.type === 'fill' ? layer.color : 'transparent',
                  borderColor: layer.type === 'line' ? layer.color : 'rgba(255,255,255,0.2)',
                  borderWidth: layer.type === 'line' ? 2 : 1,
                }}
              />

              {/* レイヤー名 */}
              <span className="layer-name">{layer.name}</span>

              {/* 種類バッジ */}
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: 3,
                  background:
                    layer.type === 'fill' ? 'rgba(236,72,153,0.15)' : 'rgba(99,102,241,0.15)',
                  color: layer.type === 'fill' ? '#f472b6' : '#a5b4fc',
                }}
              >
                {layer.type === 'fill' ? '下地' : '線画'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
