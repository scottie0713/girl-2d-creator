import paper from 'paper';
import { BodyPartId, ExtractedVectorData, LayerItem, Point2D, VectorTool } from '../../types';

export interface VectorItemRef {
  partId: BodyPartId;
  type: 'line' | 'fill';
  pathItem: paper.PathItem;
  originalSegments?: paper.Segment[];
}

export class PaperManager {
  private scope: paper.PaperScope;
  private canvas: HTMLCanvasElement;
  private items: Map<string, VectorItemRef> = new Map();
  private layers: LayerItem[] = [];
  private currentTool: VectorTool = 'select';
  private selectedItem: paper.PathItem | null = null;
  private selectedSegment: paper.Segment | null = null;
  private selectedHandle: 'handleIn' | 'handleOut' | null = null;

  // Liquify (ゆがみ) 設定
  private brushRadius: number = 40;
  private brushStrength: number = 0.5;

  // 顔の十字アタリ線
  private faceGuideGroup: paper.Group | null = null;
  private showFaceGuide: boolean = true;

  // コールバック
  private onLayersChange?: (layers: LayerItem[]) => void;
  private onSelectionChange?: (selectedId: string | null) => void;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks?: {
      onLayersChange?: (layers: LayerItem[]) => void;
      onSelectionChange?: (selectedId: string | null) => void;
    }
  ) {
    this.canvas = canvas;
    this.scope = new paper.PaperScope();
    this.scope.setup(canvas);

    this.onLayersChange = callbacks?.onLayersChange;
    this.onSelectionChange = callbacks?.onSelectionChange;

    this.setupInteractions();
  }

  // 抽出された3Dベクターデータから2Dキャンバスを初期化
  public loadExtractedData(data: ExtractedVectorData) {
    this.scope.activate();
    this.scope.project.clear();
    this.items.clear();
    this.layers = [];

    const defaultFillColor = new paper.Color('#fcf4ed'); // 美しい肌色下地
    const defaultStrokeColor = new paper.Color('#2d2623'); // 柔らかい温かみのある主線色

    // 深度順（奥から手前）に作成
    data.parts.forEach((part) => {
      // 1. 塗りつぶしレイヤー (下地)
      if (part.fillPolygon && part.fillPolygon.length > 0) {
        const compoundPath = new paper.CompoundPath({
          fillColor: defaultFillColor,
          strokeColor: undefined,
        });

        part.fillPolygon.forEach((poly) => {
          if (poly.length >= 3) {
            const path = new paper.Path({
              segments: poly.map((p) => new paper.Point(p.x, p.y)),
              closed: true,
            });
            path.smooth({ type: 'catmull-rom', factor: 0.5 });
            compoundPath.addChild(path);
          }
        });

        const fillId = `fill_${part.partId}`;
        compoundPath.name = fillId;
        compoundPath.data = { partId: part.partId, type: 'fill', layerId: fillId };

        this.items.set(fillId, {
          partId: part.partId,
          type: 'fill',
          pathItem: compoundPath,
        });

        this.layers.push({
          id: fillId,
          partId: part.partId,
          name: `${part.name} (下地塗)`,
          type: 'fill',
          visible: true,
          locked: false,
          opacity: 1.0,
          color: '#fcf4ed',
          strokeWidth: 0,
        });
      }

      // 2. 輪郭線・稜線レイヤー (線画)
      const allPaths = [...part.outlinePaths, ...part.creasePaths];
      if (allPaths.length > 0) {
        const lineGroup = new paper.Group();
        const lineId = `line_${part.partId}`;
        lineGroup.name = lineId;
        lineGroup.data = { partId: part.partId, type: 'line', layerId: lineId };

        allPaths.forEach((pathSeg) => {
          if (pathSeg.points.length >= 2) {
            const path = new paper.Path({
              segments: pathSeg.points.map((p) => new paper.Point(p.x, p.y)),
              closed: pathSeg.closed || false,
              strokeColor: defaultStrokeColor,
              strokeWidth: 2.2,
              strokeCap: 'round',
              strokeJoin: 'round',
            });
            path.smooth({ type: 'catmull-rom', factor: 0.5 });
            lineGroup.addChild(path);
          }
        });

        this.items.set(lineId, {
          partId: part.partId,
          type: 'line',
          pathItem: lineGroup as unknown as paper.PathItem,
        });

        this.layers.push({
          id: lineId,
          partId: part.partId,
          name: `${part.name} (線画)`,
          type: 'line',
          visible: true,
          locked: false,
          opacity: 1.0,
          color: '#2d2623',
          strokeWidth: 2.2,
        });
      }
    });

    // 頭部の上に顔の十字アタリ線を生成
    this.createFaceGuide();

    this.scope.view.draw();
    if (this.onLayersChange) {
      this.onLayersChange([...this.layers]);
    }
  }

  // 頭部の位置を検出し、目鼻口を描くための十字アタリ線を自動配置
  private createFaceGuide() {
    const headFill = this.items.get('fill_head') || this.items.get('line_head');
    if (!headFill) return;

    const bounds = headFill.pathItem.bounds;
    const center = bounds.center;

    this.faceGuideGroup = new paper.Group();
    this.faceGuideGroup.name = 'face_guide_group';

    // 縦の中心線 (正中線)
    const vLine = new paper.Path.Line(
      new paper.Point(center.x, bounds.top + bounds.height * 0.15),
      new paper.Point(center.x, bounds.bottom - bounds.height * 0.05)
    );
    vLine.strokeColor = new paper.Color('#00b4d8');
    vLine.strokeWidth = 1.2;
    vLine.dashArray = [4, 4];

    // 横の目のライン
    const hLineEye = new paper.Path.Line(
      new paper.Point(bounds.left + bounds.width * 0.15, bounds.top + bounds.height * 0.52),
      new paper.Point(bounds.right - bounds.width * 0.15, bounds.top + bounds.height * 0.52)
    );
    hLineEye.strokeColor = new paper.Color('#00b4d8');
    hLineEye.strokeWidth = 1.2;
    hLineEye.dashArray = [4, 4];

    // 鼻と口の目安ポイント
    const nosePoint = new paper.Path.Circle(
      new paper.Point(center.x, bounds.top + bounds.height * 0.68),
      2.5
    );
    nosePoint.fillColor = new paper.Color('#00b4d8');

    const mouthLine = new paper.Path.Line(
      new paper.Point(center.x - 12, bounds.top + bounds.height * 0.8),
      new paper.Point(center.x + 12, bounds.top + bounds.height * 0.8)
    );
    mouthLine.strokeColor = new paper.Color('#00b4d8');
    mouthLine.strokeWidth = 1.0;

    this.faceGuideGroup.addChildren([vLine, hLineEye, nosePoint, mouthLine]);
    this.faceGuideGroup.opacity = this.showFaceGuide ? 0.75 : 0;
  }

  public toggleFaceGuide(show?: boolean) {
    this.showFaceGuide = show !== undefined ? show : !this.showFaceGuide;
    if (this.faceGuideGroup) {
      this.faceGuideGroup.opacity = this.showFaceGuide ? 0.75 : 0;
      this.scope.view.draw();
    }
  }

  public setTool(tool: VectorTool) {
    this.currentTool = tool;
    if (tool !== 'select') {
      this.clearSelection();
    }
  }

  public setBrushRadius(radius: number) {
    this.brushRadius = Math.max(10, Math.min(200, radius));
  }

  public setBrushStrength(strength: number) {
    this.brushStrength = Math.max(0.1, Math.min(1.0, strength));
  }

  // ツールに応じたマウスインタラクション
  private setupInteractions() {
    const tool = new this.scope.Tool();
    let isDragging = false;
    let lastPoint = new paper.Point(0, 0);

    tool.onMouseDown = (event: paper.ToolEvent) => {
      isDragging = true;
      lastPoint = event.point;

      if (this.currentTool === 'select') {
        this.handleSelectMouseDown(event);
      } else if (this.currentTool === 'liquify') {
        this.applyLiquify(event.point, new paper.Point(0, 0));
      }
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      if (!isDragging) return;
      const delta = event.point.subtract(lastPoint);

      if (this.currentTool === 'select') {
        this.handleSelectMouseDrag(event, delta);
      } else if (this.currentTool === 'liquify') {
        this.applyLiquify(event.point, delta);
      } else if (this.currentTool === 'warp' && this.selectedItem) {
        // パペットワープ / スケール誇張
        this.selectedItem.scale(1 + delta.y * -0.005, event.point);
      }

      lastPoint = event.point;
      this.scope.view.draw();
    };

    tool.onMouseUp = () => {
      isDragging = false;
      this.selectedSegment = null;
      this.selectedHandle = null;
    };
  }

  private handleSelectMouseDown(event: paper.ToolEvent) {
    const hitOptions: paper.IHitTestOptions = {
      segments: true,
      stroke: true,
      fill: true,
      tolerance: 6,
      handles: true,
    };

    const hitResult = this.scope.project.hitTest(event.point, hitOptions);

    if (hitResult) {
      if (hitResult.type === 'segment') {
        this.selectedSegment = hitResult.segment;
        this.selectedItem = hitResult.item;
        hitResult.item.selected = true;
      } else if (hitResult.type === 'handle-in') {
        this.selectedSegment = hitResult.segment;
        this.selectedHandle = 'handleIn';
      } else if (hitResult.type === 'handle-out') {
        this.selectedSegment = hitResult.segment;
        this.selectedHandle = 'handleOut';
      } else {
        this.clearSelection();
        this.selectedItem = hitResult.item;
        hitResult.item.selected = true;
      }

      const layerId = hitResult.item.data?.layerId;
      if (this.onSelectionChange) {
        this.onSelectionChange(layerId || null);
      }
    } else {
      this.clearSelection();
      if (this.onSelectionChange) {
        this.onSelectionChange(null);
      }
    }
  }

  private handleSelectMouseDrag(event: paper.ToolEvent, delta: paper.Point) {
    if (this.selectedHandle === 'handleIn' && this.selectedSegment) {
      this.selectedSegment.handleIn = this.selectedSegment.handleIn.add(delta);
    } else if (this.selectedHandle === 'handleOut' && this.selectedSegment) {
      this.selectedSegment.handleOut = this.selectedSegment.handleOut.add(delta);
    } else if (this.selectedSegment) {
      this.selectedSegment.point = this.selectedSegment.point.add(delta);
    } else if (this.selectedItem) {
      this.selectedItem.position = this.selectedItem.position.add(delta);
    }
  }

  // ゆがみブラシ（Liquify Push Brush）
  // 筆圧のように、なぞった方向へベクター頂点を自然に押し出す
  private applyLiquify(center: paper.Point, delta: paper.Point) {
    if (delta.length === 0) return;

    const radius = this.brushRadius;
    const strength = this.brushStrength;

    // キャンバス上のすべてのアンロックされたパスアイテムを対象に変形
    this.scope.project.activeLayer.children.forEach((item: any) => {
      if (item === this.faceGuideGroup) return;
      this.deformItemRecursive(item, center, delta, radius, strength);
    });
  }

  private deformItemRecursive(
    item: paper.Item,
    center: paper.Point,
    delta: paper.Point,
    radius: number,
    strength: number
  ) {
    if (item instanceof paper.CompoundPath) {
      item.children.forEach((child) => this.deformItemRecursive(child, center, delta, radius, strength));
      return;
    }

    if (item instanceof paper.Group) {
      item.children.forEach((child) => this.deformItemRecursive(child, center, delta, radius, strength));
      return;
    }

    if (item instanceof paper.Path) {
      item.segments.forEach((seg) => {
        const d = seg.point.getDistance(center);
        if (d < radius) {
          // なめらかなコサイン減衰
          const factor = Math.cos((d / radius) * (Math.PI / 2)) * strength;
          const offset = delta.multiply(factor);
          seg.point = seg.point.add(offset);
        }
      });
      // パスのなめらかさを維持
      item.smooth({ type: 'catmull-rom', factor: 0.2 });
    }
  }

  // 線の太さ（筆圧・強弱）の一括変更
  public setStrokeWidth(width: number, targetPartId?: BodyPartId) {
    this.layers.forEach((layer) => {
      if (layer.type === 'line' && (!targetPartId || layer.partId === targetPartId)) {
        layer.strokeWidth = width;
        const ref = this.items.get(layer.id);
        if (ref && ref.pathItem) {
          ref.pathItem.strokeWidth = width;
        }
      }
    });
    this.scope.view.draw();
    if (this.onLayersChange) {
      this.onLayersChange([...this.layers]);
    }
  }

  // レイヤーの表示・非表示
  public setLayerVisibility(layerId: string, visible: boolean) {
    const layer = this.layers.find((l) => l.id === layerId);
    const ref = this.items.get(layerId);
    if (layer && ref) {
      layer.visible = visible;
      ref.pathItem.visible = visible;
      this.scope.view.draw();
      if (this.onLayersChange) {
        this.onLayersChange([...this.layers]);
      }
    }
  }

  // レイヤーのロック
  public setLayerLocked(layerId: string, locked: boolean) {
    const layer = this.layers.find((l) => l.id === layerId);
    const ref = this.items.get(layerId);
    if (layer && ref) {
      layer.locked = locked;
      ref.pathItem.locked = locked;
      if (this.onLayersChange) {
        this.onLayersChange([...this.layers]);
      }
    }
  }

  // レイヤーの不透明度
  public setLayerOpacity(layerId: string, opacity: number) {
    const layer = this.layers.find((l) => l.id === layerId);
    const ref = this.items.get(layerId);
    if (layer && ref) {
      layer.opacity = opacity;
      ref.pathItem.opacity = opacity;
      this.scope.view.draw();
      if (this.onLayersChange) {
        this.onLayersChange([...this.layers]);
      }
    }
  }

  // レイヤーの色変更
  public setLayerColor(layerId: string, colorHex: string) {
    const layer = this.layers.find((l) => l.id === layerId);
    const ref = this.items.get(layerId);
    if (layer && ref) {
      layer.color = colorHex;
      const paperColor = new paper.Color(colorHex);
      if (layer.type === 'fill') {
        ref.pathItem.fillColor = paperColor;
      } else {
        ref.pathItem.strokeColor = paperColor;
      }
      this.scope.view.draw();
      if (this.onLayersChange) {
        this.onLayersChange([...this.layers]);
      }
    }
  }

  public clearSelection() {
    this.scope.project.deselectAll();
    this.selectedItem = null;
    this.selectedSegment = null;
    this.selectedHandle = null;
    this.scope.view.draw();
  }

  public getLayers(): LayerItem[] {
    return [...this.layers];
  }

  // SVGとしてエクスポート
  public exportSVG(): string {
    return this.scope.project.exportSVG({ asString: true }) as string;
  }

  // PNGデータURLとしてエクスポート
  public exportDataURL(): string {
    return this.canvas.toDataURL('image/png');
  }

  // 部位ごとのCanvasイメージを取得（PSDレイヤー生成用）
  public async exportPartCanvases(): Promise<{ name: string; canvas: HTMLCanvasElement }[]> {
    const results: { name: string; canvas: HTMLCanvasElement }[] = [];
    const origVisibilities = new Map<string, boolean>();

    // 全アイテムを一度退避
    this.items.forEach((item, id) => {
      origVisibilities.set(id, item.pathItem.visible);
      item.pathItem.visible = false;
    });

    if (this.faceGuideGroup) {
      this.faceGuideGroup.visible = false;
    }

    // 1レイヤーずつレンダリングしてキャンバスを複製
    for (const layer of this.layers) {
      const ref = this.items.get(layer.id);
      if (!ref || !origVisibilities.get(layer.id)) continue;

      ref.pathItem.visible = true;
      this.scope.view.draw();

      const offscreen = document.createElement('canvas');
      offscreen.width = this.canvas.width;
      offscreen.height = this.canvas.height;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(this.canvas, 0, 0);
        results.push({
          name: layer.name,
          canvas: offscreen,
        });
      }

      ref.pathItem.visible = false;
    }

    // 元に戻す
    this.items.forEach((item, id) => {
      item.pathItem.visible = origVisibilities.get(id) ?? true;
    });
    if (this.faceGuideGroup) {
      this.faceGuideGroup.visible = this.showFaceGuide;
    }
    this.scope.view.draw();

    return results;
  }
}
