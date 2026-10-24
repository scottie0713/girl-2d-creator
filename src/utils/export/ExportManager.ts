import { writePsd } from 'ag-psd';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PaperManager } from '../vector/PaperManager';

export class ExportManager {
  /**
   * Clip Studio Paint / Photoshop 互換のレイヤー付きPSDファイルを書き出す
   */
  public static async exportPSD(paperManager: PaperManager, filename = 'girl_2d_character.psd') {
    const partCanvases = await paperManager.exportPartCanvases();
    if (partCanvases.length === 0) return;

    const width = partCanvases[0].canvas.width;
    const height = partCanvases[0].canvas.height;

    // レイヤー構造の作成
    // 下地（fill）レイヤーと線画（line）レイヤーをそれぞれPSDレイヤーとして配置
    const layers = partCanvases.map((pc) => {
      return {
        name: pc.name,
        canvas: pc.canvas,
        left: 0,
        top: 0,
        opacity: 1,
        blendMode: 'normal' as const,
      };
    });

    const psd = {
      width,
      height,
      channels: 4, // RGBA
      bitsPerChannel: 8,
      colorMode: 3, // RGB
      children: layers,
    };

    const buffer = writePsd(psd);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    saveAs(blob, filename);
  }

  /**
   * ベクターSVGファイルとして保存（各部位が<g id="...">でレイヤー化）
   */
  public static exportSVG(paperManager: PaperManager, filename = 'girl_2d_character.svg') {
    const svgString = paperManager.exportSVG();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    saveAs(blob, filename);
  }

  /**
   * 部位ごとの透過PNG画像をZIP圧縮して一括保存
   */
  public static async exportPNGZip(paperManager: PaperManager, zipFilename = 'girl_2d_layers.zip') {
    const partCanvases = await paperManager.exportPartCanvases();
    const zip = new JSZip();

    // 統合PNGも同梱
    const fullDataUrl = paperManager.exportDataURL();
    const fullPngBase64 = fullDataUrl.replace(/^data:image\/png;base64,/, '');
    zip.file('00_combined_full.png', fullPngBase64, { base64: true });

    // 各レイヤーのPNG
    partCanvases.forEach((pc, idx) => {
      const dataUrl = pc.canvas.toDataURL('image/png');
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const paddedIdx = String(idx + 1).padStart(2, '0');
      const safeName = pc.name.replace(/[/\\?%*:|"<>]/g, '_');
      zip.file(`${paddedIdx}_${safeName}.png`, base64, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, zipFilename);
  }

  /**
   * 単一の統合PNGとして保存
   */
  public static exportSinglePNG(paperManager: PaperManager, filename = 'girl_2d_character.png') {
    const dataUrl = paperManager.exportDataURL();
    saveAs(dataUrl, filename);
  }
}
