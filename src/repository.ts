import { exampleScenario, normalizeScenarioNames } from './domain';
import { readDocument, writeDocument } from './services/storageService';
import type { EnergyDocument, EnergyScenario } from './types';

export interface EnergyRepository {
  load(): EnergyDocument;
  save(document: EnergyDocument): void;
}

export class LocalEnergyRepository implements EnergyRepository {
  load(): EnergyDocument {
    const saved = readDocument();
    if (!saved || saved.scenarios.length === 0) {
      return { version: 1, scenarios: [exampleScenario], activeScenarioId: exampleScenario.id };
    }
    const scenarios = normalizeScenarioNames(saved.scenarios);
    const activeExists = scenarios.some((scenario) => scenario.id === saved.activeScenarioId);
    const repaired: EnergyDocument = { ...saved, scenarios, activeScenarioId: activeExists ? saved.activeScenarioId : scenarios[0].id };
    const changed = repaired.activeScenarioId !== saved.activeScenarioId || scenarios.some((scenario, index) => scenario !== saved.scenarios[index]);
    if (changed) writeDocument(repaired);
    return repaired;
  }

  save(document: EnergyDocument): void {
    writeDocument(document);
  }
}

export function findScenario(document: EnergyDocument, id: string): EnergyScenario | undefined {
  return document.scenarios.find((scenario) => scenario.id === id);
}
