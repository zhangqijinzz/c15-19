import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exampleScenario } from '../domain';
import type { EnergyDocument, EnergyScenario } from '../types';
import { EnergyLensViewModel } from '../viewModel';
import type { EnergyRepository } from '../repository';

function makeScenario(id: string, name: string): EnergyScenario {
  return { ...structuredClone(exampleScenario), id, name };
}

function makeRepository(
  scenarios: EnergyScenario[] = [structuredClone(exampleScenario)],
  activeScenarioId = exampleScenario.id,
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

  it('renames a scenario, trimming whitespace, and persists it', () => {
    expect(vm.renameScenario(exampleScenario.id, '  冬季取暖方案  ')).toBe(true);
    expect(vm.activeScenario?.name).toBe('冬季取暖方案');
    expect(repository.save).toHaveBeenCalled();
  });

  it('rejects blank names and names already taken by another scenario', () => {
    repository = makeRepository([makeScenario('a', '方案 A'), makeScenario('b', '方案 B')], 'a');
    vm = new EnergyLensViewModel(repository);
    vm.initialize();
    expect(vm.renameScenario('b', '   ')).toBe(false);
    expect(vm.getState().notice?.text).toBe('方案名称不能为空');
    expect(vm.renameScenario('b', '方案 A')).toBe(false);
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().document?.scenarios.map((scenario) => scenario.name)).toEqual(['方案 A', '方案 B']);
  });

  it('treats renaming to the current name as a no-op success', () => {
    expect(vm.renameScenario(exampleScenario.id, exampleScenario.name)).toBe(true);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('gives duplicates distinct names instead of stacking suffixes', () => {
    let tick = 1000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => ++tick);
    try {
      vm.duplicateActive();
      vm.duplicateActive();
      const names = vm.getState().document?.scenarios.map((scenario) => scenario.name);
      expect(names).toEqual(['夏日居家方案', '夏日居家方案 · 副本', '夏日居家方案 · 副本 2']);
      expect(new Set(names).size).toBe(names?.length);
    } finally {
      clock.mockRestore();
    }
  });

  it('keeps the active scenario when deleting a different one', () => {
    repository = makeRepository([makeScenario('a', '方案 A'), makeScenario('b', '方案 B')], 'a');
    vm = new EnergyLensViewModel(repository);
    vm.initialize();
    vm.removeScenario('b');
    expect(vm.getState().document?.scenarios.map((scenario) => scenario.id)).toEqual(['a']);
    expect(vm.getState().document?.activeScenarioId).toBe('a');
    expect(vm.activeScenario?.id).toBe('a');
  });

  it('falls to a neighboring scenario when the active one is deleted', () => {
    repository = makeRepository([makeScenario('a', '方案 A'), makeScenario('b', '方案 B'), makeScenario('c', '方案 C')], 'b');
    vm = new EnergyLensViewModel(repository);
    vm.initialize();
    vm.removeScenario('b');
    expect(vm.getState().document?.activeScenarioId).toBe('c');
    vm.removeScenario('c');
    expect(vm.getState().document?.activeScenarioId).toBe('a');
    expect(vm.activeScenario?.id).toBe('a');
  });

  it('refuses to delete the last remaining scenario', () => {
    vm.removeScenario(exampleScenario.id);
    expect(vm.getState().document?.scenarios).toHaveLength(1);
    expect(vm.getState().notice?.text).toBe('最后一个方案不能删除');
    expect(vm.activeScenario?.id).toBe(exampleScenario.id);
  });

  it('reorders scenarios and keeps the order across a reload', () => {
    repository = makeRepository([makeScenario('a', '方案 A'), makeScenario('b', '方案 B'), makeScenario('c', '方案 C')], 'a');
    vm = new EnergyLensViewModel(repository);
    vm.initialize();
    vm.moveScenario('c', -1);
    expect(vm.getState().document?.scenarios.map((scenario) => scenario.id)).toEqual(['a', 'c', 'b']);
    vm.moveScenario('a', 1);
    expect(vm.getState().document?.scenarios.map((scenario) => scenario.id)).toEqual(['c', 'a', 'b']);
    const recovered = new EnergyLensViewModel(repository);
    recovered.initialize();
    expect(recovered.getState().document?.scenarios.map((scenario) => scenario.id)).toEqual(['c', 'a', 'b']);
    expect(recovered.getState().document?.activeScenarioId).toBe('a');
  });

  it('ignores moves past either end of the list', () => {
    repository = makeRepository([makeScenario('a', '方案 A'), makeScenario('b', '方案 B')], 'a');
    vm = new EnergyLensViewModel(repository);
    vm.initialize();
    vm.moveScenario('a', -1);
    vm.moveScenario('b', 1);
    expect(vm.getState().document?.scenarios.map((scenario) => scenario.id)).toEqual(['a', 'b']);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
