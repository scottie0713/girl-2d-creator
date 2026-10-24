import React from 'react';
import { ExtractedVectorData } from '../types';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Sparkles, X } from 'lucide-react';

interface PreviewModalProps {
  isOpen: boolean;
  vectorData: ExtractedVectorData | null;
  onConfirm: () => void;
  onBackTo3D: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  vectorData,
  onConfirm,
  onBackTo3D,
}) => {
  if (!isOpen || !vectorData) return null;

  // SVGプレビューの生成
  const { width, height, parts } = vectorData;
  const totalOutlines = parts.reduce((acc, p) => acc + p.outlinePaths.length, 0);

  return (
    <div className="modal-overlay" onClick={onBackTo3D}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 28px',
        }}
      >
        {/* ヘッダー */}
        <div className="modal-header" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: '1.1rem' }}>
                2D化プレビュー＆構図確認
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                現在のカメラアングルで抽出された2D線画と切り取り枠を確認してください
              </div>
            </div>
          </div>
          <button className="layer-icon-btn" onClick={onBackTo3D}>
            <X size={20} />
          </button>
        </div>

        {/* 中央プレビューキャンバス（ファインダー枠） */}
        <div
          style={{
            flex: 1,
            minHeight: 460,
            background: '#12141c',
            border: '2px solid rgba(99, 102, 241, 0.4)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            padding: 16,
            backgroundImage:
              'linear-gradient(45deg, #181b26 25%, transparent 25%), linear-gradient(-45deg, #181b26 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #181b26 75%), linear-gradient(-45deg, transparent 75%, #181b26 75%)',
            backgroundSize: '20px 20px',
          }}
        >
          {/* 画角フレームバッジ */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              background: 'rgba(22, 25, 34, 0.85)',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
            }}
          >
            構図キャンバス枠 (縦長比率)
          </div>

          {/* SVGによるリアルタイムプレビュー */}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{
              maxWidth: '100%',
              maxHeight: 440,
              boxShadow: 'var(--shadow-md)',
              background: 'transparent',
            }}
          >
            {/* 1. 下地塗りつぶしポリゴン */}
            {parts.map((part) =>
              part.fillPolygon.map((poly, pIdx) => (
                <polygon
                  key={`fill-${part.partId}-${pIdx}`}
                  points={poly.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="#fcf4ed"
                />
              ))
            )}

            {/* 2. 輪郭線 */}
            {parts.map((part) =>
              part.outlinePaths.map((seg, sIdx) => {
                const pathStr =
                  seg.points.reduce((acc, p, idx) => {
                    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                  }, '') + (seg.closed ? ' Z' : '');

                return (
                  <path
                    key={`line-${part.partId}-${sIdx}`}
                    d={pathStr}
                    stroke="#2d2623"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                );
              })
            )}
          </svg>
        </div>

        {/* 抽出情報バー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '12px 0 20px',
            padding: '8px 14px',
            background: 'var(--bg-card)',
            borderRadius: 6,
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
          }}
        >
          <div>
            検出部位: <strong style={{ color: 'var(--text-main)' }}>{parts.length}パーツ</strong> /
            輪郭線: <strong style={{ color: 'var(--text-main)' }}>{totalOutlines}本</strong>
          </div>
          <div style={{ color: 'var(--text-sub)' }}>
            見切れや構図に問題がなければ「2D調整へ進む」を押してください
          </div>
        </div>

        {/* フッターアクションボタン */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            className="btn-secondary"
            onClick={onBackTo3D}
            style={{ padding: '8px 16px', fontSize: '0.86rem' }}
          >
            <ArrowLeft size={16} />
            <span>3Dに戻って構図を直す</span>
          </button>

          <button
            className="btn-primary"
            onClick={onConfirm}
            style={{ padding: '8px 20px', fontSize: '0.86rem' }}
          >
            <span>この構図で2D調整へ進む</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
