import { Saved3DState } from '../../types';

const STORAGE_KEY_3D = 'girl_2d_creator_3d_state';

export class StateStorage {
  /**
   * 3Dモデルの位置・ポーズ・カメラ情報を保存
   */
  public static save3DState(state: Saved3DState): void {
    try {
      localStorage.setItem(STORAGE_KEY_3D, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save 3D state to localStorage:', err);
    }
  }

  /**
   * 保存されている3D状態を読み込み
   */
  public static load3DState(): Saved3DState | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY_3D);
      if (!data) return null;
      return JSON.parse(data) as Saved3DState;
    } catch (err) {
      console.warn('Failed to load 3D state from localStorage:', err);
      return null;
    }
  }

  /**
   * 保存データのクリア
   */
  public static clear3DState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_3D);
    } catch (err) {
      console.warn('Failed to clear 3D state:', err);
    }
  }
}
