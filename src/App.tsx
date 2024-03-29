import { useEffect, useRef, useState } from 'react';
import { MainModeView } from './MainModeView';

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

import { TabColorSetting, readTabColorSetting, writeTabColorSetting } from './TabColorSetting';

import { TabColorSettingPane } from './TabColorSettingPane';

import { ReadLastOpenedTabs, TabsInfo } from './TabsInfo';
import { KeyBindSettingPane } from './KeyBindSettingPane';


///////////////////////////////////////////////////////////////////////////////////////////////////
const Mode = {
  main: "main",
  setTabColor: "setTabColor",
  setKeyBindSettings: "setKeyBindSettings",
} as const;
type Mode = typeof Mode[keyof typeof Mode];

///////////////////////////////////////////////////////////////////////////////////////////////////
const App = () => {
  const [mode, setMode] = useState<Mode>(Mode.main);
  const [keySetTrg, setKeySetTrg] = useState<React.KeyboardEvent<HTMLDivElement> | null>(null);

  const [aplHeight, setAplHeight] = useState(document.documentElement.clientHeight);
  window.addEventListener('resize', (event) => {
    setAplHeight(document.documentElement.clientHeight);
  })

  const [tabColorSettingTrgDir, setTabColorSettingTrgDir] = useState<string>('');
  const [tabColorSetting, setTabColorSetting] = useState<TabColorSetting[]>([]);
  useEffect(() => {
    (async () => {
      const color_seting = await readTabColorSetting();
      setTabColorSetting(color_seting);
    })()
  }, []);

  const viewImpl = () => {
    switch (mode) {
      case Mode.main:
        return <MainModeView
          height={aplHeight}
          tabColorSetting={tabColorSetting}
          setTabColor={(trgDir) => { setTabColorSettingTrgDir(trgDir); setMode(Mode.setTabColor) }}
          setKeyBind={(trgKey: React.KeyboardEvent<HTMLDivElement> | null) => {setKeySetTrg(trgKey);setMode(Mode.setKeyBindSettings)}}
        />
      case Mode.setTabColor:
        return <TabColorSettingPane
          height={aplHeight}
          trgDir={tabColorSettingTrgDir}
          tabColorSetting={tabColorSetting}
          setTabColorSetting={(setting) => {
            setTabColorSetting(setting);
            writeTabColorSetting(setting);
          }}
          finishSetting={() => setMode(Mode.main)}
        />
      case Mode.setKeyBindSettings:
        return <KeyBindSettingPane
          height={aplHeight - 20}
          keySetTrg={keySetTrg}
          finishSetting={() => setMode(Mode.main)}
        />
    }
  };

  return <div
    css={css({
      width: '100%',
      height: 'aplHeight',
      overflow: 'hidden',
      userSelect: 'none',
    })}
  >
    {viewImpl()}
  </div >
}

export default App;
