import { describe, expect, it } from 'vitest';
import { dedupeScenarioName, estimateDevice, nextCopyName, normalizeScenarioNames, summarizeScenario, validateDevice } from '../domain';
import type { EnergyScenario } from '../types';

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

describe('scenario naming', () => {
  const named = (id: string, name: string): EnergyScenario => ({ id, name, pricePerKwh: 1, daysPerMonth: 30, createdAt: '', devices: [{ id: 'd', name: 'd', watts: 1, dailyHours: 1 }] });

  it('keeps the desired name when it is free, otherwise appends a counter', () => {
    expect(dedupeScenarioName('方案', new Set())).toBe('方案');
    expect(dedupeScenarioName('方案', new Set(['其他']))).toBe('方案');
    expect(dedupeScenarioName('方案', new Set(['方案']))).toBe('方案 2');
    expect(dedupeScenarioName('方案', new Set(['方案', '方案 2']))).toBe('方案 3');
  });

  it('trims input and falls back for blank names', () => {
    expect(dedupeScenarioName('  方案  ', new Set())).toBe('方案');
    expect(dedupeScenarioName('   ', new Set())).toBe('未命名方案');
    expect(dedupeScenarioName('', new Set(['未命名方案']))).toBe('未命名方案 2');
  });

  it('names copies without stacking suffixes, reusing the copy slot first', () => {
    expect(nextCopyName('夏日居家方案', new Set())).toBe('夏日居家方案 · 副本');
    expect(nextCopyName('夏日居家方案', new Set(['夏日居家方案 · 副本']))).toBe('夏日居家方案 · 副本 2');
    expect(nextCopyName('夏日居家方案 · 副本', new Set(['夏日居家方案 · 副本']))).toBe('夏日居家方案 · 副本 2');
    expect(nextCopyName('夏日居家方案 · 副本 · 副本', new Set(['夏日居家方案 · 副本']))).toBe('夏日居家方案 · 副本 2');
  });

  it('normalizes legacy duplicate names in order, keeping the first as-is', () => {
    const scenarios = [named('a', '方案 · 副本'), named('b', '方案 · 副本'), named('c', '方案 · 副本 2')];
    expect(normalizeScenarioNames(scenarios).map((scenario) => scenario.name)).toEqual(['方案 · 副本', '方案 · 副本 2', '方案 · 副本 2 2']);
  });

  it('leaves already-unique scenarios untouched', () => {
    const scenarios = [named('a', '甲'), named('b', '乙 · 副本')];
    const normalized = normalizeScenarioNames(scenarios);
    expect(normalized[0]).toBe(scenarios[0]);
    expect(normalized[1]).toBe(scenarios[1]);
  });
});
