import { useEffect, useRef, useState } from 'react';

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

import Select from 'react-select'
import { Exist, IsValidIndex } from './Utility';
import { Button } from '@mui/material';
import { BuildinCommandType, BUILDIN_COMMAND_TYPE, ToBuildinCommandType, readShellCommandSetting } from './CommandInfo';
import { toKeyStr, KeyBindSetting, readKeyBindSetting, writeKeyBindSetting, match, COMMAND_TYPE, CommandType } from './KeyBindInfo';
import { ShellCommandsSettingPane } from './ShellCommandsSettingPane';


///////////////////////////////////////////////////////////////////////////////////////////////////
const buttonHeight = 70;
const dlgHeightMagin = 60;

///////////////////////////////////////////////////////////////////////////////////////////////////
export function KeyBindSettingPane(
  props: {
    height: number
    keySetTrg: React.KeyboardEvent<HTMLDivElement> | null
    finishSetting: () => void
  }
) {
  const [trgKey, setTrgKey] = useState<React.KeyboardEvent<HTMLDivElement> | null>(props.keySetTrg);
  const [trgKeyStr, setTrgKeyStr] = useState('');
  useEffect(() => {
    setTrgKeyStr(toKeyStr(trgKey));
  }, [trgKey]);

  const [keyBindSettings, setKeyBindSettings] = useState<KeyBindSetting[]>([]);
  useEffect(() => { (async () => { setKeyBindSettings(await readKeyBindSetting()); })() }, []);
  function writSettings() {
    writeKeyBindSetting(keyBindSettings);
  }

  const RemoveSetting = (trgIdx: number) => {
    let newSettings = Array.from(keyBindSettings);
    newSettings.splice(trgIdx, 1);
    setKeyBindSettings(newSettings);
  }

  const [editingIndex, setEditingIndex] = useState(0);
  const [editDlg, Editor] = KeyBindEditor(
    (props.height - dlgHeightMagin),
    (editedKeyBindItem: KeyBindSetting) => {
      let newSettings = Array.from(keyBindSettings);
      if (IsValidIndex(newSettings, editingIndex)) {
        newSettings[editingIndex] = editedKeyBindItem;
      }
      else {
        newSettings.push(editedKeyBindItem);
      }
      setKeyBindSettings(newSettings);

    });
  const EditSetting = (trgIdx: number) => {
    setEditingIndex(trgIdx)
    const keyBindSetting = keyBindSettings[trgIdx];
    Editor(keyBindSetting)
  }

  const matchEx = (commandInfo: KeyBindSetting) => {
    if (!trgKey) { return true; }
    return match(trgKey, commandInfo.key);
  }

  const table_border = css({
    border: '1pt solid #000000',
  });

  function AddKeyBind(): void {
    setEditingIndex(keyBindSettings.length)

    const newSetting = {
      display_name: '',
      key: trgKeyStr,
      valid_on_addressbar: true,
      action: {
        type: COMMAND_TYPE.power_shell,
        command_name: '',
      }
    };
    Editor(newSetting)
  }

  return <>
    {editDlg}
    <div
      css={css({
        height: props.height,
        display: 'grid',
        placeItems: 'center',
      })}
    >
      <div>
        <div>
          <input
            defaultValue={trgKeyStr}
            onKeyDown={event => { setTrgKey(event); event.preventDefault(); }}
          />
          <button
            onClick={() => setTrgKey(null)}
          >Clear</button>
        </div>
        <button
          onClick={AddKeyBind}
        >+</button>
        <div
          css={css({
            height: (props.height - buttonHeight * 2), // 固定部分の高さの指定方法が良くない…。
            overflow: 'scroll',
            display: 'grid',
          })}
        >
          <table>
            <thead css={[]} >
              <tr>
                <th css={[table_border]}>Key</th>
                <th css={[table_border]}>Name</th>
                <th css={[table_border]}></th>
              </tr>
            </thead>
            {
              keyBindSettings
                .map((setting, orgIdx) => { return { setting, orgIdx }; })
                .filter(item => matchEx(item.setting))
                .map((item, filterdIdx) => {
                  return <tbody key={'keyBindSetting' + filterdIdx}>
                    <tr
                      css={[]}
                      key={'keyBindSetting' + filterdIdx}
                    >
                      <td css={[table_border]}>{item.setting.key}</td>
                      <td css={[table_border]}>{item.setting.display_name}</td>
                      <td css={[table_border]}>
                        <button
                          onClick={() => RemoveSetting(item.orgIdx)}
                        >x</button>
                      </td>
                      <td css={[table_border]}>
                        <button
                          onClick={() => EditSetting(item.orgIdx)}
                        >Edit</button>
                      </td>
                    </tr>
                  </tbody>
                })
            }
          </table >
        </div>
      </div>

      <div
        css={css({
          marginLeft: 'auto',
          marginRight: 'auto',
          height: buttonHeight,
        })}
      >
        <button
          onClick={() => {
            writSettings()
            props.finishSetting()
          }}
        >
          OK
        </button>
        <button
          onClick={() => props.finishSetting()}
        >
          Cancel
        </button>
      </div>

    </div>
  </>
}


///////////////////////////////////////////////////////////////////////////////////////////////////
export function KeyBindEditor(
  height: number,
  onOk: (editedKeyBindItem: KeyBindSetting) => void,
): [
    JSX.Element,
    (srcCommandInfo: KeyBindSetting) => void,
  ] {
  const [keyBindName, setKeyBindName] = useState('');

  const [keyStr, setKeyStr] = useState('');
  const [key, setKey] = useState<React.KeyboardEvent<HTMLDivElement> | null>(null);
  useEffect(() => { setKeyStr(toKeyStr(key)); }, [key]);

  const [validOnAddressbar, setValidOnAddressbar] = useState(false);

  const [commandType, setCommandType] = useState<CommandType>('power_shell');
  const [buildinCommandType, setBuildinCommandType] = useState<BuildinCommandType | null>('accessCurrentItem');
  const [shellCommandNameList, setShellCommandNameList] = useState<string[]>([]);
  const [shellCommandName, setShellCommandName] = useState<string>('');
  useEffect(() => { updateShellCommandList(); }, []);

  const updateShellCommandList = async () => {
    const shellCommandList = await readShellCommandSetting();
    setShellCommandNameList(shellCommandList.map(command => command.command_name));

    const shellCommandNames = shellCommandList
      .map(item => item.command_name);
    if (Exist(shellCommandNames, shellCommandName)) { return; }
    if (shellCommandList.length === 0) { return; }
    setShellCommandName(shellCommandList[0].command_name);
  };


  const toComboItem = (str: string) => {
    return { value: str, label: str };
  }

  const toBuildinCommandTypeComboItem = (type: BuildinCommandType) => {
    return { value: type, label: type };
  }

  const isOkEnable = () => (keyBindName !== "");


  const dlg: React.MutableRefObject<HTMLDialogElement | null> = useRef(null);
  const button = () => {
    return <div
      css={css({
        marginLeft: 'auto',
        marginRight: 'auto',
      })}
    >
      <Button
        css={css({ textTransform: 'none', })}
        disabled={!isOkEnable()}
        onClick={() => {
          const command_name = (commandType == COMMAND_TYPE.power_shell) ? shellCommandName : buildinCommandType;
          const key_bind_setting = {
            display_name: keyBindName,
            key: keyStr,
            valid_on_addressbar: validOnAddressbar,
            action: {
              type: commandType,
              command_name: command_name ?? "",
            },
          };
          onOk(key_bind_setting);
          dlg.current?.close()
        }}
      >
        Ok
      </Button>
      <Button
        css={css({ textTransform: 'none', })}
        onClick={() => { dlg.current?.close() }}
      >
        Cancle
      </Button>
    </div >
  }

  const [commandSettingDialog, startCommandSetting] = ShellCommandsSettingPane({
    height,
    onOK: () => updateShellCommandList(),
  });

  const dialogElement = <dialog
    css={css({
      height: height,
      width: '60%', // 適当…。
    })}
    ref={dlg}>
    {commandSettingDialog}
    <div
      css={css({
        height: (height - buttonHeight),
        overflow: 'scroll',
      })}
    >
      <div>
        <div>
          <div>Name</div>
          <input
            type="text"
            value={keyBindName}
            onChange={e => { setKeyBindName(e.target.value) }}
          />
        </div>
        <div>
          <div>Key</div>
          <input
            type="text"
            defaultValue={keyStr}
            onKeyDown={event => { setKey(event); event.preventDefault(); }}
          />
        </div>
        <label>
          <input
            type='checkbox'
            checked={validOnAddressbar}
            onChange={(e) => setValidOnAddressbar(!validOnAddressbar)}
          />
          Valid on addressbar
        </label>

        <div>
          <input
            type="radio" name='CommandType'
            checked={commandType == COMMAND_TYPE.power_shell}
            onChange={() => setCommandType(COMMAND_TYPE.power_shell)} />
          <label onClick={() => setCommandType(COMMAND_TYPE.power_shell)}>power_shell</label>
          <input
            type="radio" name='CommandType'
            checked={commandType == COMMAND_TYPE.build_in}
            onChange={() => setCommandType(COMMAND_TYPE.build_in)} />
          <label onClick={() => setCommandType(COMMAND_TYPE.build_in)}>build_in</label>
        </div>

        {
          (commandType == COMMAND_TYPE.power_shell) ?
            <>
              <Select
                options={shellCommandNameList.map(toComboItem)}
                value={toComboItem(shellCommandName)}
                onChange={(val) => {
                  if (val === null) { return; }
                  setShellCommandName(val.value)
                }}
              />
              <button
                onClick={startCommandSetting}
              >Edit Commands</button>
            </>
            :
            <Select
              options={Object.values(BUILDIN_COMMAND_TYPE).map(toBuildinCommandTypeComboItem)}
              value={toBuildinCommandTypeComboItem(buildinCommandType ?? BUILDIN_COMMAND_TYPE.accessCurrentItem)}
              onChange={(val) => {
                if (val === null) { return; }
                setBuildinCommandType(val.value)
              }}
            />
        }

      </div>
    </div>
    <div
      css={css({
        marginLeft: 'auto',
        marginRight: 'auto',
        height: buttonHeight,
      })}
    >
      {button()}
    </div>
  </dialog>

  const EditStart = (
    commandInfo: KeyBindSetting
  ) => {
    const is_buildin = (commandInfo.action.type == COMMAND_TYPE.build_in);
    setKeyBindName(commandInfo.display_name);
    setKeyStr(commandInfo.key);
    setCommandType(commandInfo.action.type);
    setValidOnAddressbar(commandInfo.valid_on_addressbar);
    setBuildinCommandType(is_buildin ? ToBuildinCommandType(commandInfo.action.command_name) : 'accessCurrentItem');
    setShellCommandName(!is_buildin ? commandInfo.action.command_name : "");
    dlg.current?.showModal();
  }

  return [dialogElement, EditStart];
}
