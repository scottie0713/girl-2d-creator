import React from 'react';
import { EditorMode } from '../types';
import { Sparkles, Box, Eye, PenTool, Download, ArrowRight, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onProceedToPreview: () => void;
  onProceedToStudio: () => void;
  onBackToPose: () => void;
  onOpenExport: () => void;
  has2DData: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  onProceedToPreview,
  onProceedToStudio,
  onBackToPose,
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

      {/* 3ステップ切り替えナビゲーション */}
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
          className={`step-btn ${mode === '2d-preview' ? 'active' : ''}`}
          onClick={() => {
            if (has2DData) {
              onModeChange('2d-preview');
            } else {
              onProceedToPreview();
            }
          }}
        >
          <span className="step-num">2</span>
          <Eye size={16} />
          <span>2D構図確認</span>
        </button>

        <button
          className={`step-btn ${mode === '2d-studio' ? 'active' : ''}`}
          onClick={() => {
            if (has2DData) {
              onModeChange('2d-studio');
            } else {
              onProceedToPreview();
            }
          }}
        >
          <span className="step-num">3</span>
          <PenTool size={16} />
          <span>2Dベクター調整</span>
        </button>
      </div>

      {/* 右側アクションボタン */}
      <div className="header-actions">
        {mode === '3d-pose' && (
          <button className="btn-primary" onClick={onProceedToPreview}>
            <span>保存して2D確認へ</span>
            <ArrowRight size={16} />
          </button>
        )}

        {mode === '2d-preview' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={onBackToPose}>
              <ArrowLeft size={15} />
              <span>3Dに戻る</span>
            </button>
            <button className="btn-primary" onClick={onProceedToStudio}>
              <Download size={15} />
              <span>保存して2D調整へ</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {mode === '2d-studio' && (
          <button className="btn-primary" onClick={onOpenExport}>
            <Download size={16} />
            <span>レイヤー再保存 (PSD/SVG)</span>
          </button>
        )}
      </div>
    </header>
  );
};
