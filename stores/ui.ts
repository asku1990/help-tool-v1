'use client';
import { create } from 'zustand';

type UiState = {
  vehicleListNotice: string | null;
  isExpenseDialogOpen: boolean;
  setExpenseDialogOpen: (_open: boolean) => void;
  isFillUpDialogOpen: boolean;
  setFillUpDialogOpen: (_open: boolean) => void;
  isVehicleDialogOpen: boolean;
  setVehicleDialogOpen: (_open: boolean) => void;
};

export const useUiStore = create<UiState>(set => ({
  vehicleListNotice: null,
  isExpenseDialogOpen: false,
  setExpenseDialogOpen: open => set({ isExpenseDialogOpen: open }),
  isFillUpDialogOpen: false,
  setFillUpDialogOpen: open => set({ isFillUpDialogOpen: open }),
  isVehicleDialogOpen: false,
  setVehicleDialogOpen: open => set({ isVehicleDialogOpen: open }),
}));
