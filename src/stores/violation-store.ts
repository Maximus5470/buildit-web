import { create } from "zustand";
import { recordMalpractice } from "@/lib/exam/malpractice-actions";

export type ViolationType = "fullscreen" | "tab" | "blur" | "devtools";

export type ViolationState =
  | "IDLE"
  | "VIOLATION_ACTIVE"
  | "RESOLVED"
  | "TERMINATED";

export interface ViolationRecord {
  violationType: ViolationType;
  count: number;
  timestamp: number;
  isBlocking: boolean;
}

const MAX_VIOLATIONS = 3;

interface ViolationStoreState {
  // Assignment ID for server sync (was sessionId)
  assignmentId: string | null;

  // Current violation state
  state: ViolationState;

  // Active violation (if any)
  activeViolation: ViolationRecord | null;

  // Violation history
  violations: ViolationRecord[];

  // Exam active flag (violations only apply during exam)
  examActive: boolean;

  // Termination callback
  onTerminate: (() => void) | null;

  // Processing lock to prevent race conditions
  isProcessing: boolean;

  // Actions
  setAssignmentId: (assignmentId: string) => void;
  setExamActive: (active: boolean) => void;
  setOnTerminate: (callback: () => void) => void;
  triggerViolation: (type: ViolationType) => void;
  resolveViolation: () => void;
  clearViolations: () => void;
  getViolationCount: (type: ViolationType) => number;
  getTotalViolations: () => number;
  isTerminated: () => boolean;
}

export const useViolationStore = create<ViolationStoreState>((set, get) => ({
  assignmentId: null,
  state: "IDLE",
  activeViolation: null,
  violations: [],
  examActive: false,
  onTerminate: null,
  isProcessing: false,

  setAssignmentId: (assignmentId) => {
    set({ assignmentId });
  },

  setExamActive: (active) => {
    set({ examActive: active });
    if (!active) {
      set({ state: "IDLE", activeViolation: null });
    }
  },

  setOnTerminate: (callback) => {
    set({ onTerminate: callback });
  },

  triggerViolation: (type) => {
    const { examActive, state, onTerminate, assignmentId, isProcessing } =
      get();

    if (!examActive) return;
    if (state === "TERMINATED") return;
    if (state === "VIOLATION_ACTIVE") return;
    if (isProcessing) return;

    set({ isProcessing: true });

    const existingViolations = get().violations.filter(
      (v) => v.violationType === type,
    );
    const count = existingViolations.length + 1;

    const newViolation: ViolationRecord = {
      violationType: type,
      count,
      timestamp: Date.now(),
      isBlocking: true,
    };

    const updatedViolations = [...get().violations, newViolation];
    const totalViolations = updatedViolations.length;

    set({
      state: "VIOLATION_ACTIVE",
      activeViolation: newViolation,
      violations: updatedViolations,
    });

    if (assignmentId) {
      recordMalpractice(assignmentId, type, `${type} violation`, true)
        .then((result) => {
          if (result.terminated) {
            set({
              state: "TERMINATED",
              isProcessing: false,
            });

            if (onTerminate) {
              setTimeout(() => onTerminate(), 100);
            }
            return;
          }

          // Check remaining warnings
          if (result.warningsLeft <= 0) {
            set({
              state: "TERMINATED",
              isProcessing: false,
            });

            if (onTerminate) {
              setTimeout(() => onTerminate(), 100);
            }
            return;
          }

          set({ isProcessing: false });
        })
        .catch(() => {
          set({ isProcessing: false });
        });
    } else {
      if (totalViolations >= MAX_VIOLATIONS) {
        set({
          state: "TERMINATED",
          isProcessing: false,
        });

        if (onTerminate) {
          setTimeout(() => onTerminate(), 100);
        }
        return;
      }

      set({ isProcessing: false });
    }
  },

  resolveViolation: () => {
    const { activeViolation, state } = get();

    if (!activeViolation) return;
    if (state === "TERMINATED") return;

    set({
      state: "RESOLVED",
      activeViolation: null,
    });

    setTimeout(() => {
      if (get().state === "RESOLVED") {
        set({ state: "IDLE" });
      }
    }, 100);
  },

  clearViolations: () => {
    set({
      state: "IDLE",
      activeViolation: null,
      violations: [],
      assignmentId: null,
      isProcessing: false,
      examActive: false,
    });
  },

  getViolationCount: (type) => {
    return get().violations.filter((v) => v.violationType === type).length;
  },

  getTotalViolations: () => {
    return get().violations.length;
  },

  isTerminated: () => {
    return get().state === "TERMINATED";
  },
}));
