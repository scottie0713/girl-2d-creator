import React from 'react';
import { EditorMode } from '../types';
import { Sparkles, Box, PenTool, Download, ArrowRight } from 'lucide-react';

interface HeaderProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onGenerate2D: () => void;
  onOpenExport: () => void;
  has2DData: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  onGenerate2D,
  onOpenExport,
  has2DData,
}) => {
  return (
    <header className="app-header">
      <div className="logo-section">
        <div className="logo-badge">
          <Sparkles size={18} color="#fff" />
        </div>
        <div>
          <span className="logo-title">2D Girl Creator</span>
          <span className="logo-tag" style={{ marginLeft: 8 }}>3D to 2D Vector</span>
        </div>
      </div>

      {/* ステップ切り替えナビ */}
      <div className="step-nav">
        <button
          className={`step-btn ${mode === '3d-pose' ? 'active' : ''}`}
          onClick={() => onModeChange('3d-pose')}
        >
          <span className="step-num">1</span>
          <Box size={16} />
          <span>3Dポージング</span>
        </button>

        <button
          className={`step-btn ${mode === '2d-vector' ? 'active' : ''}`}
          onClick={() => {
            if (has2DData) {
              onModeChange('2d-vector');
            } else {
              onGenerate2D();
            }
          }}
        >
          <span className="step-num">2</span>
          <PenTool size={16} />
          <span>2Dベクター＆嘘パース調整</span>
        </button>
      </div>

      {/* アクションボタン群 */}
      <div className="header-actions">
        {mode === '3d-pose' ? (
          <button className="btn-primary" onClick={onGenerate2D}>
            <span>2D線画化して調整へ</span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn-primary" onClick={onOpenExport}>
            <Download size={16} />
            <span>レイヤー保存 (PSD/SVG)</span>
          </button>
        )}
      </div>
    </header>
  );
};
