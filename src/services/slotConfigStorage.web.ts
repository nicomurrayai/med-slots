import { SlotMachineConfig } from '../types/slot';
import { createDefaultSlotMachineConfig, normalizeSlotMachineConfig } from '../utils/slotConfig';

const SLOT_CONFIG_STORAGE_KEY = 'med-slots-slot-config';

export async function loadSlotMachineConfig() {
  if (typeof window === 'undefined') {
    return createDefaultSlotMachineConfig();
  }

  try {
    const rawValue = window.localStorage.getItem(SLOT_CONFIG_STORAGE_KEY);

    if (!rawValue) {
      return createDefaultSlotMachineConfig();
    }

    return normalizeSlotMachineConfig(JSON.parse(rawValue));
  } catch {
    return createDefaultSlotMachineConfig();
  }
}

export async function saveSlotMachineConfig(config: SlotMachineConfig) {
  const normalizedConfig = normalizeSlotMachineConfig(config);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SLOT_CONFIG_STORAGE_KEY, JSON.stringify(normalizedConfig));
  }

  return normalizedConfig;
}
