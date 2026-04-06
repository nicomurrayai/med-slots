import * as FileSystem from 'expo-file-system';

import { SlotMachineConfig } from '../types/slot';
import { createDefaultSlotMachineConfig, normalizeSlotMachineConfig } from '../utils/slotConfig';

const SLOT_CONFIG_FILE_NAME = 'med-slots-slot-config.json';

async function getSlotConfigFileUri() {
  const baseDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;

  if (!baseDirectory) {
    throw new Error('No config directory available for this device.');
  }

  return `${baseDirectory}${SLOT_CONFIG_FILE_NAME}`;
}

export async function loadSlotMachineConfig() {
  try {
    const fileUri = await getSlotConfigFileUri();
    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    if (!fileInfo.exists) {
      return createDefaultSlotMachineConfig();
    }

    const rawValue = await FileSystem.readAsStringAsync(fileUri);
    return normalizeSlotMachineConfig(JSON.parse(rawValue));
  } catch {
    return createDefaultSlotMachineConfig();
  }
}

export async function saveSlotMachineConfig(config: SlotMachineConfig) {
  const fileUri = await getSlotConfigFileUri();
  const normalizedConfig = normalizeSlotMachineConfig(config);

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(normalizedConfig));

  return normalizedConfig;
}
