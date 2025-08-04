import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import React from 'react';


import { separator } from './FilePathSeparator';
import { AddressBar, AddressBarFunc, } from './AddressBar';
import { FileList, FileListFunc, FileListUiInfo, } from './FileList';

import { BUILDIN_COMMAND_TYPE, CommandExecuter, CommandExecuterFunc } from './CommandInfo';
import { KeyBindSetting, COMMAND_TYPE, readKeyBindSetting, match } from './KeyBindInfo';

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

import { MenuItem, ControlledMenu } from '@szhsin/react-menu';


import { basename, normalize } from '@tauri-apps/api/path';

import { executeShellCommand } from './RustFuncs';
import { TabFuncs } from './PaneTabs';
import { ContextMenuInfo, readContextMenuSetting } from './ContextMenu';
import { LogInfo } from './LogMessagePane';
import { FileFilterBar, FileFilterBarFunc, FileFilterType } from './FileFilterBar';
import { MenuitemStyle, ReadonlyTextInputStyle, useTheme } from './ThemeStyle';
import { UnlistenFn, listen } from '@tauri-apps/api/event';
import { PiLinkLight } from 'react-icons/pi';
import AutoSizer from 'react-virtualized-auto-sizer';


///////////////////////////////////////////////////////////////////////////////////////////////////
export type UpdateFileListUiInfo = {
  pane_idx: number,
  data: FileListUiInfo | null,
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export const MainPanel = (
  props: {
    isActive: boolean,
    panel_idx: number,
    dirPath: string,
    pined: boolean,
    onPathChanged: (newPath: string) => void
    onItemNumChanged: (newItemNum: number) => void,
    onSelectItemNumChanged: (newSelectItemNum: number) => void,
    tabFuncs: TabFuncs,
    getOppositePath: () => string,
    addLogMessage: (message: LogInfo) => void,
    separator: separator,
    focusOppositePane: () => void,
    focusCommandBar: () => void,
    gridRef?: React.RefObject<HTMLDivElement>,
    setKeyBind: (trgKey: React.KeyboardEvent<HTMLDivElement> | null) => void,
    duplicateTabToOppositePane: () => void,
  }
) => {
  useEffect(() => {
    filterBarFunc.current?.clearFilter();
    AccessDirectory(props.dirPath, null);
  }, [props.dirPath]);

  const [fileListInfo, setFileListInfo] = useState<FileListUiInfo | null>(null);

  const [linkDestination, setLinkDestination] = useState<string | null>(null);
  useEffect(
    () => {
      (async () => {
        const resolved = await invoke<string>("resolve_symbolic_link", { path: props.dirPath });
        setLinkDestination(resolved);
      })()
    },
    [props.dirPath]
  );

  useEffect(() => {
    props.onItemNumChanged(fileListInfo?.full_item_num ?? 0);
    const selectedItemNum = fileListInfo?.filtered_item_list
      .filter(item => item.file_list_item.is_selected)
      .length ?? 0;
    props.onSelectItemNumChanged(selectedItemNum);
  }, [fileListInfo]);

  const filterBarFunc = useRef<FileFilterBarFunc>(null);
  async function setFilter(filterType: FileFilterType, matcherString: String) {
    if (!fileListInfo) { return; }
    const newFileListInfo = await invoke<FileListUiInfo | null>(
      "set_filter",
      {
        paneIdx: props.panel_idx,
        filter: {
          filter_type: filterType,
          matcher_str: matcherString,
        }
      });
    setFileListInfo(newFileListInfo);
  }

  useEffect(() => {
    let unlisten: UnlistenFn | null;
    (async () => {
      unlisten = await listen('update_path_list', event => {
        const payload = (event.payload as UpdateFileListUiInfo);
        if (payload.pane_idx !== props.panel_idx) { return; }

        setFileListInfo(payload.data);
      });
    })()
    return () => { if (unlisten) { unlisten(); } }
  }, [])

  const [keyBindInfo, setKeyBindInfo] = useState<KeyBindSetting[]>([]);
  useEffect(() => {
    (async () => {
      const seting = await readKeyBindSetting();
      setKeyBindInfo(seting);
    })()
  }, []);

  const [focusToListOnContextMenuClosed, setFocusToListOnContextMenuClosed] = useState(false);

  const [contextMenuInfoAry, setContextMenuInfoAry] = useState<ContextMenuInfo[]>([]);

  useEffect(() => {
    (async () => {
      const seting = await readContextMenuSetting();
      setContextMenuInfoAry(seting);
    })()
  }, []);

  const ContextMenuFunc = useRef<ContextMenuFunc>(null);

  useEffect(() => {
    if (!ContextMenuFunc.current?.isMenuOpen) {
      if (focusToListOnContextMenuClosed) {
        myGrid?.current?.focus();
      }
    }
  }, [ContextMenuFunc.current?.isMenuOpen])

  function openContextMenu(pos: { x: number, y: number }) {
    ContextMenuFunc.current?.openMenu(
      contextMenuInfoAry.map(command => ({
        display_name: command.display_name,
        onClick: () => commandExecuterFunc.current?.execShellCommand(
          command.command_name,
          props.dirPath,
          FileListFunctions.current?.selectingItemName() ?? [],
          props.getOppositePath(),
          props.separator
        )
      })),
      pos);
  }


  const FileListFunctions = useRef<FileListFunc>(null);
  const addressBarFunc = useRef<AddressBarFunc>(null);

  const theme = useTheme();
  const readonlyTextInputStyle = ReadonlyTextInputStyle(theme.baseColor);

  const onAddressInputed = async (path: string) => {
    const adjusted = await invoke<AdjustedAddressbarStr>("adjust_addressbar_str", { str: path })
      .catch(_ => { return null; });
    AccessDirectory(
      adjusted?.dir ?? path,
      adjusted?.file_name ?? "");
    if (adjusted) {
      myGrid.current?.focus();
    }
  }

  const AccessDirectory = async (trgDir: string, trgFile: string | null) => {
    // normalize だと、ドライブ直下が `C:\\` となるので、一旦末端の区切りを削除してから、区切りを付加する。
    const newDir = (trgDir === "")
      ? ""
      : RemoveTrailingSeparators(await normalize(trgDir)) + props.separator;

    if (props.pined && props.dirPath !== newDir) {
      props.tabFuncs.addNewTab(newDir);
      return;
    }

    props.onPathChanged(newDir);
    const paneInfo = await invoke<FileListUiInfo>("set_dirctry_path", {
      paneIdx: props.panel_idx,
      path: newDir,
      initialFocus: trgFile,
    });
    setFileListInfo(paneInfo);
  }

  const focusAddoressBar = () => {
    setFocusToListOnContextMenuClosed(false);
    addressBarFunc.current?.focus();
  }
  const focusFilterBar = () => {
    setFocusToListOnContextMenuClosed(false);
    filterBarFunc.current?.focus();
  }
  const focusCommandBar = () => {
    setFocusToListOnContextMenuClosed(false);
    props.focusCommandBar();
  }



  const addNewTab = () => { props.tabFuncs.addNewTab(props.dirPath); }
  const removeTab = () => { props.tabFuncs.removeTab(); }
  const removeOtherTabs = () => { props.tabFuncs.removeOtherTabs(); }
  const removeAllRightTabs = () => { props.tabFuncs.removeAllRightTabs(); }
  const removeAllLeftTabs = () => { props.tabFuncs.removeAllLeftTabs(); }
  const toPrevTab = () => { props.tabFuncs.changeTab(-1); }
  const toNextTab = () => { props.tabFuncs.changeTab(+1); }

  const execBuildInCommand = (
    commandName: string,
    srcKey: React.KeyboardEvent<HTMLDivElement> | null
  ) => {
    if (!FileListFunctions) { return; }
    switch (commandName) {
      case BUILDIN_COMMAND_TYPE.accessCurrentItem: FileListFunctions.current?.accessCurrentItem(); return;
      case BUILDIN_COMMAND_TYPE.accessParentDir: accessParentDir(); return;
      case BUILDIN_COMMAND_TYPE.moveUp: FileListFunctions.current?.moveUp(); return;
      case BUILDIN_COMMAND_TYPE.moveUpSelect: FileListFunctions.current?.moveUpSelect(); return;
      case BUILDIN_COMMAND_TYPE.moveDown: FileListFunctions.current?.moveDown(); return;
      case BUILDIN_COMMAND_TYPE.moveDownSelect: FileListFunctions.current?.moveDownSelect(); return;
      case BUILDIN_COMMAND_TYPE.moveTop: FileListFunctions.current?.moveTop(); return;
      case BUILDIN_COMMAND_TYPE.moveTopSelect: FileListFunctions.current?.moveTopSelect(); return;
      case BUILDIN_COMMAND_TYPE.moveBottom: FileListFunctions.current?.moveBottom(); return;
      case BUILDIN_COMMAND_TYPE.moveBottomSelect: FileListFunctions.current?.moveBottomSelect(); return;
      case BUILDIN_COMMAND_TYPE.selectAll: FileListFunctions.current?.selectAll(); return;
      case BUILDIN_COMMAND_TYPE.clearSelection: FileListFunctions.current?.clearSelection(); return;
      case BUILDIN_COMMAND_TYPE.toggleSelection: FileListFunctions.current?.toggleSelection(); return;
      case BUILDIN_COMMAND_TYPE.selectCurrentOnly: FileListFunctions.current?.selectCurrentOnly(); return;
      case BUILDIN_COMMAND_TYPE.addNewTab: addNewTab(); return;
      case BUILDIN_COMMAND_TYPE.removeTab: removeTab(); return;
      case BUILDIN_COMMAND_TYPE.removeOtherTabs: removeOtherTabs(); return;
      case BUILDIN_COMMAND_TYPE.removeAllRightTabs: removeAllRightTabs(); return;
      case BUILDIN_COMMAND_TYPE.removeAllLeftTabs: removeAllLeftTabs(); return;
      case BUILDIN_COMMAND_TYPE.toPrevTab: toPrevTab(); return;
      case BUILDIN_COMMAND_TYPE.toNextTab: toNextTab(); return;
      case BUILDIN_COMMAND_TYPE.focusAddoressBar: focusAddoressBar(); return;
      case BUILDIN_COMMAND_TYPE.focusFilterBar: focusFilterBar(); return;
      case BUILDIN_COMMAND_TYPE.deleteFilterSingleSingle: filterBarFunc.current?.deleteFilterSingleSingle(); return;
      case BUILDIN_COMMAND_TYPE.clearFilter: filterBarFunc.current?.clearFilter(); return;
      case BUILDIN_COMMAND_TYPE.setFilterStrMatch: filterBarFunc.current?.setType(`StrMatch`); return;
      case BUILDIN_COMMAND_TYPE.setFilterRegExp: filterBarFunc.current?.setType(`RegExpr`); return;
      case BUILDIN_COMMAND_TYPE.focusOppositePane: props.focusOppositePane(); return;
      case BUILDIN_COMMAND_TYPE.focusCommandBar: focusCommandBar(); return;
      case BUILDIN_COMMAND_TYPE.setKeyBind: props.setKeyBind(srcKey); return;
      case BUILDIN_COMMAND_TYPE.duplicateTabToOppositePane: props.duplicateTabToOppositePane(); return;
    }
  }

  const execCommand = (
    command: KeyBindSetting,
    srcKey: React.KeyboardEvent<HTMLDivElement> | null
  ) => {
    if (!FileListFunctions) { return; }
    if (command.action.type === COMMAND_TYPE.build_in) {
      execBuildInCommand(command.action.command_name, srcKey);
      return
    }

    if (command.action.type === COMMAND_TYPE.power_shell) {
      commandExecuterFunc.current?.execShellCommand(
        command.action.command_name,
        props.dirPath,
        FileListFunctions.current?.selectingItemName() ?? [],
        props.getOppositePath(),
        props.separator);
      return
    }
  }

  const handlekeyboardnavigation = (keyboard_event: React.KeyboardEvent<HTMLDivElement>) => {
    if (ContextMenuFunc.current?.isMenuOpen()) { return; }
    const isFocusAddressBar = addressBarFunc.current?.isFocus() || filterBarFunc.current?.isFocus();
    const validKeyBindInfo = isFocusAddressBar
      ? keyBindInfo.filter(cmd => cmd.valid_on_addressbar)
      : keyBindInfo;
    const command_ary = validKeyBindInfo.filter(cmd => match(keyboard_event, cmd.key));

    const dummyMenuPos = { x: 400, y: 1000 };

    if (command_ary.length !== 0) {
      if (keyboard_event.key === "ContextMenu") {
        setFocusToListOnContextMenuClosed(true);
        openContextMenu(dummyMenuPos);
      }
      keyboard_event.preventDefault();
    }

    if (command_ary.length === 1) {
      execCommand(command_ary[0], keyboard_event)
      return;
    }

    if (command_ary.length >= 2) {
      ContextMenuFunc.current?.openMenu(
        command_ary.map(command => ({
          display_name: command.display_name,
          onClick: () => execCommand(command, keyboard_event),
        })),
        dummyMenuPos); // 適当…。
      setFocusToListOnContextMenuClosed(true);
      return;
    }

    const isSingleKey = // Shiftの押下は、とりあえず許容する事にしておく。
      !keyboard_event.ctrlKey &&
      !keyboard_event.altKey &&
      keyboard_event.key.length === 1;
    if (isSingleKey && !isFocusAddressBar) {
      filterBarFunc.current?.addFilterString(keyboard_event.key)
      return;
    }
  };

  type AdjustedAddressbarStr = {
    dir: string,
    file_name: string,
  };

  const accessParentDir = async () => {
    const dirName = await basename(props.dirPath).catch(_ => { return null; });
    if (dirName === null) {
      // dir が ドライブ自体(e.g. C:)のケース。
      // 空のパスを指定する事で、ドライブ一覧を出す。
      AccessDirectory("", props.dirPath);
      return;
    }

    AccessDirectory(
      props.dirPath + props.separator + '..',
      dirName);
  };

  const onDoubleClick = () => {
    accessParentDir();
  }

  const myGrid = props.gridRef ?? React.createRef<HTMLDivElement>();


  const commandExecuterFunc = useRef<CommandExecuterFunc>(null);

  const nameToPath = (name: string) => (props.dirPath.length === 0)
    ? name
    : (props.dirPath + props.separator + name);

  function LinkDestination() {
    return <div>
      <PiLinkLight />
      <input
        style={readonlyTextInputStyle}
        type="text"
        value={linkDestination ?? ""}
        readOnly
      />
    </div>
  }

  return (
    <>
      <div
        onKeyDown={handlekeyboardnavigation}
        css={css({
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr',
          overflow: 'auto',
          width: '100%',
          height: '100%',
        })}
      >
        <ContextMenu
          ref={ContextMenuFunc}
        />
        <AddressBar
          dirPath={props.dirPath}
          separator={props.separator}
          confirmInput={(path) => onAddressInputed(path)}
          onEndEdit={() => myGrid.current?.focus()}
          ref={addressBarFunc}
        />
        <div>
          {linkDestination ? LinkDestination() : null}
          <FileFilterBar
            onFilterChanged={setFilter}
            onEndEdit={() => myGrid.current?.focus()}
            ref={filterBarFunc}
          />
        </div>
        <div
          css={css([{ overflow: 'clip' }])}
          onDoubleClick={onDoubleClick}
          tabIndex={0}
          ref={myGrid}
          onContextMenu={e => {
            openContextMenu({
              x: e.clientX,
              y: e.clientY
            });
            e.preventDefault();
          }}
        >
          {fileListInfo ?
            <AutoSizer>
              {({ height, width }) => {
                return <FileList
                  isActive={props.isActive}
                  panel_idx={props.panel_idx}
                  fileListInfo={fileListInfo}
                  updateFileListInfo={setFileListInfo}
                  accessParentDir={accessParentDir}
                  accessDirectry={(dirName: string) => AccessDirectory(nameToPath(dirName), null)}
                  accessFile={(fileName: string) => {
                    const decoretedPath = '&"./' + fileName + '"';
                    executeShellCommand('Access file', decoretedPath, props.dirPath);
                  }}
                  focusOppositePane={props.focusOppositePane}
                  getOppositePath={props.getOppositePath}
                  gridRef={myGrid}
                  ref={FileListFunctions}
                  height={height}
                  width={width}
                />
              }
              }
            </AutoSizer>
            : <div>Directry Unfound.</div>}
        </div>
      </div>
      <CommandExecuter
        addLogMessage={props.addLogMessage}
        onDialogClose={() => { myGrid.current?.focus() }}
        ref={commandExecuterFunc}
      />
    </>
  );
}

function RemoveTrailingSeparators(path: string): string {
  return path.replace(/\\+$/, ''); // 正規化で、区切りは`\`になっている事前提。
}

///////////////////////////////////////////////////////////////////////////////////////////////////
type MenuItemInfo = {
  onClick: () => void,
  display_name: string,
}
interface ContextMenuFunc {
  openMenu: (
    menuItemList: MenuItemInfo[],
    pos: { x: number, y: number },
  ) => void,
  isMenuOpen: () => boolean
}
type ContextMenuProps = {
}
const ContextMenu = forwardRef<ContextMenuFunc, ContextMenuProps>((_props, ref) => {
  useImperativeHandle(ref, () => functions);

  const theme = useTheme();
  const menuItemStyle = MenuitemStyle(theme.baseColor);

  const [menuItemList, setMenuItemList] = useState<MenuItemInfo[]>([]);

  const [isContextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosX, setContextMenuPosX] = useState(0);
  const [contextMenuPosY, setContextMenuPosY] = useState(0);

  const functions = {
    openMenu: (
      menuItemList: MenuItemInfo[],
      pos: { x: number, y: number },
    ) => {
      setMenuItemList(menuItemList);
      setContextMenuPosX(pos.x);
      setContextMenuPosY(pos.y);
      setContextMenuOpen(true);
    },
    isMenuOpen: () => isContextMenuOpen,
  }

  return <ControlledMenu
    state={isContextMenuOpen ? 'open' : 'closed'}
    onClose={() => { setContextMenuOpen(false); }}
    anchorPoint={{ x: contextMenuPosX, y: contextMenuPosY }} // 適当…。
  >
    {
      menuItemList.map((command, idx) => {
        return <MenuItem
          css={menuItemStyle}
          onClick={command.onClick}
          key={idx}
        >
          {command.display_name}
        </MenuItem>
      })
    }
  </ControlledMenu >
});

