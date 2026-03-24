import { ipcMain } from 'electron';
import { knowledgeReader } from '../services/knowledge-reader';
import { IpcChannels } from '../types';

export function registerKnowledgeHandlers(): void {
  ipcMain.handle(IpcChannels.KNOWLEDGE_LIST_TREE, () => {
    return knowledgeReader.listTree();
  });

  ipcMain.handle(IpcChannels.KNOWLEDGE_READ_FILE, (_e, relativePath: string) => {
    return knowledgeReader.readFile(relativePath);
  });

  ipcMain.handle(IpcChannels.KNOWLEDGE_SEARCH, (_e, query: string) => {
    return knowledgeReader.search(query);
  });
}
