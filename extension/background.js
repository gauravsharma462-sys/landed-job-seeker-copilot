// Fill with Landed — Background Service Worker (Direct Trigger Bridge)
// Listens for direct events from the Landed Web App (NO "say go in Claude chat" step required!)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LANDED_DIRECT_LINKEDIN_IMPORT') {
    handleDirectLinkedInImport(message.payload, sendResponse);
    return true;
  }

  if (message.type === 'LANDED_DIRECT_DESKTOP_APPLY') {
    handleDirectDesktopApply(message.payload, sendResponse);
    return true;
  }
});

async function handleDirectLinkedInImport(payload, sendResponse) {
  try {
    // Opens LinkedIn Recommended jobs in background or active tab and reads DOM cards (read-only)
    const tab = await chrome.tabs.create({
      url: 'https://www.linkedin.com/jobs/collections/recommended/',
      active: false
    });

    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_LINKEDIN_RECOMMENDED' }, (result) => {
          sendResponse({ ok: true, jobs: result?.jobs || [] });
        });
      }
    });
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
  }
}

async function handleDirectDesktopApply(payload, sendResponse) {
  try {
    // Directly opens target company ATS application URL and executes field autofill
    const tab = await chrome.tabs.create({
      url: payload.jobUrl,
      active: true
    });

    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.sendMessage(tab.id, {
          type: 'EXECUTE_DESKTOP_APPLY_AUTOFILL',
          profile: payload.profile,
          job: payload.job
        }, (res) => {
          sendResponse({ ok: true, status: 'autofilled_waiting_for_review', detail: res });
        });
      }
    });
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
  }
}
