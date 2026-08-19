import { app, BrowserWindow } from 'electron';
import { answerAboutPreferences } from '@FluxDesktop/main/answerAboutPreferences';
import { openTheWindow } from '@FluxDesktop/main/openTheWindow';
import { showTheApplication } from '@FluxDesktop/main/showTheApplication';

const start = async (): Promise<void> => {
  await app.whenReady();

  answerAboutPreferences();

  await showTheApplication(openTheWindow());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void showTheApplication(openTheWindow());
    }
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

void start();
