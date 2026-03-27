export interface Word {
  text: string;
  start: number;
  end: number;
  type: string;
  logprob?: number;
}

export interface Transcript {
  text: string;
  words: Word[];
}

export interface TimeRange {
  start: number;
  end: number;
}
