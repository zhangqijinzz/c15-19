import { cloneScenario, reorderScenario, resolveActiveScenarioAfterRemoval, summarizeScenario, validateDevice, validateScenarioName, validateScenarioSettings } from './domain';
import { findScenario, type EnergyRepository } from './repository';
import type { EnergyDevice, EnergyDocument, EnergyScenario, Notice, ViewStatus } from './types';

export interface EnergyLensState {
  document: EnergyDocument | null;
  status: ViewStatus;
  notice: Notice | null;
}

type Listener = (state: EnergyLensState) => void;

export class EnergyLensViewModel {
  private state: EnergyLensState = { document: null, status: 'loading', notice: null };
  private readonly listeners = new Set<Listener>();

  constructor(private readonly repository: EnergyRepository) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): EnergyLensState { return this.state; }

  initialize(): void {
    try {
      this.state = { document: this.repository.load(), status: 'ready', notice: null };
    } catch {
      this.state = { document: null, status: 'error', notice: { kind: 'error', text: '本地数据读取失败，请刷新重试' } };
    }
    this.emit();
  }

  get activeScenario(): EnergyScenario | null {
    if (!this.state.document) return null;
    return findScenario(this.state.document, this.state.document.activeScenarioId) ?? null;
  }

  get activeSummary() {
    return this.activeScenario ? summarizeScenario(this.activeScenario) : null;
  }

  updateDevice(deviceId: string, patch: Partial<Pick<EnergyDevice, 'name' | 'watts' | 'dailyHours'>>): void {
    const scenario = this.activeScenario;
    if (!scenario) return;
    const device = scenario.devices.find((item) => item.id === deviceId);
    if (!device) return;
    const next = { ...device, ...patch };
    const error = validateDevice(next);
    if (error) {
      this.setNotice({ kind: 'error', text: error });
      return;
    }
    this.commit((current) => ({ ...current, devices: current.devices.map((item) => item.id === deviceId ? next : item) }), '参数已更新');
  }

  addDevice(): void {
    const scenario = this.activeScenario;
    if (!scenario) return;
    const device: EnergyDevice = { id: `device-${Date.now()}`, name: '新设备', watts: 100, dailyHours: 1 };
    this.commit((current) => ({ ...current, devices: [...current.devices, device] }), '已添加设备，可继续修改参数');
  }

  removeDevice(deviceId: string): void {
    const scenario = this.activeScenario;
    if (!scenario || scenario.devices.length <= 1) {
      this.setNotice({ kind: 'info', text: '至少保留一个设备，便于计算方案' });
      return;
    }
    this.commit((current) => ({ ...current, devices: current.devices.filter((item) => item.id !== deviceId) }), '设备已移除');
  }

  updateSettings(patch: Partial<Pick<EnergyScenario, 'name' | 'pricePerKwh' | 'daysPerMonth'>>): void {
    const scenario = this.activeScenario;
    if (!scenario) return;
    const next = { ...scenario, ...patch };
    const error = validateScenarioSettings(next.pricePerKwh, next.daysPerMonth);
    if (error) {
      this.setNotice({ kind: 'error', text: error });
      return;
    }
    this.commit((current) => ({ ...current, name: next.name.trim() || '未命名方案', pricePerKwh: next.pricePerKwh, daysPerMonth: next.daysPerMonth }), '计费参数已更新');
  }

  duplicateActive(): void {
    const source = this.activeScenario;
    if (!source || !this.state.document) return;
    const id = `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const copy = cloneScenario(source, id, `${source.name} · 副本`);
    const document = { ...this.state.document, scenarios: [...this.state.document.scenarios, copy], activeScenarioId: id };
    this.persist(document, '方案已复制，现在可以修改副本');
  }

  renameScenario(id: string, name: string): void {
    const document = this.state.document;
    if (!document || !findScenario(document, id)) return;
    const error = validateScenarioName(name);
    if (error) {
      this.setNotice({ kind: 'error', text: error });
      return;
    }
    const trimmed = name.trim();
    if (findScenario(document, id)?.name === trimmed) return;
    const scenarios = document.scenarios.map((scenario) => scenario.id === id ? { ...scenario, name: trimmed } : scenario);
    this.persist({ ...document, scenarios }, '方案已重命名');
  }

  removeScenario(id: string): void {
    const document = this.state.document;
    if (!document || !findScenario(document, id)) return;
    if (document.scenarios.length <= 1) {
      this.setNotice({ kind: 'info', text: '这是最后一个方案，至少保留一个' });
      return;
    }
    const activeScenarioId = resolveActiveScenarioAfterRemoval(document.scenarios, id, document.activeScenarioId);
    const scenarios = document.scenarios.filter((scenario) => scenario.id !== id);
    const notice = activeScenarioId === document.activeScenarioId ? '方案已删除' : '方案已删除，已切换到相邻方案';
    this.persist({ ...document, scenarios, activeScenarioId }, notice);
  }

  moveScenario(id: string, offset: -1 | 1): void {
    const document = this.state.document;
    if (!document) return;
    const scenarios = reorderScenario(document.scenarios, id, offset);
    if (scenarios === document.scenarios) return;
    this.persist({ ...document, scenarios }, '方案顺序已更新');
  }

  selectScenario(id: string): void {
    if (!this.state.document || !findScenario(this.state.document, id)) return;
    this.persist({ ...this.state.document, activeScenarioId: id }, '已切换方案');
  }

  complete(): void {
    this.state = { ...this.state, status: 'completed', notice: { kind: 'success', text: '本次推演已保存，可随时回来继续调整' } };
    this.emit();
  }

  private commit(update: (scenario: EnergyScenario) => EnergyScenario, notice: string): void {
    if (!this.state.document) return;
    const document = { ...this.state.document, scenarios: this.state.document.scenarios.map((scenario) => scenario.id === this.state.document?.activeScenarioId ? update(scenario) : scenario) };
    this.persist(document, notice);
  }

  private persist(document: EnergyDocument, notice: string): void {
    try {
      this.repository.save(document);
      this.state = { document, status: 'editing', notice: { kind: 'success', text: notice } };
    } catch {
      this.state = { ...this.state, status: 'error', notice: { kind: 'error', text: '保存失败，当前页面仍可继续编辑' } };
    }
    this.emit();
  }

  private setNotice(notice: Notice): void {
    this.state = { ...this.state, status: notice.kind === 'error' ? 'error' : 'editing', notice };
    this.emit();
  }

  private emit(): void { this.listeners.forEach((listener) => listener(this.state)); }
}
