import { useState } from 'react';
import { formatNumber } from '../domain';
import type { EnergyScenario } from '../types';

interface ScenarioCardProps {
  scenario: EnergyScenario;
  totalKwh: number;
  active: boolean;
  canDelete: boolean;
  canMoveBack: boolean;
  canMoveForward: boolean;
  onSelect: () => void;
  onRename: (name: string) => boolean;
  onRemove: () => void;
  onMove: (offset: -1 | 1) => void;
}

export function ScenarioCard({ scenario, totalKwh, active, canDelete, canMoveBack, canMoveForward, onSelect, onRename, onRemove, onMove }: ScenarioCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(scenario.name);

  const startEdit = () => { setDraft(scenario.name); setEditing(true); };
  const confirmEdit = () => { if (onRename(draft)) setEditing(false); };
  const cancelEdit = () => { setDraft(scenario.name); setEditing(false); };

  if (editing) {
    return <div className={`scenario-card editing ${active ? 'active' : ''}`}>
      <input
        className="scenario-name-input"
        value={draft}
        autoFocus
        aria-label="方案名称"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') confirmEdit(); if (event.key === 'Escape') cancelEdit(); }}
      />
      <div className="scenario-actions">
        <button type="button" aria-label="确认重命名" title="确认" onClick={confirmEdit}>✓</button>
        <button type="button" aria-label="取消重命名" title="取消" onClick={cancelEdit}>×</button>
      </div>
    </div>;
  }

  return <div className={`scenario-card ${active ? 'active' : ''}`}>
    <button type="button" className="scenario-main" onClick={onSelect}>
      <span className="scenario-dot" />
      <span className="scenario-copy"><strong>{scenario.name}</strong><small>{scenario.devices.length} 台设备 · {formatNumber(totalKwh)} kWh / 月</small></span>
      <span className="arrow">→</span>
    </button>
    <div className="scenario-actions">
      <button type="button" aria-label={`前移${scenario.name}`} title="前移" disabled={!canMoveBack} onClick={() => onMove(-1)}>←</button>
      <button type="button" aria-label={`后移${scenario.name}`} title="后移" disabled={!canMoveForward} onClick={() => onMove(1)}>→</button>
      <button type="button" aria-label={`重命名${scenario.name}`} title="重命名" onClick={startEdit}>✎</button>
      <button type="button" className="danger" aria-label={`删除${scenario.name}`} title={canDelete ? '删除' : '最后一个方案不能删除'} disabled={!canDelete} onClick={onRemove}>🗑</button>
    </div>
  </div>;
}
