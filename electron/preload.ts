import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('trackerAPI', {
    startTracking: (projectId: string, userId: string) => ipcRenderer.invoke('start-tracking', { projectId, userId }),
    stopTracking: () => ipcRenderer.invoke('stop-tracking'),
    pauseTracking: () => ipcRenderer.invoke('pause-tracking'),
    resumeTracking: () => ipcRenderer.invoke('resume-tracking'),
    onTrackingSample: (callback: (data: any) => void) => {
        // We can add a generic listener here for tracking events
        ipcRenderer.on('tracking-sample', (_event, data) => callback(data));
    },
    showNotification: (title: string, body: string) => ipcRenderer.invoke('show-notification', { title, body }),
});

