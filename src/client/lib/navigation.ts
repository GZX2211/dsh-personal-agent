// src/client/lib/navigation.ts
//
// 总控台标签页的纯类型；面板、概览与注意力跳转共用，避免视图互相 import。

export type ConsoleTabId = 'overview' | 'approvals' | 'tickets' | 'events' | 'sources' | 'settings'
