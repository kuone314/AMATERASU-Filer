import { ApplySeparator } from "./FilePathSeparator";


///////////////////////////////////////////////////////////////////////////////////////////////////
export function IsValidIndex<T>(ary: T[], idx: number): boolean {
  return 0 <= idx && idx < ary.length;
}

export function LastIndex<T>(ary: T[]): number {
  return ary.length - 1;
}

export function First<T>(ary: T[]): T | null {
  return (ary.length !== 0) ? ary[0] : null;
}

export function Exist<T>(ary: T[], trg: T): boolean {
  return ary.find(item => item === trg) !== undefined;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export function Sequence(stt: number, size: number): number[] {
  if (size <= 0) { return []; }

  let result = [];
  for (let idx = 0; idx < size; idx++) {
    result.push(stt + idx);
  }
  return result;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export function DirName(dirPath: string): string {
  // ライブラリを使いたいが、良い感じで使える物が見当たらない…。
  const splited = ApplySeparator(dirPath, '/').split('/').reverse();
  if (splited[0].length !== 0) { return splited[0]; }
  return splited[1];
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export const alfabetList = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
];