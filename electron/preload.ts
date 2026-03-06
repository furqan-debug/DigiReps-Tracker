import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('trackerAPI', {
    startTracking: (projectId: string) => ipcRenderer.invoke('start-tracking', projectId),
    stopTracking: () => ipcRenderer.invoke('stop-tracking'),
    onTrackingSample: (callback: (data: any) => void) => {
        // We can add a generic listener here for tracking events
        ipcRenderer.on('tracking-sample', (_event, data) => callback(data));
    },
});
