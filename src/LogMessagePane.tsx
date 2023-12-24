
import { useEffect, useState } from "react";

/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import React from "react";
import { UnlistenFn, listen } from "@tauri-apps/api/event";
import { Box } from "@mui/material";


///////////////////////////////////////////////////////////////////////////////////////////////////
export interface LogMessagePeinFunc {
  addMessage: (message: LogInfo) => void,
}

export interface LogPaneInfo {
  isOpen: boolean,
  isCommandOpen: boolean,
  logInfo: LogInfo,
}
export interface LogInfo {
  title: string,
  command: string,
  id: string,
  rc: number | null,
  stdout: string,
  stderr: string,
}

function LopPane(
  logPaneInfo: LogPaneInfo,
  onClick: () => void,
  onCommandClick: () => void,
) {
  const logInfo = logPaneInfo.logInfo;

  const deteal = () => {
    return <>
      <div onClick={onCommandClick} >
        command
      </div>
      {
        logPaneInfo.isCommandOpen
          ? <div>{logInfo.command}</div>
          : <></>
      }
      <div>rc:{(logInfo.rc !== null) ? logInfo.rc : ''}</div>
      <div css={css({})}>{logInfo.stdout}</div>
      <div css={css({})}>{logInfo.stderr}</div>
    </>
  }

  return <>
    <Box
      css={css({
        width: '100%',
        display: 'block',
        flexShrink: 0,
        border: '1pt solid #000000',
        overflow: 'scroll',
        wordBreak: 'break-all',
        fontSize: '15px',
      })}
    >
      <div
        onClick={onClick}
        css={css({})}
      >
        {logInfo.title}
      </div>
      {
        logPaneInfo.isOpen
          ? deteal()
          : <></>
      }
    </Box >
  </>;
}


export function LogMessagePein(props: {
  height: number
})
  : [JSX.Element, LogMessagePeinFunc,] {
  const [logAry, setLogAry] = useState<LogPaneInfo[]>([]);


  const addMessage = (message: LogInfo) => {
    setLogAry((prevLogAry) => [...prevLogAry.filter(log => log.logInfo.id !== message.id), { isOpen: true, isCommandOpen: false, logInfo: message }]);
  };

  useEffect(() => {
    let unlisten: UnlistenFn | null;
    (async () => {
      unlisten = await listen('LogMessageEvent', event => {
        addMessage(event.payload as LogInfo);
      });
    })()
    return () => {
      if (unlisten) { unlisten(); }
    }
  }, [])

  const logPaneRef = React.createRef<HTMLDivElement>();
  useEffect(() => {
    logPaneRef.current?.scrollTo(
      logPaneRef.current?.scrollWidth ?? 0,
      logPaneRef.current?.scrollHeight ?? 0)
  }, [logAry]);

  const toggleLogPaneOpne = (idx: number) => {
    const newLogAry = [...logAry]
    newLogAry[idx].isOpen = !logAry[idx].isOpen;
    setLogAry(newLogAry);
  }

  const toggleLogPaneCommandOpne = (idx: number) => {
    const newLogAry = [...logAry]
    newLogAry[idx].isCommandOpen = !logAry[idx].isCommandOpen;
    setLogAry(newLogAry);
  }

  const functions = {
    addMessage,
  }
  const element =
    <>
      <div
        css={css({
          height: props.height,
          width: '100%',
          overflow: 'scroll'
        })}
        ref={logPaneRef}
      >
        {
          logAry.map((logInfo, idx) => <div key={idx} >{
            LopPane(
              logInfo,
              () => toggleLogPaneOpne(idx),
              () => toggleLogPaneCommandOpne(idx),
            )
          }</div>)
        }
      </div>
    </>
  return [element, functions];
}
