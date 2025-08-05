import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import React from 'react';


/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

import { FileListRowColorSettings, RowColorSetting, readFileListRowColorSetting } from './FileNameColorSetting';
import { IsValidIndex } from './Utility';
import { MatchImpl } from './Matcher';
import { ColorCodeString } from './ColorCodeString';
import { useTheme } from './ThemeStyle';
import { invoke } from '@tauri-apps/api/core';
import { FixedSizeList } from 'react-window';


///////////////////////////////////////////////////////////////////////////////////////////////////
const SortKey = {
  name: "Name",
  type: "FileType",
  size: "Size",
  date: "Date",
} as const;
type SortKey = typeof SortKey[keyof typeof SortKey];

const defaultAdjustMargin = 2;

const outerBorderWidth = '3pt solid ';
const gridLineWidth = '1pt solid ';
const separatorWidth = '1px';

const minColWidth = 30;
const headerHeight = 25;
const rowHeight = 28;

const columns = [
  { title: "", sortKey: null, initialWidth: 30 }, // icon
  { title: "FileName", sortKey: SortKey.name, initialWidth: 280 },
  { title: "type", sortKey: SortKey.type, initialWidth: 70 },
  { title: "size", sortKey: SortKey.size, initialWidth: 100 },
  { title: "date", sortKey: SortKey.date, initialWidth: 170 },
];

///////////////////////////////////////////////////////////////////////////////////////////////////
export type FileListItem = {
  is_selected: boolean,
  file_name: string,
  file_extension: string,
  is_directory: boolean,
  file_icon: string | null,
  file_size: number | null,
  date: string | null,
}

export type FileListFilteredItem = {
  file_list_item: FileListItem,
  matched_idx_list: number[],
}

export type FileListUiInfo = {
  full_item_num: number,
  filtered_item_list: FileListFilteredItem[],
  focus_idx: number,
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export interface IFileListItemFilter {
  IsMatch(entry: FileListItem): boolean;
  GetMatchingIdxAry(fileName: string): number[];
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export interface FileListFunc {
  selectingItemName: () => string[],
  accessCurrentItem: () => void,
  moveUp: () => void,
  moveUpSelect: () => void,
  moveDown: () => void,
  moveDownSelect: () => void,
  moveTop: () => void,
  moveTopSelect: () => void,
  moveBottom: () => void,
  moveBottomSelect: () => void,
  selectAll: () => void,
  clearSelection: () => void,
  toggleSelection: () => void,
  selectCurrentOnly: () => void,
};

type FileListProps = {
  isActive: boolean,
  panel_idx: number,
  height: number,
  width: number,
  fileListInfo: FileListUiInfo,
  updateFileListInfo: (info: FileListUiInfo) => void,
  accessParentDir: () => void,
  accessDirectry: (dirName: string) => void,
  accessFile: (fileName: string) => void,
  focusOppositePane: () => void,
  getOppositePath: () => void,
  gridRef?: React.RefObject<HTMLDivElement>,
};

export const FileList = forwardRef<FileListFunc, FileListProps>((props, ref) => {
  useImperativeHandle(ref, () => functions);

  const [colWidths, setColWidths] = useState(columns.map(item => item.initialWidth));

  const [colorSetting, setColorSetting] = useState<FileListRowColorSettings | null>(null);
  useEffect(() => {
    (async () => {
      const color_seting = await readFileListRowColorSetting();
      setColorSetting(color_seting);
    })()
  }, []);

  const [adjustMargin, setAdjustMargin] = useState(defaultAdjustMargin);

  const listRef = useRef<any>(null);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  useEffect(() => {
    invoke(
      'set_viewing_idx_range',
      {
        paneIdx: props.panel_idx,
        rangeStt: visibleRange.start,
        rangeEnd: visibleRange.end,
      })
  }, [visibleRange]);

  useEffect(() => {
    const scrollIndex = CalcScrollIndex(visibleRange, props.fileListInfo.focus_idx, adjustMargin)
    listRef.current?.scrollToItem(scrollIndex);
    setAdjustMargin(defaultAdjustMargin);
  }, [props.fileListInfo.focus_idx]);

  const [mouseSelectInfo, setMouseSelectInfo] = useState<MouseSelectInfo | null>(null);

  useEffect(() => {
    myGrid.current?.focus();
  }, [mouseSelectInfo]);

  const theme = useTheme();

  const filteredEntries = props.fileListInfo.filtered_item_list;
  const currentIndex = props.fileListInfo.focus_idx;

  const addSelectingIndexRange = async (rangeTerm1: number, rangeTerm2: number) => {
    const paneInfo = await invoke<FileListUiInfo>("add_selecting_idx", {
      paneIdx: props.panel_idx,
      additionalSelectIdxList: SequenceAry(rangeTerm1, rangeTerm2),
    });
    props.updateFileListInfo(paneInfo);
  }

  const setCurrentIndex = async (newIndex: number, adjustMargin: number) => {
    if (!IsValidIndex(filteredEntries, newIndex)) { return; }
    if (newIndex === currentIndex) { return; }

    setAdjustMargin(adjustMargin);

    const paneInfo = await invoke<FileListUiInfo>("set_focus_idx", {
      paneIdx: props.panel_idx,
      newFocusIdx: newIndex,
    });
    props.updateFileListInfo(paneInfo);
  }

  const setupCurrentIndex = (newIndex: number, select: boolean) => {
    if (!IsValidIndex(filteredEntries, newIndex)) { return; }
    if (select) {
      addSelectingIndexRange(currentIndex, newIndex);
    }
    setCurrentIndex(newIndex, defaultAdjustMargin);
  }

  interface MouseSelectInfo {
    startIndex: number,
    shiftKey: boolean,
    ctrlKey: boolean,
  }
  const onMouseDown = (row_idx: number, event: React.MouseEvent<Element>) => {
    if (event.detail >= 2) {
      // stateの変更により、onDoubleClick が効かなくなるのを防ぐ為、
      // 処理を打ち切る。
      return;
    }

    if (event.buttons !== 1) { return; }
    const info = {
      startIndex: row_idx,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
    };
    setMouseSelectInfo(info);
    updateMouseSelection(info, row_idx);
  }
  const onMouseMove = (row_idx: number, event: React.MouseEvent<Element>) => {
    if (event.buttons !== 1) { return; }
    if (mouseSelectInfo === null) { return; }
    updateMouseSelection(mouseSelectInfo, row_idx);
  }
  const updateMouseSelection = (start: MouseSelectInfo, newIdx: number) => {
    if (start.shiftKey) {
      addSelectingIndexRange(currentIndex, newIdx); // for Shift+click
    } else if (start.ctrlKey) {
      addSelectingIndexRange(start.startIndex, newIdx);
    } else {
      setSelectingIndexArray(SequenceAry(start.startIndex, newIdx));
    }

    if (!IsValidIndex(filteredEntries, newIdx)) { return; }
    const isDrag = (start.startIndex !== newIdx);
    setCurrentIndex(newIdx, isDrag ? 1 : 0);
  }
  const onMouseUp = () => {
    setMouseSelectInfo(null);
  }

  const onMouseDoubleClick = (row_idx: number, event: React.MouseEvent<Element>) => {
    if (IsValidIndex(filteredEntries, row_idx)) {
      accessCurrentItem()
    } else {
      props.accessParentDir();
    }
    event.stopPropagation();
  }

  const accessCurrentItem = () => {
    if (!IsValidIndex(filteredEntries, currentIndex)) { return; }
    const entry = filteredEntries[currentIndex].file_list_item;
    if (entry.is_directory) {
      props.accessDirectry(entry.file_name);
    } else {
      props.accessFile(entry.file_name);
    }
  }

  const selectingItemName = () => {
    if (filteredEntries.length === 0) { return [''] }

    const result = filteredEntries
      .filter(item => item.file_list_item.is_selected)
      .map(item => item.file_list_item.file_name);

    return (result.length === 0)
      ? [filteredEntries[currentIndex].file_list_item.file_name]
      : result;
  }

  const moveUp = () => { setupCurrentIndex(currentIndex - 1, false) }
  const moveUpSelect = () => { setupCurrentIndex(currentIndex - 1, true) }
  const moveDown = () => { setupCurrentIndex(currentIndex + 1, false) }
  const moveDownSelect = () => { setupCurrentIndex(currentIndex + 1, true) }
  const moveTop = () => { setupCurrentIndex(0, false) }
  const moveTopSelect = () => { setupCurrentIndex(0, true) }
  const moveBottom = () => { setupCurrentIndex(filteredEntries.length - 1, false) }
  const moveBottomSelect = () => { setupCurrentIndex(filteredEntries.length - 1, true) }
  const selectAll = () => {
    const isSelectAll = filteredEntries.every(item => item.file_list_item.is_selected);
    if (isSelectAll) {
      clearSelection();
    } else {
      addSelectingIndexRange(0, filteredEntries.length - 1)
    }
  }
  const clearSelection = async () => {
    const paneInfo = await invoke<FileListUiInfo>("set_selecting_idx", {
      paneIdx: props.panel_idx,
      newSelectIdxList: [],
    });
    props.updateFileListInfo(paneInfo);
  }
  const toggleSelection = async () => {
    const paneInfo = await invoke<FileListUiInfo>("toggle_selection", {
      paneIdx: props.panel_idx,
      trgIdx: currentIndex,
    });
    props.updateFileListInfo(paneInfo);
  }
  const selectCurrentOnly = () => {
    setSelectingIndexArray([currentIndex]);
  }

  async function setSelectingIndexArray(newIdxList: Array<number>) {
    const paneInfo = await invoke<FileListUiInfo>("set_selecting_idx", {
      paneIdx: props.panel_idx,
      newSelectIdxList: newIdxList,
    });
    props.updateFileListInfo(paneInfo);
  }

  const myGrid = props.gridRef ?? React.createRef<HTMLDivElement>();

  const table_color = (row_idx: number) => {
    if (colorSetting === null) { return css(); }

    const toTableColor = (setting: RowColorSetting) => {
      const evenRowBackGroune
        = ColorCodeString.new(setting.evenRowBackGroune)?.val
        ?? colorSetting.defaultColor.evenRowBackGroune;
      const oddRowBackGroune
        = ColorCodeString.new(setting.oddRowBackGroune)?.val
        ?? colorSetting.defaultColor.oddRowBackGroune;
      const forGround
        = ColorCodeString.new(setting.forGround)?.val
        ?? colorSetting.defaultColor.forGround;
      const activeHightlight
        = ColorCodeString.new(setting.activeHightlight)?.val
        ?? colorSetting.defaultColor.activeHightlight;

      const background = (row_idx % 2 == 0)
        ? evenRowBackGroune
        : oddRowBackGroune;

      const borderHithlight = props.isActive && row_idx === currentIndex;

      const verticalBorder
        = gridLineWidth
        + (borderHithlight ? activeHightlight : theme.baseColor.stringDefaultColor);
      return css({
        background: background,
        color: forGround,
        boxSizing: 'border-box',
        borderTop: borderHithlight ? outerBorderWidth + activeHightlight : '',
        borderBottom: borderHithlight
          ? outerBorderWidth + activeHightlight
          : gridLineWidth + theme.baseColor.stringDefaultColor,
        borderRight: verticalBorder,
        borderLeft: verticalBorder,
      });
    }

    const entry = filteredEntries[row_idx];
    const isSelectionColor = props.isActive && entry.file_list_item.is_selected;
    if (isSelectionColor) {
      return toTableColor(colorSetting.selectionColor);
    }

    const found = colorSetting.settings.find(setting => {
      if (setting.matcher.isDirectory !== entry.file_list_item.is_directory) { return false; }
      if (!MatchImpl(setting.matcher.nameMatcher, entry.file_list_item.file_name)) { return false; }
      return true;
    });
    if (found) {
      return toTableColor(found.color);
    }

    return toTableColor(colorSetting.defaultColor);
  }

  const filteredItemNumInfo = () => {
    const filteredNum = (props.fileListInfo.full_item_num - filteredEntries.length);
    if (filteredNum === 0) { return '' }
    return filteredNum + ' file(s) filterd.'
  }

  function FileNameWithEmphasis(item: FileListFilteredItem): React.ReactNode {
    const file_name = item.file_list_item.file_name;
    const emphasisIdxAry = item.matched_idx_list;
    const charFlagPairs = file_name.split('').map((str, idx) => {
      const flag = emphasisIdxAry.includes(idx);
      return { str, flag };
    });

    const enphansisColor = (() => {
      if (!colorSetting) { return ``; }
      const found = colorSetting.settings.find(setting => {
        if (setting.matcher.isDirectory !== item.file_list_item.is_directory) { return false; }
        if (!MatchImpl(setting.matcher.nameMatcher, item.file_list_item.file_name)) { return false; }
        return true;
      });
      if (found) {
        return ColorCodeString.new(found.color.activeHightlight)?.val
          ?? colorSetting.defaultColor.activeHightlight;
      }
      return colorSetting.defaultColor.activeHightlight;
    })();

    return <>
      {charFlagPairs.map((pair, idx) => pair.flag
        ? <b style={{ color: enphansisColor }} key={idx}>{pair.str}</b>
        : <span key={idx}>{pair.str}</span>)}
    </>;
  }


  const functions = {
    selectingItemName: selectingItemName,
    accessCurrentItem,
    moveUp: moveUp,
    moveUpSelect: moveUpSelect,
    moveDown: moveDown,
    moveDownSelect: moveDownSelect,
    moveTop: moveTop,
    moveTopSelect: moveTopSelect,
    moveBottom: moveBottom,
    moveBottomSelect: moveBottomSelect,
    selectAll: selectAll,
    clearSelection: clearSelection,
    toggleSelection: toggleSelection,
    selectCurrentOnly,
  }

  const colWidthsTotal = colWidths.reduce((acc, cur) => acc + cur, 0);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    if (IsValidIndex(filteredEntries, index)) {
      const entry = filteredEntries[index].file_list_item;
      return (
        <div
          key={"Row" + index}
          style={{
            ...style,
            overflowX: "clip",
            display: "flex",
            boxSizing: "border-box",
          }}
        >
          <div
            onMouseDown={(event) => { onMouseDown(index, event) }}
            onMouseMove={(event) => { onMouseMove(index, event) }}
            onMouseUp={onMouseUp}
            onDoubleClick={(event) => { onMouseDoubleClick(index, event) }}
            css={table_color(index)}
            style={{
              display: "flex",
              boxSizing: "border-box",
              width: colWidthsTotal,
            }}>
            {columns.map((col, columnIndex) => (
              <div
                key={col.title}
                style={{
                  width: colWidths[columnIndex],
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: colWidths[columnIndex],
                    padding: "0 6px",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {(() => {
                    switch (columnIndex) {
                      case 0: return <img src={`data:image/bmp;base64,${entry.file_icon ?? ""}`} />;
                      case 1: return < >{FileNameWithEmphasis(filteredEntries[index])}</>;
                      case 2: return < >{entry.file_extension}</>;
                      case 3: return < >{entry.file_size ?? "-"}</>;
                      case 4: return < >{entry.date}</>;
                    }
                  })()}
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: separatorWidth,
                    height: "100%",
                    backgroundColor: theme.baseColor.stringDefaultColor,
                  }}
                >
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      return <div
        style={{ ...style }}
        onMouseDown={(event) => { onMouseDown(filteredEntries.length, event) }}
        onMouseUp={onMouseUp}
        onMouseMove={(event) => { onMouseMove(filteredEntries.length, event) }}
      >
        {filteredItemNumInfo()}
      </div>
    }
  };

  return (
    <div
      style={{
        height: props.height,
        width: props.width,
        overflowX: 'scroll',
        overflowY: 'clip',
      }}
    >
      <FileListHeader
        backgroundColor={theme.baseColor.backgroundColor}
        foregroundColor={theme.baseColor.stringDefaultColor}
        panel_idx={props.panel_idx}
        updateFileListInfo={props.updateFileListInfo}
        colWidths={colWidths}
        setColWidths={setColWidths}
      />
      <div style={{ flex: 1 }}>
        <FixedSizeList
          height={props.height - headerHeight}
          width={Math.max(colWidthsTotal, props.width)}
          itemSize={rowHeight}
          itemCount={filteredEntries.length + 1}
          ref={listRef}
          onItemsRendered={
            (props) => setVisibleRange({ start: props.visibleStartIndex, end: props.visibleStopIndex })}
        >
          {Row}
        </FixedSizeList>
      </div>
    </div>
  )
});

///////////////////////////////////////////////////////////////////////////////////////////////////
function CalcScrollIndex(
  visibleRange: { start: number; end: number; },
  focusIndex: number,
  margin: number
): number {
  const upside_adjust_pos = (focusIndex - margin);
  const outof_upside = upside_adjust_pos <= visibleRange.start;

  const downside_adjust_pos = focusIndex + margin;
  const outof_downside = downside_adjust_pos >= visibleRange.end;
  if (outof_upside && outof_downside) { return focusIndex; }
  if (outof_upside) { return upside_adjust_pos; }
  if (outof_downside) { return downside_adjust_pos; }
  return focusIndex;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function FileListHeader(
  props: {
    backgroundColor: string,
    foregroundColor: string,
    panel_idx: number,
    updateFileListInfo: (info: FileListUiInfo) => void,
    colWidths: number[],
    setColWidths: React.Dispatch<React.SetStateAction<number[]>>
  }
) {
  const resizeInfo = useRef<{ trgCol: number, initPos: number, initWidth: number } | null>(null);

  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    resizeInfo.current = { trgCol: index, initPos: e.clientX, initWidth: props.colWidths[index] };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (resizeInfo.current === null) { return; }
    const delta = e.clientX - resizeInfo.current.initPos;
    const newWidth = resizeInfo.current.initWidth + delta;
    const newWidths = [...props.colWidths];
    newWidths[resizeInfo.current.trgCol] = Math.max(minColWidth, newWidth);
    props.setColWidths(newWidths);
  };

  const handleMouseUp = () => {
    resizeInfo.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const separator = (idx: number) => <div
    onMouseDown={(e) => handleMouseDown(idx, e)}
    style={{
      position: "absolute",
      right: 0,
      top: 0,
      width: separatorWidth,
      height: "100%",
      cursor: "col-resize",
      zIndex: 1,
      backgroundColor: props.foregroundColor,
    }}
  />

  return <div
    style={{
      height: headerHeight,
      display: "flex",
      fontWeight: "bold",
      borderTop: gridLineWidth + props.foregroundColor,
      borderBottom: gridLineWidth + props.foregroundColor,
      borderLeft: gridLineWidth + props.backgroundColor,
      borderRight: gridLineWidth + props.backgroundColor,
    }}>
    {columns.map((col, idx) => (
      <div
        key={idx}
        onClick={async () => {
          if (!col.sortKey) return;
          const paneInfo = await invoke<FileListUiInfo>('sort_file_list', {
            paneIdx: props.panel_idx,
            sortKey: col.sortKey,
          });
          props.updateFileListInfo(paneInfo);
        }}
        style={{
          flexShrink: 0,
          position: "relative",
          width: props.colWidths[idx],
          padding: "0 8px",
          boxSizing: "border-box",
          userSelect: "none",
          backgroundColor: props.backgroundColor,
        }}
      >
        {col.title}
        {separator(idx)}
      </div>
    ))}
  </div>
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function SequenceAry(rangeTerm1: number, rangeTerm2: number) {
  const sttIdx = Math.min(rangeTerm1, rangeTerm2);
  const endIdx = Math.max(rangeTerm1, rangeTerm2);

  let new_ary = new Array<number>();
  for (let idx = sttIdx; idx <= endIdx; idx++) {
    new_ary.push(idx);
  }
  return new_ary;
}
