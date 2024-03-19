import { abbreviateNumber } from 'js-abbreviation-number';
import { Message, User, initalConfig } from '@const';
import { generateRandomNumber, minutesToMilliseconds, sleep } from '@utils';
import storage from '@/storage';
import remote from '@/remote';

const resetCounter = () => {
  storage.set('balloonCount', { balloonCount: 0 });
  setBadgeNumber(0);
};

const setBadgeNumber = (count: number) => {
  chrome.action.setBadgeText({
    text: abbreviateNumber(count),
  });
};

const updateBadgeColors = () => {
  chrome.action.setBadgeBackgroundColor({ color: '#7aa5eb' });
  chrome.action.setBadgeTextColor({ color: '#26282b' });
};

(() => {
  // Check if the script is running in the background
  // If the window object exists, we're not in the background script
  if (typeof window !== 'undefined') return;

  const setup = async () => {
    const balloonCount = (await storage.get('balloonCount'))?.balloonCount;
    // Reset the counter if it's undefined
    if (balloonCount === undefined) {
      resetCounter();
    }

    // Get the config from the remote
    const remoteConfig = await remote.getConfiguration();

    // Get the config from the local storage
    let config = await storage.get('config');

    // If the config is not in the local storage, use the default config
    if (!config) {
      config = initalConfig as any;
    }
    // Merge the remote config with the local config
    await storage.set('config', { ...config, ...remoteConfig });

    // Get the user from the local storage
    let localUser = await storage.get('user');
    // If the user is not in the local storage, get a new user from the remote
    if (!localUser) {
      const usr = await remote.getNewUser();
      await storage.set('token', usr.token);
      localUser = usr;
    }
    // Get the user from the remote and save it to the local storage
    const user = await remote.getUser(localUser.id);
    await storage.set('user', user);

    // Set badge number and colors
    setBadgeNumber(balloonCount || 0);
    updateBadgeColors();
  };

  let loopRunning = false;
  const loop = async () => {
    // If the loop is already running, don't start another one
    if (loopRunning) return;
    loopRunning = true;

    while (true) {
      // Wait between 0 and 10 minutes
      await sleep(generateRandomNumber(0, minutesToMilliseconds(10)));

      // Get all active tabs
      chrome.tabs.query({ active: true }, (tabs) => {
        // Select a random tab
        const num = Math.round(generateRandomNumber(0, tabs.length - 1));
        const tab = tabs[num];
        if (!tab.id) return;
        console.log(`Sending spawnBalloon to`, tab);

        // Send the spawnBalloon message
        chrome.tabs.sendMessage(
          tab.id,
          { action: 'spawnBalloon' },
          (response) => {
            // If there was an error, discard it
            // Error is most likely 'Receiving end does not exist.' exception
            if (chrome.runtime.lastError) {
              chrome.runtime.lastError = undefined;
            }
          }
        );
      });
    }
  };

  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse) => {
      switch (message.action) {
        case 'resetCounter':
          resetCounter();
          break;
        case 'updateCounter':
          setBadgeNumber(message.balloonCount);
          updateBadgeColors();
          break;
      }
    }
  );

  chrome.runtime.onStartup.addListener(async () => {
    await setup();
    await loop();
  });

  chrome.runtime.onInstalled.addListener(async () => {
    await setup();
    await loop();
  });
})();
