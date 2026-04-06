export type LeadEntry = {
  id: number;
  email: string;
  capturedAtMs: number;
};

export type LeadExportResult = {
  fileName: string;
  fileUri: string;
  totalLeads: number;
};
