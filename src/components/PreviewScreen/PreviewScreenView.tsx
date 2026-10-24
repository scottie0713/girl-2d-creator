import React, { useState } from 'react';
import { ExtractedVectorData } from '../../types';
import { PaperManager } from '../../utils/vector/PaperManager';
import { ExportManager } from '../../utils/export/ExportManager';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Layers,
  FileImage,
  FileCode,
  Archive,
  CheckCircle2,
  Download,
  Info,
} from 'lucide-react';

interface PreviewScreenViewProps {
  vectorData: ExtractedVectorData | null;
  onBackToPose: () => void;
  onConfirmAndProceed: (autoSaveFormat: 'psd' | 'svg' | 'zip') => void;
}

export const PreviewScreenView: React.FC<PreviewScreenViewProps> = ({
  vectorData,
  onBackToPose,
  onConfirmAndProceed,
}) => {
  const [saveFormat, setSaveFormat] = useState<'psd' | 'svg' | 'zip'>('psd');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!vectorData) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: 'var(--bg-dark)',
          color: 'var(--text-muted)',
        }}
      >
        <span>3Dポーズデータが読み込まれていません</span>
        <button className="btn-secondary" onClick={onBackToPose}>
          <ArrowLeft size={16} />
          <span>3Dポージング画面に戻る</span>
        </button>
      </div>
    );
  }

  const { width, height, parts } = vectorData;
  const totalOutlines = parts.reduce((acc, p) => acc + p.outlinePaths.length, 0);

  // 「次へ」押下時：レイヤーファイル保存を実行してから2D調整画面へ進む
  const handleProceed = () => {
    setIsProcessing(true);
    onConfirmAndProceed(saveFormat);
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#12141c',
        overflow: 'hidden',
      }}
    >
      {/* 左側：大きなファインダー・キャンバスプレビュー */}
      <div
        style={{
          flex: 1,
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundImage:
            'linear-gradient(45deg, #181b26 25%, transparent 25%), linear-gradient(-45deg, #181b26 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #181b26 75%), linear-gradient(-45deg, transparent 75%, #181b26 75%)',
          backgroundSize: '24px 24px',
          overflow: 'hidden',
        }}
      >
        {/* フレームガイドバッジ */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            background: 'rgba(22, 25, 34, 0.85)',
            backdropFilter: 'blur(10px)',
            padding: '8px 14px',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 10,
          }}
        >
          <Sparkles size={14} color="var(--primary)" />
          <span>2Dキャンバス枠 (縦長ポートレート比率・見切れ確認)</span>
        </div>

        {/* 2D線画＆下地塗りつぶしのSVGプレビュー */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{
              maxHeight: 'calc(100vh - 120px)',
              maxWidth: 'calc(100% - 40px)',
              aspectRatio: `${width} / ${height}`,
              boxShadow: 'var(--shadow-lg)',
              background: 'transparent',
              border: '2px solid rgba(99, 102, 241, 0.4)',
              borderRadius: 8,
            }}
          >
            {/* 1. 下地塗りつぶしレイヤー群 */}
            {parts.map((part) =>
              part.fillPolygon.map((poly, pIdx) => (
                <polygon
                  key={`fill-${part.partId}-${pIdx}`}
                  points={poly.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="#fcf4ed"
                />
              ))
            )}

            {/* 2. 輪郭線レイヤー群 */}
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
      </div>

      {/* 右側：構図確認＆レイヤー保存設定パネル */}
      <div className="side-panel" style={{ width: '380px' }}>
        <div className="panel-header">
          <span>2. 2D構図＆レイヤー確認</span>
        </div>

        {/* アクションボタングループ（パネル最上部） */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn-primary"
            onClick={handleProceed}
            disabled={isProcessing}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px 16px',
              fontSize: '0.95rem',
            }}
          >
            <Download size={17} />
            <span>{isProcessing ? '変換＆保存処理中...' : '2D変換＆レイヤー保存して次へ ➔'}</span>
          </button>

          <button
            className="btn-secondary"
            onClick={onBackToPose}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <ArrowLeft size={16} />
            <span>3Dに戻ってポーズ・構図を直す</span>
          </button>
        </div>

        {/* 抽出情報セクション */}
        <div className="panel-section">
          <div className="section-title">
            <Info size={14} style={{ display: 'inline', marginRight: 6 }} />
            2D化サマリー
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: '0.82rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>キャンバス比率:</span>
              <strong style={{ color: 'var(--text-main)' }}>860 × 1100 (縦長ポートレート)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>検出された部位:</span>
              <strong style={{ color: 'var(--primary)' }}>{parts.length} パーツ</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>抽出された輪郭線:</span>
              <strong style={{ color: 'var(--accent-pink)' }}>{totalOutlines} 本</strong>
            </div>
          </div>
        </div>

        {/* 保存フォーマット選択 */}
        <div className="panel-section">
          <div className="section-title">
            <Download size={14} style={{ display: 'inline', marginRight: 6 }} />
            「次へ」押下時に保存するレイヤー形式
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* 1. PSD形式 */}
            <div
              className={`preset-card ${saveFormat === 'psd' ? 'active' : ''}`}
              onClick={() => setSaveFormat('psd')}
              style={{
                cursor: 'pointer',
                borderColor: saveFormat === 'psd' ? 'var(--primary)' : undefined,
                background: saveFormat === 'psd' ? 'rgba(99,102,241,0.12)' : undefined,
                borderLeft: saveFormat === 'psd' ? '3px solid var(--primary)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.88rem' }}>
                  <FileImage size={16} color="var(--primary)" />
                  <span>PSD形式 (ClipStudio / Photoshop)</span>
                </div>
                <span className="export-badge">推奨</span>
              </div>
              <div className="preset-desc">
                部位ごとの線画と下地塗りが分かれたPSD。クリスタで開いてそのまま顔・髪を描き足せます。
              </div>
            </div>

            {/* 2. SVGベクター形式 */}
            <div
              className={`preset-card ${saveFormat === 'svg' ? 'active' : ''}`}
              onClick={() => setSaveFormat('svg')}
              style={{
                cursor: 'pointer',
                borderColor: saveFormat === 'svg' ? 'var(--accent-pink)' : undefined,
                background: saveFormat === 'svg' ? 'rgba(236,72,153,0.1)' : undefined,
                borderLeft: saveFormat === 'svg' ? '3px solid var(--accent-pink)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.88rem', marginBottom: 4 }}>
                <FileCode size={16} color="var(--accent-pink)" />
                <span>SVGベクター形式</span>
              </div>
              <div className="preset-desc">
                解像度無制限のベクターデータ。Illustrator等でも部位別にグループ化されて開けます。
              </div>
            </div>

            {/* 3. 連番PNG ZIP */}
            <div
              className={`preset-card ${saveFormat === 'zip' ? 'active' : ''}`}
              onClick={() => setSaveFormat('zip')}
              style={{
                cursor: 'pointer',
                borderColor: saveFormat === 'zip' ? 'var(--accent-cyan)' : undefined,
                background: saveFormat === 'zip' ? 'rgba(6,182,212,0.1)' : undefined,
                borderLeft: saveFormat === 'zip' ? '3px solid var(--accent-cyan)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.88rem', marginBottom: 4 }}>
                <Archive size={16} color="var(--accent-cyan)" />
                <span>部位別透過PNG連番 (ZIP)</span>
              </div>
              <div className="preset-desc">
                部位ごとの線画と下地塗りが個別の透過PNGとしてZIPアーカイブ保存されます。
              </div>
            </div>
          </div>
        </div>

        {/* 構成レイヤー一覧 */}
        <div className="panel-section" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="section-title">
            <Layers size={14} style={{ display: 'inline', marginRight: 6 }} />
            生成されるレイヤー一覧 ({parts.length * 2} レイヤー)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {parts.map((part) => (
              <React.Fragment key={part.partId}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--bg-card)',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                  }}
                >
                  <span style={{ color: 'var(--text-main)' }}>{part.name} (線画)</span>
                  <span style={{ fontSize: '0.68rem', color: '#a5b4fc', background: 'rgba(99,102,241,0.15)', padding: '2px 6px', borderRadius: 3 }}>
                    線画
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--bg-card)',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                  }}
                >
                  <span style={{ color: 'var(--text-main)' }}>{part.name} (下地塗)</span>
                  <span style={{ fontSize: '0.68rem', color: '#f472b6', background: 'rgba(236,72,153,0.15)', padding: '2px 6px', borderRadius: 3 }}>
                    下地
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
