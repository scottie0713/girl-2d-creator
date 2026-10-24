import React, { useState } from 'react';
import { PaperManager } from '../utils/vector/PaperManager';
import { ExportManager } from '../utils/export/ExportManager';
import { X, FileImage, FileCode, Archive, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperManager: PaperManager | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  paperManager,
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string>('');

  if (!isOpen || !paperManager) return null;

  const handleExport = async (type: 'psd' | 'svg' | 'zip' | 'png') => {
    setIsExporting(true);
    setExportMessage('書き出し処理中...');

    try {
      if (type === 'psd') {
        setExportMessage('PSDレイヤーファイルを生成中...');
        await ExportManager.exportPSD(paperManager, 'girl_mannequin_layers.psd');
      } else if (type === 'svg') {
        ExportManager.exportSVG(paperManager, 'girl_mannequin_vector.svg');
      } else if (type === 'zip') {
        setExportMessage('部位別連番PNGをアーカイブ中...');
        await ExportManager.exportPNGZip(paperManager, 'girl_mannequin_png_layers.zip');
      } else if (type === 'png') {
        ExportManager.exportSinglePNG(paperManager, 'girl_mannequin_2d.png');
      }
      setTimeout(() => {
        setIsExporting(false);
        setExportMessage('');
        onClose();
      }, 500);
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
      setExportMessage('書き出し中にエラーが発生しました');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">2Dキャラクター レイヤー保存</div>
          <button className="layer-icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {isExporting ? (
          <div
            style={{
              padding: '40px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <Loader2 size={36} className="animate-spin" color="var(--primary)" />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {exportMessage}
            </span>
          </div>
        ) : (
          <div className="export-options">
            {/* 1. PSD形式（Clip Studio Paint推奨） */}
            <div
              className="export-option-card"
              onClick={() => handleExport('psd')}
              style={{ border: '1px solid rgba(99, 102, 241, 0.4)' }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <FileImage size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>PSD形式（Clip Studio Paint / Photoshop）</span>
                  <span className="export-badge">推奨</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                  部位ごとの線画と下地塗りがレイヤー分けされたPSD。クリスタで開いてそのまま顔・髪・服を加筆できます。
                </div>
              </div>
            </div>

            {/* 2. SVG形式 */}
            <div className="export-option-card" onClick={() => handleExport('svg')}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: 'rgba(236, 72, 153, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-pink)',
                }}
              >
                <FileCode size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>SVGベクター形式</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                  解像度無制限のベクターデータ。部位別に&lt;g&gt;タグでグループ化されておりIllustrator等でも編集可能。
                </div>
              </div>
            </div>

            {/* 3. 連番PNG ZIP */}
            <div className="export-option-card" onClick={() => handleExport('zip')}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: 'rgba(6, 182, 212, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)',
                }}
              >
                <Archive size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>部位別 透過PNG連番 (ZIP)</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                  部位ごとのパーツ（線画/下地塗り）が個別の透過PNG画像としてZIPアーカイブされます。
                </div>
              </div>
            </div>

            {/* 4. 統合PNG */}
            <div className="export-option-card" onClick={() => handleExport('png')}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <ImageIcon size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>統合PNG画像</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                  全レイヤーを合成した1枚の透過PNG画像として保存します。
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
