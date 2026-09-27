import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exampleScenario, scenarioDisplayNames } from '../domain';
import type { EnergyDocument, EnergyScenario } from '../types';
import { EnergyLensViewModel } from '../viewModel';
import type { EnergyRepository } from '../repository';

function makeScenario(id: string, name: string): EnergyScenario {
  return { ...structuredClone(exampleScenario), id, name };
}

function makeRepository(
  scenarios: EnergyScenario[] = [makeScenario(exampleScenario.id, exampleScenario.name)],
  activeScenarioId: string = scenarios[0].id,
): EnergyRepository & { data: EnergyDocument; save: ReturnType<typeof vi.fn> } {
  const data: EnergyDocument = { version: 1, scenarios, activeScenarioId };
  return { data, load: () => data, save: vi.fn((next: EnergyDocument) => { data.scenarios = next.scenarios; data.activeScenarioId = next.activeScenarioId; }) };
}

describe('EnergyLensViewModel', () => {
  let repository: ReturnType<typeof makeRepository>;
  let vm: EnergyLensViewModel;
  beforeEach(() => { repository = makeRepository(); vm = new EnergyLensViewModel(repository); vm.initialize(); });

  it('initializes, persists edits, and recalculates results', () => {
    expect(vm.getState().status).toBe('ready');
    const before = vm.activeSummary?.total.monthlyKwh;
    vm.updateDevice('device-aircon', { dailyHours: 2 });
    expect(vm.activeSummary?.total.monthlyKwh).toBeLessThan(before ?? Infinity);
    expect(repository.save).toHaveBeenCalled();
  });

  it('keeps invalid values out of the document and exposes an error notice', () => {
    vm.updateDevice('device-aircon', { watts: -50 });
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toBe('功率不能为负数');
    expect(vm.activeScenario?.devices[0].watts).toBe(1200);
  });

  it('duplicates a scenario and can recover a saved document', () => {
    vm.duplicateActive();
    expect(vm.getState().document?.scenarios).toHaveLength(2);
    const recovered = new EnergyLensViewModel(repository);
    recovered.initialize();
    expect(recovered.getState().document?.scenarios).toHaveLength(2);
  });

  it('surfaces persistence failure as a recoverable error', () => {
    repository.save.mockImplementation(() => { throw new Error('quota'); });
    vm.addDevice();
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toContain('保存失败');
  });

  it('renames a scenario and rejects blank names', () => {
    vm.renameScenario(exampleScenario.id, '  冬季居家  ');
    expect(vm.activeScenario?.name).toBe('冬季居家');
    expect(repository.save).toHaveBeenCalled();
    vm.renameScenario(exampleScenario.id, '   ');
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toBe('方案名称不能为空');
    expect(vm.activeScenario?.name).toBe('冬季居家');
  });

  it('reorders scenarios and persists the order across reloads', () => {
    const repo = makeRepository([makeScenario('a', 'A'), makeScenario('b', 'B'), makeScenario('c', 'C')], 'a');
    const ordered = new EnergyLensViewModel(repo);
    ordered.initialize();
    ordered.moveScenario('c', -1);
    expect(ordered.getState().document?.scenarios.map((item) => item.id)).toEqual(['a', 'c', 'b']);
    ordered.moveScenario('a', -1);
    expect(ordered.getState().document?.scenarios.map((item) => item.id)).toEqual(['a', 'c', 'b']);
    ordered.moveScenario('a', 1);
    expect(ordered.getState().document?.scenarios.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    const recovered = new EnergyLensViewModel(repo);
    recovered.initialize();
    expect(recovered.getState().document?.scenarios.map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps the active scenario valid while deleting and protects the last one', () => {
    const repo = makeRepository([makeScenario('a', 'A'), makeScenario('b', 'B'), makeScenario('c', 'C')], 'b');
    const managing = new EnergyLensViewModel(repo);
    managing.initialize();
    managing.removeScenario('a');
    expect(managing.getState().document?.activeScenarioId).toBe('b');
    managing.removeScenario('b');
    expect(managing.getState().document?.scenarios.map((item) => item.id)).toEqual(['c']);
    expect(managing.getState().document?.activeScenarioId).toBe('c');
    expect(managing.getState().notice?.text).toContain('已切换到相邻方案');
    managing.removeScenario('c');
    expect(managing.getState().document?.scenarios).toHaveLength(1);
    expect(managing.getState().notice?.kind).toBe('info');
  });

  it('falls back to the previous scenario when the deleted active one was last', () => {
    const repo = makeRepository([makeScenario('a', 'A'), makeScenario('b', 'B')], 'b');
    const managing = new EnergyLensViewModel(repo);
    managing.initialize();
    managing.removeScenario('b');
    expect(managing.getState().document?.activeScenarioId).toBe('a');
  });

  it('shows legacy duplicate copy names distinctly and keeps them editable', () => {
    const repo = makeRepository([makeScenario('a', '夏日居家方案 · 副本'), makeScenario('b', '夏日居家方案 · 副本')], 'a');
    const managing = new EnergyLensViewModel(repo);
    managing.initialize();
    const names = scenarioDisplayNames(managing.getState().document?.scenarios ?? []);
    expect(names.get('a')).toBe('夏日居家方案 · 副本');
    expect(names.get('b')).toBe('夏日居家方案 · 副本（2）');
    managing.renameScenario('b', '周末方案');
    expect(managing.getState().document?.scenarios[1].name).toBe('周末方案');
  });
});
