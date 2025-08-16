// This script runs in the context of the web page
// It can be used to apply styles or handle communication
console.log("MultiView content script loaded");

// Listen for messages from the parent MultiView
window.addEventListener('message', function (event) {
    // Handle messages if needed
    if (event.data.source === 'multiview') {
        // Process message
        console.log('Received message from MultiView:', event.data);
    }
});

// Let the extension know this page is ready
browser.runtime.sendMessage({ action: "contentScriptReady" });
