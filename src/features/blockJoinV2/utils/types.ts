import { type Node as PMNode } from "prosemirror-model";

export type SuggestionId = string | number;

export interface ZwspInfo {
  pos: number;
  id: SuggestionId | null;
  isBlockStart: boolean;
  isBlockEnd: boolean;
  blockDepth: number;
  parentNode: PMNode;
}

export interface ZwspPair {
  zwsp1: ZwspInfo;
  zwsp2: ZwspInfo;
  shouldJoin: boolean;
  joinPos: number;
}

export interface BorderZwspInfo {
  leftZwsps: ZwspInfo[];
  rightZwsps: ZwspInfo[];
  pairsAcrossBorder: ZwspPair[];
}

export type JoinReason = "in-range" | "border-pair" | "border-removal";

export interface BlockJoinGroup {
  joinPos: number;
  zwspPositions: number[];
  reason: JoinReason;
}
