import { describe, expect, it } from 'vitest';
import { estimateDevice, reorderScenario, resolveActiveScenarioAfterRemoval, scenarioDisplayNames, summarizeScenario, validateDevice } from '../domain';
import type { EnergyScenario } from '../types';

function makeScenario(id: string, name: string): EnergyScenario {
  return { id, name, pricePerKwh: 1, daysPerMonth: 30, createdAt: '', devices: [{ id: `${id}-device`, name: '设备', watts: 100, dailyHours: 1 }] };
}

describe('energy domain', () => {
  it('calculates kWh and cost from watts, hours, days and price', () => {
    const result = estimateDevice({ id: 'a', name: '空调', watts: 1000, dailyHours: 2 }, 30, 0.5);
    expect(result).toEqual({ dailyKwh: 2, monthlyKwh: 60, monthlyCost: 30 });
  });

  it('keeps device shares explainable and sums to 100%', () => {
    const scenario: EnergyScenario = { id: 's', name: 'test', pricePerKwh: 1, daysPerMonth: 30, createdAt: '', devices: [
      { id: 'a', name: 'a', watts: 100, dailyHours: 1 }, { id: 'b', name: 'b', watts: 300, dailyHours: 1 },
    ] };
    const summary = summarizeScenario(scenario);
    expect(summary.total.monthlyKwh).toBe(12);
    expect(summary.devices.map((device) => device.share)).toEqual([0.25, 0.75]);
  });

  it('rejects negative power and more than 24 hours', () => {
    expect(validateDevice({ name: 'x', watts: -1, dailyHours: 1 })).toBe('功率不能为负数');
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 24.1 })).toBe('每日使用时间不能超过 24 小时');
  });
});

describe('scenarioDisplayNames', () => {
  it('keeps unique names untouched', () => {
    const names = scenarioDisplayNames([makeScenario('a', '居家'), makeScenario('b', '公司')]);
    expect(names.get('a')).toBe('居家');
    expect(names.get('b')).toBe('公司');
  });

  it('disambiguates duplicate names by list order, including legacy copy suffixes', () => {
    const names = scenarioDisplayNames([
      makeScenario('a', '夏日居家方案 · 副本'),
      makeScenario('b', '夏日居家方案 · 副本'),
      makeScenario('c', '夏日居家方案 · 副本'),
    ]);
    expect(names.get('a')).toBe('夏日居家方案 · 副本');
    expect(names.get('b')).toBe('夏日居家方案 · 副本（2）');
    expect(names.get('c')).toBe('夏日居家方案 · 副本（3）');
    expect(new Set(names.values()).size).toBe(3);
  });
});

describe('reorderScenario', () => {
  it('swaps with the neighbour and leaves boundaries untouched', () => {
    const scenarios = [makeScenario('a', 'A'), makeScenario('b', 'B'), makeScenario('c', 'C')];
    expect(reorderScenario(scenarios, 'c', -1).map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(reorderScenario(scenarios, 'a', 1).map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(reorderScenario(scenarios, 'a', -1)).toBe(scenarios);
    expect(reorderScenario(scenarios, 'c', 1)).toBe(scenarios);
    expect(reorderScenario(scenarios, 'missing', 1)).toBe(scenarios);
  });
});

describe('resolveActiveScenarioAfterRemoval', () => {
  const scenarios = [makeScenario('a', 'A'), makeScenario('b', 'B'), makeScenario('c', 'C')];

  it('keeps the active id when another scenario is removed', () => {
    expect(resolveActiveScenarioAfterRemoval(scenarios, 'a', 'b')).toBe('b');
  });

  it('falls to the next sibling when the active scenario is removed', () => {
    expect(resolveActiveScenarioAfterRemoval(scenarios, 'b', 'b')).toBe('c');
  });

  it('falls to the previous sibling when the removed active scenario was last', () => {
    expect(resolveActiveScenarioAfterRemoval(scenarios, 'c', 'c')).toBe('b');
  });
});
