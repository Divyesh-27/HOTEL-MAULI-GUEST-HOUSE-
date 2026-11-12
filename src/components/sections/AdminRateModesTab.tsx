import { useEffect, useState, FormEvent } from 'react';
import { AlertCircle, Check, CheckCircle, Plus, Save, Tag, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { NumberInput } from '@/components/ui/number-input';
import { NORMAL_RATE_MODE_ID, getActiveRateMode, getExplicitModeRate } from '@/utils/rateModeUtils';

/**
 * Admin → Season Rates.
 * Pick a mode to edit its per-room rates, and choose which mode is ACTIVE
 * (used for new bookings). Existing bookings keep the rates they were created with.
 */
export const AdminRateModesTab = () => {
  const {
    rooms, rateModes, activeRateModeId, roomModeRates,
    addRateMode, renameRateMode, deleteRateMode, setActiveRateMode, setRoomModeRates, updateRoom,
  } = useStore(useShallow(state => ({
    rooms: state.rooms,
    rateModes: state.rateModes,
    activeRateModeId: state.activeRateModeId,
    roomModeRates: state.roomModeRates,
    addRateMode: state.addRateMode,
    renameRateMode: state.renameRateMode,
    deleteRateMode: state.deleteRateMode,
    setActiveRateMode: state.setActiveRateMode,
    setRoomModeRates: state.setRoomModeRates,
    updateRoom: state.updateRoom,
  })));

  const activeMode = getActiveRateMode({ rooms, rateModes, activeRateModeId });
  const [selectedModeId, setSelectedModeId] = useState(activeMode.id);
  const selectedMode = rateModes.find(m => m.id === selectedModeId) || activeMode;
  const isNormal = selectedMode.id === NORMAL_RATE_MODE_ID;
  const isActive = selectedMode.id === activeMode.id;

  const [newModeName, setNewModeName] = useState('');
  const [nameDraft, setNameDraft] = useState(selectedMode.name);
  // Unsaved rate edits for the selected mode: roomNo -> typed rate (0 = cleared).
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNameDraft(selectedMode.name);
  }, [selectedMode.id, selectedMode.name]);

  const hasEdits = Object.keys(edits).length > 0;

  const selectMode = (id: string) => {
    if (id === selectedMode.id) return;
    if (hasEdits && !window.confirm('You have unsaved rate changes for this mode. Discard them?')) return;
    setEdits({});
    setError(null);
    setSaved(false);
    setSelectedModeId(id);
  };

  const handleAddMode = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = addRateMode(newModeName);
    if (!result.success) {
      setError(result.error || 'Could not add mode.');
      return;
    }
    setNewModeName('');
    if (result.id && !hasEdits) setSelectedModeId(result.id);
  };

  const handleRename = () => {
    setError(null);
    const result = renameRateMode(selectedMode.id, nameDraft);
    if (!result.success) setError(result.error || 'Could not rename mode.');
  };

  const handleDelete = () => {
    setError(null);
    if (!window.confirm(`Delete the "${selectedMode.name}" mode and its rates? Existing bookings are not affected.`)) return;
    const result = deleteRateMode(selectedMode.id);
    if (!result.success) {
      setError(result.error || 'Could not delete mode.');
      return;
    }
    setEdits({});
    setSelectedModeId(activeMode.id);
  };

  const handleActivate = () => {
    if (isActive) return;
    if (hasEdits) {
      setError('Save or discard your rate changes before switching the active mode.');
      return;
    }
    if (!window.confirm(`Make "${selectedMode.name}" the active rate mode?\n\nNew bookings will use ${selectedMode.name} rates. Existing bookings, bills and history are not changed.`)) return;
    setError(null);
    setActiveRateMode(selectedMode.id);
  };

  const handleSaveRates = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    for (const [roomNo, rate] of Object.entries(edits)) {
      if (!Number.isFinite(rate) || rate < 0) {
        setError(`Room ${roomNo}: rate must be a positive number.`);
        return;
      }
      if (isNormal && rate <= 0) {
        setError(`Room ${roomNo}: the Normal rate cannot be empty or zero.`);
        return;
      }
    }

    if (isNormal) {
      // Normal rates are the rooms' own rent (same path as "Edit Room").
      for (const [roomNo, rate] of Object.entries(edits)) {
        const room = rooms.find(r => r.roomNo === roomNo);
        if (room && room.rent !== rate) updateRoom(roomNo, { ...room, rent: rate });
      }
    } else {
      // Empty / 0 clears the override so the room uses its Normal rate in this mode.
      const changes: Record<string, number | null> = {};
      for (const [roomNo, rate] of Object.entries(edits)) changes[roomNo] = rate > 0 ? rate : null;
      setRoomModeRates(selectedMode.id, changes);
    }

    setEdits({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Mode switcher */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" /> Season Rate Modes
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              New bookings use the rates of the <strong className="text-foreground">active</strong> mode. Existing
              bookings, bills and history always keep the rates they were created with.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
            Active: {activeMode.name}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {rateModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => selectMode(mode.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all',
                mode.id === selectedMode.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {mode.name}
              {mode.id === activeMode.id && <CheckCircle className="w-4 h-4" />}
            </button>
          ))}
        </div>

        <form onSubmit={handleAddMode} className="flex gap-2 mt-4 max-w-md">
          <input
            type="text"
            placeholder="New mode name (e.g. Christmas)"
            value={newModeName}
            onChange={(e) => setNewModeName(e.target.value)}
            className="flex-1 px-3 py-2 border rounded text-sm"
          />
          <button
            type="submit"
            disabled={!newModeName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Mode
          </button>
        </form>
      </div>

      {/* Selected mode: name, activate, rates */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4 mb-5 pb-4 border-b border-border">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Mode Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="px-3 py-2 border rounded text-sm bg-background"
              />
              <button
                type="button"
                onClick={handleRename}
                disabled={!nameDraft.trim() || nameDraft.trim() === selectedMode.name}
                className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isNormal && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isActive}
                title={isActive ? 'Switch to another mode before deleting this one' : 'Delete this mode'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Delete Mode
              </button>
            )}
            <button
              type="button"
              onClick={handleActivate}
              disabled={isActive}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Check className="w-4 h-4" /> {isActive ? 'Active Mode' : 'Set as Active Mode'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveRates}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-base">Room Rates — {selectedMode.name}</h4>
            {!isNormal && (
              <p className="text-xs text-muted-foreground">Leave a rate empty to use the room's Normal rate.</p>
            )}
          </div>

          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <th className="text-left font-bold px-4 py-2">Room</th>
                  <th className="text-left font-bold px-4 py-2">Category</th>
                  <th className="text-left font-bold px-4 py-2">Bed Type</th>
                  {!isNormal && <th className="text-right font-bold px-4 py-2">Normal Rate (₹)</th>}
                  <th className="text-right font-bold px-4 py-2">{selectedMode.name} Rate (₹)</th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={isNormal ? 4 : 5} className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No rooms yet. Add rooms in Room Management.
                    </td>
                  </tr>
                )}
                {rooms.map((room) => {
                  const stored = isNormal ? room.rent : getExplicitModeRate(room.roomNo, selectedMode.id, roomModeRates);
                  const value = room.roomNo in edits ? edits[room.roomNo] : stored;
                  return (
                    <tr key={room.roomNo} className="border-t border-border">
                      <td className="px-4 py-2 font-bold">{room.roomNo}</td>
                      <td className="px-4 py-2 text-muted-foreground">{room.category}</td>
                      <td className="px-4 py-2 text-muted-foreground">{room.bedType}</td>
                      {!isNormal && <td className="px-4 py-2 text-right font-mono text-muted-foreground">{room.rent}</td>}
                      <td className="px-4 py-2 text-right">
                        <NumberInput
                          key={`${selectedMode.id}-${room.roomNo}`}
                          min="0"
                          step="any"
                          value={value || ''}
                          placeholder={isNormal ? 'Rate' : String(room.rent)}
                          onValueChange={(v) => {
                            setSaved(false);
                            setEdits(prev => ({ ...prev, [room.roomNo]: v }));
                          }}
                          className="w-32 px-3 py-1.5 border rounded text-sm bg-background font-mono text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            {saved && (
              <span className="text-xs font-bold text-primary flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Rates saved
              </span>
            )}
            <button
              type="button"
              onClick={() => { setEdits({}); setError(null); }}
              disabled={!hasEdits}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={!hasEdits}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Save Rates
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
