import { MonthlyDaySummary, TimeEntryType } from './work-day';

export interface ManualInterval {
  clockIn: string;
  clockOut: string;
}

export interface ManualAdjustmentPayload {
  reason: string;
  intervals: ManualInterval[];
}

export interface WorkDayAdjustmentSnapshotEntry {
  type: TimeEntryType;
  timestamp: string;
  source: 'CLOCK' | 'MANUAL';
}

export interface WorkDayAdjustment {
  id: string;
  workDayId: string;
  reason: string;
  beforeEntries: WorkDayAdjustmentSnapshotEntry[];
  afterEntries: WorkDayAdjustmentSnapshotEntry[];
  createdAt: string;
}

export interface WorkDayAdjustmentsResponse {
  date: string;
  adjustments: WorkDayAdjustment[];
}

export interface ManualAdjustmentResponse {
  summary: MonthlyDaySummary;
  adjustment: WorkDayAdjustment;
}
