import { invoke } from '@tauri-apps/api/core';

import { executeShellCommand } from './RustFuncs';
import { separator, ApplySeparator } from './FilePathSeparator';

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import React from 'react';

import { GenerateDefaultSeting } from './DefaultCommandSettins';
import { sleep } from './Utility';
import { ISettingInfo, readSettings, writeSettings } from './ReadWriteSettings';
import { LogInfo } from './LogMessagePane';
import { v4 as uuidv4 } from 'uuid'
import { ButtonStyle, TextInputStyle, useTheme } from './ThemeStyle';

///////////////////////////////////////////////////////////////////////////////////////////////////
export const BUILDIN_COMMAND_TYPE = {
  accessCurrentItem: 'accessCurrentItem',
  accessParentDir: 'accessParentDir',
  moveUp: 'moveUp',
  moveUpSelect: 'moveUpSelect',
  moveDown: 'moveDown',
  moveDownSelect: 'moveDownSelect',
  moveTop: 'moveTop',
  moveTopSelect: 'moveTopSelect',
  moveBottom: 'moveBottom',
  moveBottomSelect: 'moveBottomSelect',
  selectAll: 'selectAll',
  clearSelection: 'clearSelection',
  toggleSelection: 'toggleSelection',
  selectCurrentOnly: 'selectCurrentOnly',
  addNewTab: 'addNewTab',
  removeTab: 'removeTab',
  removeOtherTabs: 'removeOtherTabs',
  removeAllRightTabs: 'removeAllRightTabs',
  removeAllLeftTabs: 'removeAllLeftTabs',
  toPrevTab: 'toPrevTab',
  toNextTab: 'toNextTab',
  focusAddoressBar: 'focusAddoressBar',
  focusFilterBar: 'focusFilterBar',
  deleteFilterSingleSingle: 'deleteFilterSingleSingle',
  clearFilter: 'clearFilter',
  setFilterStrMatch: 'setFilterStrMatch',
  setFilterRegExp: 'setFilterRegExp',
  focusOppositePane: 'focusOppositePane',
  focusCommandBar: 'focusCommandBar',
  setKeyBind: 'setKeyBind',
  duplicateTabToOppositePane: 'duplicateTabToOppositePane',
} as const;
export type BuildinCommandType = typeof BUILDIN_COMMAND_TYPE[keyof typeof BUILDIN_COMMAND_TYPE];
export function ToBuildinCommandType(src: string): BuildinCommandType | null {
  return Object.values(BUILDIN_COMMAND_TYPE).find(val => val === src) ?? null;
}

export const DIALOG_TYPE = {
  none: "none",
  multi_line: "multi_line",
  reference_selection: "reference_selection",
} as const;
export type DialogType = typeof DIALOG_TYPE[keyof typeof DIALOG_TYPE];


export type ShellCommand = {
  command_name: string,
  dialog_type: DialogType,
  script_path: string,
};

export const scriptDirPath = "general/script/";

///////////////////////////////////////////////////////////////////////////////////////////////////
class Version {
  static oldest = 1;
  static latest = Version.oldest;
}

class SettingInfo implements ISettingInfo<ShellCommand[]> {
  filePath = "general/shell_commands.json5";
  latestVersion = Version.latest;
  IsValidVersion = (version: number) => {
    if (version < Version.oldest) { return false; }
    if (version > Version.latest) { return false; }
    return true;
  };
  UpgradeSetting = async (_readVersion: number, readSetting: ShellCommand[]) => readSetting;
}

export async function writeShellCommandSetting(setting: ShellCommand[]) {
  writeSettings(new SettingInfo, setting);
}


export async function readShellCommandSetting(): Promise<ShellCommand[]> {
  const read = await readSettings(new SettingInfo);
  return read ?? GenerateDefaultSeting();
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export const shellCommandTemplate = `# Available variables
# $selecting_item_path_ary = @("C:\\XXX\\AAA.txt","C:\\XXX\\BBB.txt");
# $selecting_item_name_ary = @("AAA.txt","BBB.txt");
# $current_dir = "C:\\XXX";
# $opposite_dir = "C\\YYY";
# $dialog_input_str_ary = @("Foo","Bar");
# $script_dir = "C:\\neko_filer_settings\\general\\script\\";
`;

///////////////////////////////////////////////////////////////////////////////////////////////////
function decoratePath(path: String): string {
  return "'" + path + "'";
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export interface CommandExecuterFunc {
  execShellCommand: (
    command_name: string,
    current_dir: string,
    selecting_item_name_ary: string[],
    opposite_path: string,
    separator: separator,
  ) => void;
}

type CommandExecuterProps = {
  addLogMessage: (message: LogInfo) => void,
  onDialogClose: () => void,
};

export const CommandExecuter = forwardRef<CommandExecuterFunc, CommandExecuterProps>((props, ref) => {
  useImperativeHandle(ref, () => functions);

  const dlg: React.MutableRefObject<HTMLDialogElement | null> = useRef(null);
  const [title, setTitle] = useState<string>('');
  const [dlgString, setDlgString] = useState<string>('');
  const [refString, setRefString] = useState<string>('');
  const dlgOnOk = useRef<(dlgInput: string) => void>(() => { });

  useEffect(() => {
    (async () => {
      await sleep(300);// この処理が無いと、何故か、ダイアログの文字列に、空行が入る…。
      textarea.current?.focus()
    })()
  }, [dlg.current?.open]);

  const theme = useTheme();
  const buttonStyle = ButtonStyle(theme.baseColor);
  const textInputStyle = TextInputStyle(theme.baseColor);

  const execShellCommandImpl = async (
    command_name: string,
    script_file_name: string,
    current_dir: string,
    selecting_item_name_ary: string[],
    dialog_input_string: string,
    opposite_dir: string,
    separator: separator,
  ) => {
    const command_line = await invoke<String>("read_setting_file", { fileName: scriptDirPath + script_file_name });
    const settingDir = await invoke<string>("setting_dir", {}).catch(_ => null);
    const script_dir_full_path = ApplySeparator(settingDir + '\\' + scriptDirPath, separator);

    const path_ary = selecting_item_name_ary
      .map(path => decoratePath(current_dir + path)) // current_dir は末端に区切り文字がある想定。
      .join(',');
    const name_ary = selecting_item_name_ary
      .map(decoratePath)
      .join(',');
    const dialog_input_string_ary = dialog_input_string
      .split(/\n/)
      .map(decoratePath)
      .join(',');
    const current_dir_def = `$current_dir = ${decoratePath(current_dir)};`;
    const opposite_dir_def = `$opposite_dir = ${decoratePath(opposite_dir)};`;
    const path_ary_def = `$selecting_item_path_ary = @(${path_ary});`;
    const name_ary_def = `$selecting_item_name_ary = @(${name_ary});`;
    const dialog_input_def = `$dialog_input_str_ary = @(${dialog_input_string_ary});`;
    const script_dir_def = `$script_dir = ${decoratePath(script_dir_full_path)};`;

    const command_strs = [path_ary_def, name_ary_def, current_dir_def, opposite_dir_def, dialog_input_def, script_dir_def, command_line,];
    const replaced_command_line = command_strs.join('\n');
    executeShellCommand(command_name, replaced_command_line, current_dir);
  }
  const execShellCommand = async (
    command_name: string,
    current_dir: string,
    selecting_item_name_ary: string[],
    opposite_dir: string,
    separator: separator,
  ) => {
    const commands = await readShellCommandSetting();
    const command = commands.find(command => command.command_name === command_name);
    if (command === undefined) {
      props.addLogMessage({
        title: "Command not found.",
        stdout: '',
        stderr: "'" + command_name + "'" + " is not valid command.",
        id: uuidv4(),
        command: '',
        rc: null
      });
      return;
    }

    const fn = (dialog_input_string: string) => {
      execShellCommandImpl(
        command_name,
        command.script_path,
        ApplySeparator(current_dir, separator),
        selecting_item_name_ary,
        dialog_input_string,
        ApplySeparator(opposite_dir, separator),
        separator
      );
    }

    const type = command.dialog_type;
    if (!type || type === DIALOG_TYPE.none) {
      fn('');
      return;
    }
    if (type === DIALOG_TYPE.reference_selection || type === DIALOG_TYPE.multi_line) {
      setTitle(command_name);
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

  const textarea = React.createRef<HTMLTextAreaElement>();

  const sizeHalf =
    css({
      height: '100%',
      width: '50%',
    });

  const textAreaWhithRef = () => {
    return <div
      css={css({
        display: 'flex',
        flexDirection: 'row',
      })}
    >
      <textarea
        style={textInputStyle}
        value={refString}
        disabled={true}
        rows={countTextRows(refString)}
        css={sizeHalf}
      />
      <textarea
        style={textInputStyle}
        value={dlgString}
        onChange={e => {
          setDlgString(e.target.value);
        }}
        rows={countTextRows(refString)}
        css={sizeHalf}
        ref={textarea}
      />
    </div>
  }
  const textArea = () => {
    return <div
      css={css({
        display: 'grid',
        gridTemplateRows: '1fr',
      })}
    >
      <textarea
        style={textInputStyle}
        css={css({
          display: 'grid',
          gridTemplateRows: '1fr',
        })}
        value={dlgString}
        onChange={e => {
          setDlgString(e.target.value);
        }}
        ref={textarea}
      />
    </div>
  }
  const button = () => {
    return <div
      css={css({
        marginLeft: 'auto',
        marginRight: 'auto',
      })}
    >
      <button
        css={buttonStyle}
        onClick={() => { dlgOnOk.current(dlgString); dlg.current?.close() }}
      >
        Ok
      </button>
      <button
        css={buttonStyle}
        onClick={() => { setDlgString(''); dlg.current?.close() }}
      >
        Cancle
      </button>
    </div>
  }

  const functions = {
    execShellCommand: execShellCommand,
  };

  return <dialog
    css={css({
      background: theme.baseColor.backgroundColor,
      color: theme.baseColor.stringDefaultColor,
      width: '80%',
      height: '80%',
    })}
    ref={dlg}
    onClose={() => { props.onDialogClose(); }}
  >
    <div
      css={css({
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        margin: '0 auto',
        width: '90%',
        height: '100%',
      })}
    >
      <div
        css={css({
          marginLeft: 'auto',
          marginRight: 'auto',
        })}
      >
        {title}
      </div>
      {(refString.length === 0) ? textArea() : textAreaWhithRef()}
      {button()}
    </div>
  </dialog>
});


