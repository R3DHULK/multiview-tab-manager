document.addEventListener('DOMContentLoaded', function () {
    // DOM elements
    const tabsContainer = document.getElementById('tabs-container');
    const createViewBtn = document.getElementById('create-view-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    const layoutButtons = document.querySelectorAll('.layout-btn');

    // Form elements
    const themeSelect = document.getElementById('theme-select');
    const blurRange = document.getElementById('blur-range');
    const blurValue = document.getElementById('blur-value');
    const opacityRange = document.getElementById('opacity-range');
    const opacityValue = document.getElementById('opacity-value');

    // State
    let allTabs = [];
    let selectedTabs = [];
    let currentLayout = 'grid';
    let preferences = {};

    // Initialize
    loadTabs();
    loadPreferences();

    // Event listeners for UI navigation
    settingsBtn.addEventListener('click', toggleSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);
    cancelSettingsBtn.addEventListener('click', toggleSettings);

    // Event listener for layout buttons
    layoutButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            layoutButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentLayout = e.target.dataset.layout;
        });
    });

    // Event listener for range inputs
    blurRange.addEventListener('input', () => {
        blurValue.textContent = `${blurRange.value}px`;
    });

    opacityRange.addEventListener('input', () => {
        opacityValue.textContent = opacityRange.value;
    });

    // Create MultiView button
    createViewBtn.addEventListener('click', () => {
        if (selectedTabs.length === 0) {
            // If no tabs selected, alert the user
            alert('Please select at least one tab to create a MultiView');
            return;
        }

        // Update preferences with current layout
        preferences.layout = currentLayout;

        // Send selected tabs to background script
        browser.runtime.sendMessage({
            action: "createMultiView",
            tabs: selectedTabs
        });
    });

    // Functions
    function loadTabs() {
        browser.runtime.sendMessage({ action: "getTabs" })
            .then(response => {
                allTabs = response.tabs;
                renderTabs();
            });
    }

    function loadPreferences() {
        browser.runtime.sendMessage({ action: "getPreferences" })
            .then(response => {
                preferences = response.preferences;

                // Update UI with loaded preferences
                themeSelect.value = preferences.theme;
                blurRange.value = parseInt(preferences.blur);
                blurValue.textContent = preferences.blur;
                opacityRange.value = preferences.opacity;
                opacityValue.textContent = preferences.opacity.toString();

                // Update layout buttons
                layoutButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.layout === preferences.layout) {
                        btn.classList.add('active');
                    }
                });
                currentLayout = preferences.layout;
            });
    }

    function renderTabs() {
        tabsContainer.innerHTML = '';

        allTabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = 'tab-item';

            if (selectedTabs.some(t => t.id === tab.id)) {
                tabElement.classList.add('selected');
            }

            tabElement.innerHTML = `
          <img src="${tab.favIconUrl || '../icons/default-favicon.png'}" class="tab-favicon" alt="favicon">
          <div class="tab-title">${tab.title}</div>
        `;

            tabElement.addEventListener('click', () => {
                toggleTabSelection(tab);
                tabElement.classList.toggle('selected');
            });

            tabsContainer.appendChild(tabElement);
        });
    }

    function toggleTabSelection(tab) {
        const index = selectedTabs.findIndex(t => t.id === tab.id);

        if (index === -1) {
            selectedTabs.push(tab);
        } else {
            selectedTabs.splice(index, 1);
        }
    }

    function toggleSettings() {
        mainView.classList.toggle('hidden');
        settingsView.classList.toggle('hidden');
    }

    function saveSettings() {
        preferences.theme = themeSelect.value;
        preferences.blur = `${blurRange.value}px`;
        preferences.opacity = parseFloat(opacityRange.value);

        browser.runtime.sendMessage({
            action: "savePreferences",
            preferences: preferences
        });

        toggleSettings();
    }
});
