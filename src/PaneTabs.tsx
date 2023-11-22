import React, { useState } from 'react';

import { Button, MenuItem } from '@mui/material';


import { separator } from './FilePathSeparator';

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

import { TabColor, TabColorSetting } from './TabColorSetting';

import { MainPanel } from './MainPane';
import { TabInfo, TabsInfo } from './TabsInfo';
import { ControlledMenu } from '@szhsin/react-menu';
import { DirName } from './Utility';
import { LogInfo } from './LogMessagePane';


///////////////////////////////////////////////////////////////////////////////////////////////////
export interface TabFuncs {
  addNewTab: (newTabPath: string) => void,
  removeTab: () => void,
  removeOtherTabs: () => void,
  removeAllRightTabs: () => void,
  removeAllLeftTabs: () => void,
  changeTab: (offset: number) => void,
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export const PaneTabs = (
  props: {
    height: number,
    pathAry: TabsInfo,
    tabColorSetting: TabColorSetting[]
    onTabsChanged: (newTabs: TabInfo[], newTabIdx: number,) => void,
    onItemNumChanged: (newItemNum: number) => void,
    onSelectItemNumChanged: (newSelectItemNum: number) => void,
    getOppositePath: () => string,
    addLogMessage: (message: LogInfo) => void,
    setTabColor: (trgDir: string) => void,
    separator: separator,
    focusOppositePane: () => void,
    gridRef?: React.RefObject<HTMLDivElement>,
  },
) => {
  const tabAry = props.pathAry.pathAry;
  const activeTabIdx = props.pathAry.activeTabIndex;

  const addNewTab = (addPosIdx: number, newTabPath: string) => {
    let newTabAry = Array.from(props.pathAry.pathAry);
    newTabAry.splice(addPosIdx + 1, 0, { path: newTabPath, pined: false });
    props.onTabsChanged(newTabAry, addPosIdx + 1);
  }
  const removeTab = (trgIdx: number) => {
    if (tabAry.length === 1) { return; }
    if (trgIdx >= tabAry.length) { return; }
    if (tabAry[trgIdx].pined) { return; }

    let newTabAry = Array.from(tabAry);
    newTabAry.splice(trgIdx, 1);

    const newTabIdx = (activeTabIdx >= newTabAry.length) ? newTabAry.length - 1 : activeTabIdx;
    props.onTabsChanged(newTabAry, newTabIdx);
  }

  const removeTabs = (remainIdxAry: number[]) => {
    if (remainIdxAry.length === 0) { return; }

    let newTabAry = remainIdxAry.map(idx => tabAry[idx]);
    const newTabIdx = remainIdxAry
      .map((orgIdx, idx) => { return { idx, dist: Math.abs(orgIdx - activeTabIdx) } })
      .reduce((pre, cur) => (pre.dist < cur.dist) ? pre : cur)
      .idx;
    props.onTabsChanged(newTabAry, newTabIdx);
  }

  const removeOtherTabs = (remainIdx: number) => {
    let remaiIdxAry = tabAry
      .map((tab, idx) => { return { tab, orgIdx: idx } })
      .filter(item => item.tab.pined || item.orgIdx === remainIdx)
      .map(item => item.orgIdx);
    removeTabs(remaiIdxAry);
  }

  const removeAllRightTabs = (baseIdx: number) => {
    let remaiIdxAry = tabAry
      .map((tab, idx) => { return { tab, orgIdx: idx } })
      .filter(item => item.tab.pined || item.orgIdx <= baseIdx)
      .map(item => item.orgIdx);
    removeTabs(remaiIdxAry);
  }

  const removeAllLeftTabs = (baseIdx: number) => {
    let remaiIdxAry = tabAry
      .map((tab, idx) => { return { tab, orgIdx: idx } })
      .filter(item => item.tab.pined || item.orgIdx >= baseIdx)
      .map(item => item.orgIdx);
    removeTabs(remaiIdxAry);

  }

  const changeTab = (offset: number) => {
    const new_val = (activeTabIdx + offset + tabAry.length) % tabAry.length;
    props.onTabsChanged(tabAry, new_val);
  }
  const togglePined = (idx: number) => {
    let newTabAry = Array.from(tabAry);
    newTabAry[idx].pined = !newTabAry[idx].pined;
    props.onTabsChanged(newTabAry, activeTabIdx);
  }

  const onPathChanged = (newPath: string) => {
    tabAry[activeTabIdx].path = newPath
    props.onTabsChanged(Array.from(tabAry), activeTabIdx);
  }


  const pathToTabName = (tab: TabInfo) => {
    const pinedPrefix = tab.pined ? "*:" : "";
    const dirName = DirName(tab.path);
    return pinedPrefix + dirName;
  }

  const [isMenuOpen, setMenuOpen] = useState(false);
  const [contextMenuTabIdx, setContextMenuTabIdx] = useState(0);
  const [contextMenuPosX, setContextMenuPosX] = useState(0);
  const [contextMenuPosY, setContextMenuPosY] = useState(0);
  const contextMenu = () => {
    return <ControlledMenu
      state={isMenuOpen ? 'open' : 'closed'}
      onClose={() => { setMenuOpen(false); }}
      anchorPoint={{ x: contextMenuPosX, y: contextMenuPosY }} // 適当…。
    >
      <MenuItem
        onClick={_ => removeAllRightTabs(contextMenuTabIdx)}
      >
        Close Right Tabs
      </MenuItem>
      <MenuItem
        onClick={_ => removeAllLeftTabs(contextMenuTabIdx)}
      >
        Close Left Tabs
      </MenuItem>
      <MenuItem
        onClick={_ => removeOtherTabs(contextMenuTabIdx)}
      >
        Close Other Tabs
      </MenuItem>
      <MenuItem
        onClick={_ => removeTab(contextMenuTabIdx)}
      >
        Close Tab
      </MenuItem>
      <MenuItem
        onClick={_ => props.setTabColor(tabAry[contextMenuTabIdx].path)}
      >
        Set Tab Color
      </MenuItem>
      <MenuItem
        onClick={_ => togglePined(contextMenuTabIdx)}
      >
        Toggle Pin
      </MenuItem>
    </ControlledMenu>
  }

  return (
    <>
      {contextMenu()}
      <div
        css={css({
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          overflow: 'auto',
          width: '100%',
          height: props.height,
        })}
      >
        <div css={css({ textTransform: 'none' })}>
          {
            props.pathAry.pathAry.map((tab, idx) => {
              return <Button
                css={[
                  css({
                    textTransform: 'none',
                    fontSize: '10pt',
                    height: '20pt',
                    margin: '1pt',
                    minWidth: '5pt'
                  }),
                  TabColor(
                    props.tabColorSetting,
                    5,
                    idx === props.pathAry.activeTabIndex,
                    tab.path),
                ]}
                onClick={() => { props.onTabsChanged(tabAry, idx) }}
                onDoubleClick={() => togglePined(idx)}
                onAuxClick={e => { if (e.button === 1) { removeTab(idx) } }}
                onContextMenu={e => {
                  setContextMenuTabIdx(idx);
                  setContextMenuPosX(e.clientX);
                  setContextMenuPosY(e.clientY);
                  setMenuOpen(true);
                  e.preventDefault();
                }}
                defaultValue={pathToTabName(tab)}
                tabIndex={-1}
                key={'TabButton' + idx}
              >
                {pathToTabName(tab)}
              </Button>
            })
          }
          <Button
            css={[
              css({
                height: '20pt',
                minWidth: '5pt',
              }),
            ]}
            onClick={() => { addNewTab(tabAry.length - 1, tabAry[activeTabIdx].path) }}
            tabIndex={-1}
          >+</Button>
        </div >
        <MainPanel
          initPath={tabAry[activeTabIdx].path}
          pined={tabAry[activeTabIdx].pined}
          onPathChanged={onPathChanged}
          onItemNumChanged={props.onItemNumChanged}
          onSelectItemNumChanged={props.onSelectItemNumChanged}
          tabFuncs={
            {
              addNewTab: (path: string) => addNewTab(activeTabIdx, path),
              removeTab: () => removeTab(activeTabIdx),
              removeOtherTabs: () => removeOtherTabs(activeTabIdx),
              removeAllRightTabs: () => removeAllRightTabs(activeTabIdx),
              removeAllLeftTabs: () => removeAllLeftTabs(activeTabIdx),
              changeTab,
            }
          }
          getOppositePath={props.getOppositePath}
          addLogMessage={props.addLogMessage}
          separator={props.separator}
          focusOppositePane={props.focusOppositePane}
          gridRef={props.gridRef}
          key={activeTabIdx}
        />
      </div>
    </>
  )
}
