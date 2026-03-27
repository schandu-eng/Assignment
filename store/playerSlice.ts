import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { addSkippedRange, removeRangeCoveringTime } from "@/lib/transcript";
import type { TimeRange } from "@/types/transcript";

export type PlayerSliceState = {
  padding: number;
  borderRadius: number;
  skippedRanges: TimeRange[];
};

const initialState: PlayerSliceState = {
  padding: 32,
  borderRadius: 32,
  skippedRanges: [],
};

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    setPadding(state, action: PayloadAction<number>) {
      state.padding = action.payload;
    },
    setBorderRadius(state, action: PayloadAction<number>) {
      state.borderRadius = action.payload;
    },
    addSkipRange: {
      reducer(
        state,
        action: PayloadAction<{ startSec: number; endSec: number }>,
      ) {
        state.skippedRanges = addSkippedRange(
          state.skippedRanges,
          action.payload.startSec,
          action.payload.endSec,
        );
      },
      prepare(startSec: number, endSec: number) {
        return { payload: { startSec, endSec } };
      },
    },
    removeSkipAtPlaybackTime(state, action: PayloadAction<number>) {
      state.skippedRanges = removeRangeCoveringTime(
        state.skippedRanges,
        action.payload,
      );
    },
    clearAllSkips(state) {
      state.skippedRanges = [];
    },
  },
});

export const {
  setPadding,
  setBorderRadius,
  addSkipRange,
  removeSkipAtPlaybackTime,
  clearAllSkips,
} = playerSlice.actions;

export default playerSlice.reducer;
