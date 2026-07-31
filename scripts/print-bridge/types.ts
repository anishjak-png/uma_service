export type PrintJobRow = {
  id: string;
  jobCardId: string;
  type: string;
  status: string;
  branchId: string;
  printerId: string;
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
  printedAt: string | null;
};

export type JobCardRow = {
  jobNumber: string;
  receivedAt: string;
  applianceType: string;
  brand: string;
  model: string | null;
  complaint: string;
  Customer: {
    mobile: string;
    name: string | null;
  } | null;
};

export type QueuedPrintJob = {
  id: string;
  jobNumber: string;
};
