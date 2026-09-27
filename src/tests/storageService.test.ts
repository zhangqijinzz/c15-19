// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { exampleScenario } from '../domain';
import { LocalEnergyRepository } from '../repository';
import type { EnergyScenario } from '../types';

const STORAGE_KEY = 'energy-lens.document.v1';

function legacyScenario(id: string, name: string): EnergyScenario {
  return { ...structuredClone(exampleScenario), id, name };
}

describe('local persistence recovery', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to a valid example when saved JSON is damaged', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, scenarios: [null], activeScenarioId: 'missing' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
    expect(recovered.scenarios[0].devices.length).toBeGreaterThan(0);
  });

  it('keeps the stored scenario order on load', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      activeScenarioId: 'a',
      scenarios: [legacyScenario('c', '丙'), legacyScenario('a', '甲'), legacyScenario('b', '乙')],
    }));
    expect(new LocalEnergyRepository().load().scenarios.map((scenario) => scenario.id)).toEqual(['c', 'a', 'b']);
  });

  it('repairs legacy duplicate names on load and writes the fix back', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      activeScenarioId: 'b',
      scenarios: [legacyScenario('a', '方案 · 副本'), legacyScenario('b', '方案 · 副本'), legacyScenario('c', '方案 · 副本')],
    }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios.map((scenario) => scenario.name)).toEqual(['方案 · 副本', '方案 · 副本 2', '方案 · 副本 3']);
    expect(recovered.activeScenarioId).toBe('b');
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { scenarios: EnergyScenario[] };
    expect(persisted.scenarios.map((scenario) => scenario.name)).toEqual(['方案 · 副本', '方案 · 副本 2', '方案 · 副本 3']);
  });

  it('leaves a clean legacy document untouched in storage', () => {
    const legacy = { version: 1, activeScenarioId: 'a', scenarios: [legacyScenario('a', '夏日居家方案 · 副本')] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios[0].name).toBe('夏日居家方案 · 副本');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(legacy));
  });
});
