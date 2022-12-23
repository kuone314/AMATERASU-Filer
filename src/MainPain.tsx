import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api';
import React from 'react';

import { Box, Button } from '@mui/material';

import 'jqwidgets-scripts/jqwidgets/styles/jqx.base.css';
import 'jqwidgets-scripts/jqwidgets/styles/jqx.material-purple.css';
import JqxGrid, { IGridProps, jqx, IGridColumn, IGridSource } from 'jqwidgets-scripts/jqwidgets-react-tsx/jqxgrid';

import { executeShellCommand } from './RustFuncs';
import { CommandInfo, COMMAND_TYPE, DIALOG_TYPE, DialogType, matchingKeyEvent } from './CommandInfo';

import styles from './App.module.css'


///////////////////////////////////////////////////////////////////////////////////////////////////
type Entry = {
  name: string,
  is_dir: boolean,
  extension: string,
  size: number,
  date: string,
};

type Entries = Array<Entry>;

///////////////////////////////////////////////////////////////////////////////////////////////////
export interface TabInfo {
  pathAry: string[],
  activeTabIndex: number,
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function decoratePath(path: String): string {
  return '"' + path + '"';
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export const PaineTabs = (
  props: {
    pathAry: TabInfo,
    onPathChanged: (path: string) => void,
    onTabsChanged: (newTabs: string[], newTabIdx: number, painIndex: number) => void,
    painIndex: number,
  },
) => {
  const [tabAry, setTabAry] = useState<string[]>(props.pathAry.pathAry);
  const [activeTabIdx, setActiveTabIdx] = useState<number>(props.pathAry.activeTabIndex);
  const addNewTab = (newTabPath: string, addPosIdx: number) => {
    let newTabAry = Array.from(tabAry);
    newTabAry.splice(addPosIdx + 1, 0, newTabPath);
    setTabAry(newTabAry);
  }
  const removeTab = (idx: number) => {
    if (tabAry.length === 1) { return; }
    if (idx >= tabAry.length) { return; }

    let newTabAry = Array.from(tabAry);
    newTabAry.splice(idx, 1);
    setTabAry(newTabAry);

    if (activeTabIdx >= newTabAry.length) {
      setActiveTabIdx(newTabAry.length - 1);
    }
  }

  const onPathChanged = (newPath: string, tabIdx: number) => {
    tabAry[tabIdx] = newPath
    setTabAry(Array.from(tabAry));

    props.onPathChanged(newPath);
  }

  useEffect(() => {
    props.onTabsChanged(tabAry, activeTabIdx, props.painIndex);
  }, [tabAry, activeTabIdx]);

  const pathToTabName = (pathStr: string) => {
    const splited = pathStr.split('\\').reverse();
    if (splited[0].length !== 0) { return splited[0]; }
    return splited[1];
  }

  const tabColor = (path: string) => {
    if (path.startsWith('C')) return '#ffff00'
    return '#00ff00'
  }

  return (
    <>
      <div className={styles.PaineTabs}>
        <div
          className={styles.TabButton}
        >
          {
            tabAry.map((path, idx) => {
              return <Button
                style={
                  {
                    textTransform: 'none',
                    background: tabColor(path),
                    border: (idx === activeTabIdx) ? '5px solid #ff0000' : '',
                  }
                }
                onClick={() => { setActiveTabIdx(idx) }}
                defaultValue={pathToTabName(path)}
              >
                {pathToTabName(path)}
              </Button>
            })
          }
        </div >
        <MainPanel
          initPath={tabAry[activeTabIdx]}
          tabIdx={activeTabIdx}
          onPathChanged={onPathChanged}
          addNewTab={addNewTab}
          removeTab={removeTab}
          key={tabAry[activeTabIdx]}
        />
      </div>
    </>
  )
}

///////////////////////////////////////////////////////////////////////////////////////////////////
const MainPanel = (
  props: {
    initPath: string,
    tabIdx: number,
    onPathChanged: (newPath: string, tabIdx: number) => void
    addNewTab: (newTabPath: string, addPosIdx: number) => void,
    removeTab: (idx: number) => void,
  }
) => {
  const [addressbatStr, setAddressbatStr] = useState<string>("");
  const [dir, setDir] = useState<string>(props.initPath);
  const [entries, setEntries] = useState<Entries>([]);
  const [currentIndex, setCurrentIndex] = useState(0);


  const UpdateList = async () => {
    const newEntries = await invoke<Entries>("get_entries", { path: dir })
      .catch(err => {
        console.error(err);
        return null;
      });

    if (!newEntries) { return; }
    if (JSON.stringify(newEntries) === JSON.stringify(entries)) {
      return;
    }
    setEntries(newEntries);
  }

  useEffect(() => {
    UpdateList();
    setAddressbatStr(dir);
    props.onPathChanged(dir, props.tabIdx);
  }, [dir]);

  useEffect(() => {
    setInterval(
      UpdateList,
      1500
    );
  }, []);

  const convert = (entries: Entries) => {
    const data: IGridProps['source'] = {
      localdata: entries.map(
        (entry: Entry, index: number) => {
          return [
            entry.name,
            entry.is_dir ? 'folder' : entry.extension.length === 0 ? '-' : entry.extension,
            entry.is_dir ? '-' : entry.size,
            entry.date,
            index === currentIndex,
          ];
        }
      ),
      datafields:
        [
          { name: 'name', type: 'string', map: '0' },
          { name: 'extension', type: 'string', map: '1' },
          { name: 'size', type: 'number', map: '2' },
          { name: 'date', type: 'string', map: '3' },
          { name: 'isCurrent', type: 'bool', map: '4' },
        ],
      datatype: 'array'
    };
    return data;
  }

  const cellsrenderer = (
    row?: number,
    columnfield?: string,
    value?: any,
    defaulthtml?: string,
    columnproperties?: any,
    rowdata?: any
  ) => {
    if (rowdata.isCurrent) {
      return '<div style="border-style : double none;">' + value + '</div>';;
    }
    return '<div>' + value + '</div>';
  };

  const columns: IGridProps['columns'] =
    [
      { text: 'FIleName', datafield: 'name', width: 240, cellsrenderer: cellsrenderer, },
      { text: 'type', datafield: 'extension', width: 80, cellsrenderer: cellsrenderer, },
      { text: 'size', datafield: 'size', width: 40, cellsrenderer: cellsrenderer, },
      { text: 'date', datafield: 'date', width: 150, cellsrenderer: cellsrenderer, },
    ];

  const setupCurrentIndex = (newIndex: number, select: boolean) => {
    if (currentIndex === newIndex) { return; }
    if (newIndex < 0) { return; }
    if (newIndex >= entries.length) { return; }

    setCurrentIndex(newIndex)
    setincremantalSearchingStr('')

    if (!select) { return }

    const sttIdx = Math.min(currentIndex, newIndex);
    const endIdx = Math.max(currentIndex, newIndex);
    for (let idx = sttIdx; idx <= endIdx; idx++) {
      myGrid.current?.selectrow(idx);
    }
  }

  const [incremantalSearchingStr, setincremantalSearchingStr] = useState('');
  const incremantalSearch = (key: string) => {
    const nextSearchStr = incremantalSearchingStr + key;
    const idx = entries.findIndex((entry) => {
      return entry.name.toLowerCase().startsWith(nextSearchStr)
    })
    if (idx === -1) { return }

    setCurrentIndex(idx)
    setincremantalSearchingStr(nextSearchStr)
  }

  const onRowclick = (event?: Event) => {
    if (!event) { return; }

    interface Args {
      args: { rowindex: number; }
    }
    const event_ = event as any as Args;
    setCurrentIndex(event_.args.rowindex);
    setincremantalSearchingStr('')
  };

  const onRowdoubleclick = (event?: Event) => {
    if (!event) { return; }

    interface Args {
      args: { rowindex: number; }
    }
    const event_ = event as any as Args;
    accessItemByIdx(event_.args.rowindex);
  };

  const accessItemByIdx = (rowIdx: number) => {
    const entry = entries[rowIdx];
    if (entry.is_dir) {
      setDir(dir + '/' + entry.name)
    } else {
      const decoretedPath = '&"' + entry.name + '"';
      executeShellCommand(decoretedPath, dir);
    }
  }
  const accessCurrentItem = () => {
    accessItemByIdx(currentIndex);
  }

  const selectingItemName = () => {
    if (entries.length === 0) { return [''] }

    let rowIdxAry = myGrid.current?.getselectedrowindexes();
    if (!rowIdxAry || rowIdxAry.length === 0) { rowIdxAry = [currentIndex]; }

    return rowIdxAry.map(idx => entries[idx].name);
  }

  const selectingItemPath = () => {
    return selectingItemName().map(name => dir + '\\' + name);
  }

  const moveUp = () => { setupCurrentIndex(currentIndex - 1, false) }
  const moveUpSelect = () => { setupCurrentIndex(currentIndex - 1, true) }
  const moveDown = () => { setupCurrentIndex(currentIndex + 1, false) }
  const moveDownSelect = () => { setupCurrentIndex(currentIndex + 1, true) }
  const moveTop = () => { setupCurrentIndex(0, false) }
  const moveTopSelect = () => { setupCurrentIndex(0, true) }
  const moveBottom = () => { setupCurrentIndex(entries.length - 1, false) }
  const moveBottomSelect = () => { setupCurrentIndex(entries.length - 1, true) }
  const toggleSelection = () => {
    if (myGrid.current?.getselectedrowindexes().includes(currentIndex)) {
      myGrid.current?.unselectrow(currentIndex);
    } else {
      myGrid.current?.selectrow(currentIndex);
    }
  }
  const addNewTab = () => { props.addNewTab(dir, props.tabIdx); }
  const removeTab = () => { props.removeTab(props.tabIdx); }

  const execBuildInCommand = (commandName: string) => {
    switch (commandName) {
      case 'accessCurrentItem': accessCurrentItem(); return;
      case 'moveUp': moveUp(); return;
      case 'moveUpSelect': moveUpSelect(); return;
      case 'moveDown': moveDown(); return;
      case 'moveDownSelect': moveDownSelect(); return;
      case 'moveTop': moveTop(); return;
      case 'moveTopSelect': moveTopSelect(); return;
      case 'moveBottom': moveBottom(); return;
      case 'moveBottomSelect': moveBottomSelect(); return;
      case 'toggleSelection': toggleSelection(); return;
      case 'addNewTab': addNewTab(); return;
      case 'removeTab': removeTab(); return;
    }
  }

  const execCommand = (command: CommandInfo) => {
    if (command.action.type === COMMAND_TYPE.build_in) {
      execBuildInCommand(command.action.command);
      return
    }

    if (command.action.type === COMMAND_TYPE.power_shell) {
      execShellCommand(command, dir, selectingItemName());
      return
    }
  }
  const handlekeyboardnavigation = (event: Event) => {
    const keyboard_event = event as KeyboardEvent;
    if (keyboard_event.type !== 'keydown') { return false; }

    (async () => {
      const command_ary = await matchingKeyEvent(keyboard_event);
      if (command_ary.length !== 0) {
        execCommand(command_ary[0])
        return;
      }

      if (keyboard_event.key.length === 1) {
        incremantalSearch(keyboard_event.key)
        return;
      }
    })();

    return true;
  };

  type AdjustedAddressbarStr = {
    dir: string,
  };

  const accessParentDir = async () => {
    const adjusted = await invoke<AdjustedAddressbarStr>("adjust_addressbar_str", { str: addressbatStr + '/..' });
    setDir(adjusted.dir);
  };

  const onEnterDown = async () => {
    const adjusted = await invoke<AdjustedAddressbarStr>("adjust_addressbar_str", { str: addressbatStr });

    setDir(adjusted.dir);
    myGrid.current?.focus();
  }
  const onEscapeDown = () => {
    myGrid.current?.focus();
  }
  const onKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { onEnterDown(); return; }
    if (event.key === 'Escape') { onEscapeDown(); return; }
  };

  const onDoubleClick = () => {
    accessParentDir();
  }

  const myGrid = React.createRef<JqxGrid>();

  const [dialog, execShellCommand] = commandExecuter();

  return (
    <>
      <div className={styles.MainPain}>
        <input
          type="text"
          value={addressbatStr}
          onChange={e => setAddressbatStr(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div
          className={styles.FileList}
          onDoubleClick={onDoubleClick}
        >
          <JqxGrid
            width={'100%'}
            source={convert(entries)}
            columns={columns}
            pageable={false}
            editable={false}
            autoheight={true}
            sortable={true} theme={'material-purple'}
            altrows={true} enabletooltips={true}
            selectionmode={'multiplerowsextended'}
            onRowclick={onRowclick}
            onRowdoubleclick={onRowdoubleclick}
            handlekeyboardnavigation={handlekeyboardnavigation}
            ref={myGrid}
          />
        </div>
      </div>
      {dialog}
    </>
  );
}

///////////////////////////////////////////////////////////////////////////////////////////////////
type ExecShellCommand = (
  command: CommandInfo,
  current_dir: string,
  selecting_item_name_ary: string[],
) => void;

function commandExecuter(): [JSX.Element, ExecShellCommand,] {
  const dlg: React.MutableRefObject<HTMLDialogElement | null> = useRef(null);
  const [title, setTitle] = useState<string>('');
  const [dlgString, setDlgString] = useState<string>('');
  const [refString, setRefString] = useState<string>('');
  const dlgOnOk = useRef<(dlgInput: string) => void>(() => { });

  const execShellCommandImpl = (
    command_line: string,
    current_dir: string,
    selecting_item_name_ary: string[],
    dialog_input_string: string,
  ) => {
    const path_ary = selecting_item_name_ary
      .map(path => decoratePath(current_dir + '\\' + path))
      .join(',');
    const name_ary = selecting_item_name_ary
      .map(decoratePath)
      .join(',');
    const dialog_input_string_ary = dialog_input_string
      .split(/\n/)
      .map(decoratePath)
      .join(',');
    const current_dir_def = `$current_dir = "${current_dir}";`;
    const path_ary_def = `$selecting_item_path_ary = @(${path_ary});`;
    const name_ary_def = `$selecting_item_name_ary = @(${name_ary});`;
    const dialog_input_def = `$dialog_input_str_ary = @(${dialog_input_string_ary});`;

    const command_strs = [path_ary_def, name_ary_def, current_dir_def, dialog_input_def, command_line,];
    const replaced_command_line = command_strs.join('\n');
    console.log(replaced_command_line)
    executeShellCommand(replaced_command_line, current_dir);
  }
  const execShellCommand = (
    command: CommandInfo,
    current_dir: string,
    selecting_item_name_ary: string[],
  ) => {
    const fn = (dialog_input_string: string) => {
      execShellCommandImpl(
        command.action.command,
        current_dir,
        selecting_item_name_ary,
        dialog_input_string,
      );
    }

    const type = command.dialog_type;
    if (!type || type === DIALOG_TYPE.none) {
      fn('');
      return;
    }
    if (type === DIALOG_TYPE.reference_selection || type === DIALOG_TYPE.multi_line) {
      setTitle(command.command_name);
      const str = (type === DIALOG_TYPE.reference_selection)
        ? selecting_item_name_ary.join('\n')
        : '';
      setDlgString(str);
      setRefString(str);
      dlg.current?.showModal();
      dlgOnOk.current = fn;
      return;
    }
  }

  const countTextRows = (str: string) => {
    return str.split('\n').length;
  }

  const textAreaWhithRef = () => {
    return <div
      className={styles.DlgTextAreas}
    >
      <textarea
        value={refString}
        disabled={true}
        rows={countTextRows(refString)}
      />
      <textarea
        value={dlgString}
        onChange={e => setDlgString(e.target.value)}
        rows={countTextRows(refString)}
      />
    </div>
  }
  const textArea = () => {
    return <div
      className={styles.DlgSingleTextArea}
    >
      <textarea
        className={styles.DlgTextArea}
        value={dlgString}
        onChange={e => setDlgString(e.target.value)}
      />
    </div>
  }
  const button = () => {
    return <div className={styles.DlgButton}>
      <button
        onClick={() => { dlgOnOk.current(dlgString); dlg.current?.close() }}
      >
        Ok
      </button>
      <button
        onClick={() => { setDlgString(''); dlg.current?.close() }}
      >
        Cancle
      </button>
    </div>
  }

  const element = <dialog
    className={styles.Dlg}
    ref={dlg}
  >
    <div className={styles.DlgLayout}>
      <text className={styles.DlgTitle}>{title}</text>
      {(refString.length === 0) ? textArea() : textAreaWhithRef()}
      {button()}
    </div>
  </dialog>

  return [element, execShellCommand];
}
