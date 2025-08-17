'use client';
import { create } from 'zustand';

type UiState = {
  isExpenseDialogOpen: boolean;
  setExpenseDialogOpen: (open: boolean) => void;
  isFillUpDialogOpen: boolean;
  setFillUpDialogOpen: (open: boolean) => void;
  isVehicleDialogOpen: boolean;
  setVehicleDialogOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>(set => ({
  isExpenseDialogOpen: false,
  setExpenseDialogOpen: open => set({ isExpenseDialogOpen: open }),
  isFillUpDialogOpen: false,
  setFillUpDialogOpen: open => set({ isFillUpDialogOpen: open }),
  isVehicleDialogOpen: false,
  setVehicleDialogOpen: open => set({ isVehicleDialogOpen: open }),
}));
