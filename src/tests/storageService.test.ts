// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { exampleScenario } from '../domain';
import { LocalEnergyRepository } from '../repository';

describe('local persistence recovery', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to a valid example when saved JSON is damaged', () => {
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [null], activeScenarioId: 'missing' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
    expect(recovered.scenarios[0].devices.length).toBeGreaterThan(0);
  });

  it('preserves the custom scenario order across save and load', () => {
    const first = { ...structuredClone(exampleScenario), id: 'scenario-b', name: '方案B' };
    const second = { ...structuredClone(exampleScenario), id: 'scenario-a', name: '方案A' };
    const repository = new LocalEnergyRepository();
    repository.save({ version: 1, scenarios: [first, second], activeScenarioId: 'scenario-a' });
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios.map((scenario) => scenario.id)).toEqual(['scenario-b', 'scenario-a']);
    expect(recovered.activeScenarioId).toBe('scenario-a');
  });
});
