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

  // パン＆ズーム設定
  private isSpacePressed: boolean = false;
  private isPanning: boolean = false;
  private lastPanPoint: { x: number; y: number } = { x: 0, y: 0 };

  // コールバック
  private onLayersChange?: (layers: LayerItem[]) => void;
  private onSelectionChange?: (selectedId: string | null) => void;
  private onZoomChange?: (zoom: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks?: {
      onLayersChange?: (layers: LayerItem[]) => void;
      onSelectionChange?: (selectedId: string | null) => void;
      onZoomChange?: (zoom: number) => void;
    }
  ) {
    this.canvas = canvas;
    this.scope = new paper.PaperScope();
    this.scope.setup(canvas);

    this.onLayersChange = callbacks?.onLayersChange;
    this.onSelectionChange = callbacks?.onSelectionChange;
    this.onZoomChange = callbacks?.onZoomChange;

    this.setupInteractions();
    this.setupWheelAndPan();
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

    // 初期表示時にキャンバス全体にフィット
    this.fitToScreen();

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

  // マウスホイール（ズーム）とスペースキー（パン移動）のイベント登録
  private setupWheelAndPan() {
    const canvas = this.canvas;

    // ホイールによるカーソル中心ズーム
    canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();

        const view = this.scope.view;
        const oldZoom = view.zoom;
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        const newZoom = Math.max(0.2, Math.min(5.0, oldZoom * zoomFactor));

        // カーソル位置を固定したズーム
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const viewPos = new paper.Point(mouseX, mouseY);
        const mPosBefore = view.viewToProject(viewPos);

        view.zoom = newZoom;

        const mPosAfter = view.viewToProject(viewPos);
        view.center = view.center.add(mPosBefore.subtract(mPosAfter));

        view.draw();
        if (this.onZoomChange) {
          this.onZoomChange(newZoom);
        }
      },
      { passive: false }
    );

    // キーボード（スペースキー）の監視
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        canvas.style.cursor = 'grab';
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        canvas.style.cursor = 'default';
      }
    });

    // 右クリック/中クリックによるパン移動
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 1 || e.button === 2 || this.isSpacePressed || this.currentTool === 'pan') {
        e.preventDefault();
        this.isPanning = true;
        this.lastPanPoint = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isPanning) return;
      const dx = (e.clientX - this.lastPanPoint.x) / this.scope.view.zoom;
      const dy = (e.clientY - this.lastPanPoint.y) / this.scope.view.zoom;

      this.scope.view.center = this.scope.view.center.subtract(new paper.Point(dx, dy));
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.scope.view.draw();
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        canvas.style.cursor = this.isSpacePressed ? 'grab' : 'default';
      }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // 全体表示（画面にぴったりフィット）
  public fitToScreen() {
    const view = this.scope.view;
    const bounds = this.scope.project.activeLayer.bounds;

    if (bounds.width > 0 && bounds.height > 0) {
      const padding = 60;
      const scaleX = (this.canvas.clientWidth - padding * 2) / bounds.width;
      const scaleY = (this.canvas.clientHeight - padding * 2) / bounds.height;
      const fitZoom = Math.min(scaleX, scaleY, 1.2);

      view.zoom = Math.max(0.2, fitZoom);
      view.center = bounds.center;
    } else {
      view.zoom = 0.8;
      view.center = new paper.Point(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2);
    }

    view.draw();
    if (this.onZoomChange) {
      this.onZoomChange(view.zoom);
    }
  }

  // 100%等倍ズームリセット
  public resetZoom() {
    this.scope.view.zoom = 1.0;
    const bounds = this.scope.project.activeLayer.bounds;
    this.scope.view.center = bounds.width > 0 ? bounds.center : new paper.Point(430, 550);
    this.scope.view.draw();
    if (this.onZoomChange) {
      this.onZoomChange(1.0);
    }
  }

  // ツールに応じたマウスインタラクション
  private setupInteractions() {
    const tool = new this.scope.Tool();
    let isDragging = false;
    let lastPoint = new paper.Point(0, 0);

    tool.onMouseDown = (event: paper.ToolEvent) => {
      if (this.isSpacePressed || this.isPanning || this.currentTool === 'pan') {
        return;
      }

      isDragging = true;
      lastPoint = event.point;

      if (this.currentTool === 'select') {
        this.handleSelectMouseDown(event);
      } else if (this.currentTool === 'liquify') {
        this.applyLiquify(event.point, new paper.Point(0, 0));
      }
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      if (this.isSpacePressed || this.isPanning || this.currentTool === 'pan' || !isDragging) {
        return;
      }
      const delta = event.point.subtract(lastPoint);

      if (this.currentTool === 'select') {
        this.handleSelectMouseDrag(event, delta);
      } else if (this.currentTool === 'liquify') {
        this.applyLiquify(event.point, delta);
      } else if (this.currentTool === 'warp' && this.selectedItem) {
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
      tolerance: 6 / this.scope.view.zoom,
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
      this.selectedHandleOut(delta);
    } else if (this.selectedSegment) {
      this.selectedSegment.point = this.selectedSegment.point.add(delta);
    } else if (this.selectedItem) {
      this.selectedItem.position = this.selectedItem.position.add(delta);
    }
  }

  private selectedHandleOut(delta: paper.Point) {
    if (this.selectedSegment) {
      this.selectedSegment.handleOut = this.selectedSegment.handleOut.add(delta);
    }
  }

  // ゆがみブラシ（Liquify Push Brush）
  private applyLiquify(center: paper.Point, delta: paper.Point) {
    if (delta.length === 0) return;

    const radius = this.brushRadius;
    const strength = this.brushStrength;

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
          const factor = Math.cos((d / radius) * (Math.PI / 2)) * strength;
          const offset = delta.multiply(factor);
          seg.point = seg.point.add(offset);
        }
      });
      item.smooth({ type: 'catmull-rom', factor: 0.2 });
    }
  }

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

  public exportSVG(): string {
    return this.scope.project.exportSVG({ asString: true }) as string;
  }

  public exportDataURL(): string {
    return this.canvas.toDataURL('image/png');
  }

  public async exportPartCanvases(): Promise<{ name: string; canvas: HTMLCanvasElement }[]> {
    const results: { name: string; canvas: HTMLCanvasElement }[] = [];
    const origVisibilities = new Map<string, boolean>();

    this.items.forEach((item, id) => {
      origVisibilities.set(id, item.pathItem.visible);
      item.pathItem.visible = false;
    });

    if (this.faceGuideGroup) {
      this.faceGuideGroup.visible = false;
    }

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
