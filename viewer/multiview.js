let preferences = {
    theme: 'dark-glass',
    layout: 'grid',
    defaultWidth: '50%',
    defaultHeight: '100%',
    blur: '10px',
    opacity: 0.8
};

let displayedTabs = [];
let container = document.getElementById('container');
let settingsPanel = document.getElementById('settings-panel');

// DOM elements for settings
const themeSelect = document.getElementById('theme-select');
const blurRange = document.getElementById('blur-range');
const blurValue = document.getElementById('blur-value');
const opacityRange = document.getElementById('opacity-range');
const opacityValue = document.getElementById('opacity-value');
const layoutButtons = document.querySelectorAll('.layout-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Let the background script know we're ready
    browser.runtime.sendMessage({ action: "multiViewReady" });

    // Event listeners
    document.getElementById('add-tab-btn').addEventListener('click', openTabSelector);
    document.getElementById('layout-btn').addEventListener('click', cycleLayout);
    document.getElementById('settings-btn').addEventListener('click', toggleSettings);
    document.getElementById('close-settings-btn').addEventListener('click', toggleSettings);
    document.getElementById('apply-settings-btn').addEventListener('click', applySettings);

    // Settings event listeners
    blurRange.addEventListener('input', () => {
        blurValue.textContent = `${blurRange.value}px`;
    });

    opacityRange.addEventListener('input', () => {
        opacityValue.textContent = opacityRange.value;
    });

    layoutButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            layoutButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Apply initial theme
    loadPreferences();
});

// Listen for messages
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateTabs") {
        displayedTabs = message.tabs;
        preferences = message.preferences || preferences;

        applyPreferences();
        renderTabs();

        sendResponse({ success: true });
        return true;
    }
});

function loadPreferences() {
    browser.runtime.sendMessage({ action: "getPreferences" })
        .then(response => {
            if (response.preferences) {
                preferences = response.preferences;
                applyPreferences();

                // Update settings UI
                updateSettingsUI();
            }
        });
}

function updateSettingsUI() {
    themeSelect.value = preferences.theme;

    // Update blur settings
    const blurValue = parseInt(preferences.blur);
    blurRange.value = blurValue;
    document.getElementById('blur-value').textContent = `${blurValue}px`;

    // Update opacity settings
    opacityRange.value = preferences.opacity;
    document.getElementById('opacity-value').textContent = preferences.opacity.toString();

    // Update layout buttons
    layoutButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.layout === preferences.layout) {
            btn.classList.add('active');
        }
    });
}

function applyPreferences() {
    // Apply theme to body
    document.body.className = preferences.theme;

    // Apply layout to container
    container.className = `tabs-container ${preferences.layout}`;

    // Apply CSS variables
    document.documentElement.style.setProperty('--blur-amount', preferences.blur);
    document.documentElement.style.setProperty('--panel-opacity', preferences.opacity);
}

function createFrameContent(tab) {
    // Create iframe with sandbox attributes
    const iframe = document.createElement('iframe');
    iframe.src = tab.url;
    iframe.className = 'panel-content';
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');

    // Add error handling for iframe loading issues
    iframe.addEventListener('load', () => {
        // Successfully loaded
    });

    iframe.addEventListener('error', () => {
        handleFrameError(iframe, tab);
    });

    // Create a wrapper to hold the iframe and potential error message
    const wrapper = document.createElement('div');
    wrapper.className = 'iframe-wrapper';
    wrapper.appendChild(iframe);

    return wrapper;
}

function handleFrameError(iframe, tab) {
    // Check if the iframe content is accessible
    try {
        // If we can't access the contentDocument, it likely has X-Frame-Options restrictions
        if (!iframe.contentDocument) {
            showFrameErrorMessage(iframe.parentNode, tab);
        }
    } catch (e) {
        // Security error occurs when X-Frame-Options or CSP blocks access
        showFrameErrorMessage(iframe.parentNode, tab);
    }
}

function showFrameErrorMessage(wrapper, tab) {
    // Clear wrapper content
    wrapper.innerHTML = '';

    // Create error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'frame-error-message';
    errorMessage.innerHTML = `
      <h3>Can't display this page</h3>
      <p>${tab.url} cannot be displayed in MultiView due to security restrictions.</p>
      <div class="error-actions">
        <button class="open-tab-btn">Open in New Tab</button>
      </div>
    `;

    // Add event listener to open in new tab button
    errorMessage.querySelector('.open-tab-btn').addEventListener('click', () => {
        browser.tabs.create({ url: tab.url });
    });

    wrapper.appendChild(errorMessage);
}

function renderTabs() {
    // Clear container except for the settings panel
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (displayedTabs.length === 0) {
        const welcome = document.createElement('div');
        welcome.className = 'welcome-message';
        welcome.innerHTML = `
        <h1>Welcome to MultiView</h1>
        <p>Add tabs to get started</p>
        <button id="welcome-add-btn" class="primary-btn">Add Tabs</button>
      `;
        container.appendChild(welcome);

        document.getElementById('welcome-add-btn').addEventListener('click', openTabSelector);
        return;
    }

    // Create panel for each tab
    displayedTabs.forEach(tab => {
        const panel = document.createElement('div');
        panel.className = 'tab-panel';
        panel.dataset.tabId = tab.id;

        // Header with controls
        const header = document.createElement('div');
        header.className = 'panel-header';
        header.innerHTML = `
        <div class="tab-info">
          <img src="${tab.favIconUrl || '../icons/default-favicon.png'}" class="tab-favicon" alt="favicon">
          <span class="tab-title">${tab.title}</span>
        </div>
        <div class="panel-controls">
          <button class="resize-btn" title="Resize Panel">⇲</button>
          <button class="remove-btn" title="Remove Panel">×</button>
        </div>
      `;
        panel.appendChild(header);

        // Content iframe
        const iframe = document.createElement('iframe');
        iframe.src = tab.url;
        iframe.className = 'panel-content';
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
        const frameContent = createFrameContent(tab);
        panel.appendChild(frameContent);

        // Event listeners
        header.querySelector('.remove-btn').addEventListener('click', () => {
            removePanel(panel);
        });

        header.querySelector('.resize-btn').addEventListener('click', () => {
            // Toggle resize mode
            panel.classList.toggle('resizing');
        });

        // Make panels resizable
        makeResizable(panel);

        container.appendChild(panel);
    });

    // Add draggable functionality
    makePanelsDraggable();
}

function makeResizable(panel) {
    let startX, startY, startWidth, startHeight;
    const resizeBtn = panel.querySelector('.resize-btn');

    const startResize = (e) => {
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(panel).height, 10);

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    };

    const resize = (e) => {
        const width = startWidth + e.clientX - startX;
        const height = startHeight + e.clientY - startY;

        panel.style.width = `${width}px`;
        panel.style.height = `${height}px`;
    };

    const stopResize = () => {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
        panel.classList.remove('resizing');
    };

    resizeBtn.addEventListener('mousedown', startResize);
}

function makePanelsDraggable() {
    const panels = document.querySelectorAll('.tab-panel');

    panels.forEach(panel => {
        const header = panel.querySelector('.panel-header');
        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', (e) => {
            // Only start drag if we click on the header (not on buttons)
            if (e.target === header || e.target.classList.contains('tab-title') || e.target.classList.contains('tab-info')) {
                isDragging = true;
                panel.classList.add('dragging');

                offsetX = e.clientX - panel.getBoundingClientRect().left;
                offsetY = e.clientY - panel.getBoundingClientRect().top;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;

            panel.style.left = `${x}px`;
            panel.style.top = `${y}px`;
            panel.style.position = 'absolute';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            panel.classList.remove('dragging');
        });
    });
}

function removePanel(panel) {
    const tabId = parseInt(panel.dataset.tabId);

    // Remove from displayed tabs array
    displayedTabs = displayedTabs.filter(tab => tab.id !== tabId);

    // Remove panel element
    panel.remove();

    // If no panels left, show welcome message
    if (displayedTabs.length === 0) {
        renderTabs();
    }
}

function openTabSelector() {
    // This would open a popup to select tabs
    // For simplicity, we'll just query all tabs
    browser.tabs.query({})
        .then(tabs => {
            // Show a simple prompt with tab titles
            const selectedIndex = prompt(
                `Select a tab number to add:\n${tabs.map((tab, index) =>
                    `${index + 1}. ${tab.title}`).join('\n')}`,
                "1"
            );

            if (selectedIndex && !isNaN(selectedIndex)) {
                const index = parseInt(selectedIndex) - 1;
                if (tabs[index]) {
                    // Add tab to display
                    displayedTabs.push(tabs[index]);
                    renderTabs();
                }
            }
        });
}

function cycleLayout() {
    // Cycle through available layouts
    const layouts = ['grid', 'horizontal', 'vertical'];
    const currentIndex = layouts.indexOf(preferences.layout);
    const nextIndex = (currentIndex + 1) % layouts.length;

    preferences.layout = layouts[nextIndex];
    applyPreferences();
}

function toggleSettings() {
    settingsPanel.classList.toggle('hidden');

    // Update settings UI when opening
    if (!settingsPanel.classList.contains('hidden')) {
        updateSettingsUI();
    }
}

function applySettings() {
    // Update preferences from settings UI
    preferences.theme = themeSelect.value;
    preferences.blur = `${blurRange.value}px`;
    preferences.opacity = parseFloat(opacityRange.value);

    // Find selected layout
    layoutButtons.forEach(btn => {
        if (btn.classList.contains('active')) {
            preferences.layout = btn.dataset.layout;
        }
    });

    // Apply changes
    applyPreferences();

    // Save preferences
    browser.runtime.sendMessage({
        action: "savePreferences",
        preferences: preferences
    });

    // Close settings panel
    toggleSettings();
}
