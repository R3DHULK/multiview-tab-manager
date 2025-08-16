let openTabs = {};
let preferences = {
    theme: 'dark-glass',
    layout: 'grid',
    defaultWidth: '50%',
    defaultHeight: '100%',
    blur: '10px',
    opacity: 0.8
};

// Initialize extension
browser.runtime.onInstalled.addListener(() => {
    browser.storage.local.get('preferences')
        .then(result => {
            if (result.preferences) {
                preferences = result.preferences;
            } else {
                browser.storage.local.set({ preferences });
            }
        });

    // Create context menu
    browser.contextMenus.create({
        id: "add-to-multiview",
        title: "Add to MultiView",
        contexts: ["tab"]
    });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "add-to-multiview") {
        addTabToMultiView(tab);
    }
});

// Create or update multiview window
function createMultiViewWindow(tabs) {
    // Check if we already have a multiview window open
    let multiViewUrl = browser.runtime.getURL("viewer/multiview.html");

    browser.tabs.query({})
        .then(allTabs => {
            let multiViewTab = allTabs.find(tab => tab.url.startsWith(multiViewUrl));

            if (multiViewTab) {
                // Update existing window
                browser.tabs.update(multiViewTab.id, { active: true })
                    .then(() => {
                        browser.tabs.sendMessage(multiViewTab.id, {
                            action: "updateTabs",
                            tabs: tabs,
                            preferences: preferences
                        });
                    });
            } else {
                // Create new window
                browser.tabs.create({ url: multiViewUrl })
                    .then(newTab => {
                        // We'll send the tab data once the page has loaded
                        openTabs.multiViewTabId = newTab.id;
                        openTabs.tabsToDisplay = tabs;
                    });
            }
        });
}

// Listen for messages from popup or content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getTabs") {
        browser.tabs.query({})
            .then(tabs => {
                sendResponse({ tabs: tabs });
            });
        return true;
    }

    if (message.action === "getPreferences") {
        sendResponse({ preferences: preferences });
        return true;
    }

    if (message.action === "savePreferences") {
        preferences = message.preferences;
        browser.storage.local.set({ preferences });
        sendResponse({ success: true });
        return true;
    }

    if (message.action === "createMultiView") {
        createMultiViewWindow(message.tabs);
        sendResponse({ success: true });
        return true;
    }

    if (message.action === "multiViewReady" && openTabs.tabsToDisplay) {
        // Send the tabs data to the newly created multiview tab
        browser.tabs.sendMessage(sender.tab.id, {
            action: "updateTabs",
            tabs: openTabs.tabsToDisplay,
            preferences: preferences
        });

        // Clear the temporary storage
        openTabs.tabsToDisplay = null;
        return true;
    }
});

function addTabToMultiView(tab) {
    let tabsToAdd = [tab];
    createMultiViewWindow(tabsToAdd);
}
// Modify the existing webRequest listener in background.js to be more comprehensive
browser.webRequest.onHeadersReceived.addListener(
    function (details) {
        // Create a new array of modified headers
        let headers = details.responseHeaders.filter(header => {
            // Convert header names to lowercase for case-insensitive comparison
            const headerName = header.name.toLowerCase();

            // Remove X-Frame-Options headers
            if (headerName === 'x-frame-options') {
                return false;
            }

            // Remove Frame-Options headers
            if (headerName === 'frame-options') {
                return false;
            }

            // Modify Content-Security-Policy headers to allow framing
            if (headerName === 'content-security-policy') {
                // Remove frame-ancestors or frame-src restrictions
                let value = header.value;
                value = value.replace(/frame-ancestors[^;]*;?/gi, '');
                value = value.replace(/frame-src[^;]*;?/gi, '');

                // If the header value has been modified, update it
                if (value !== header.value) {
                    header.value = value;
                }
            }

            // Keep all other headers
            return true;
        });

        return { responseHeaders: headers };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "responseHeaders"]
);