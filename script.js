let foodData;
let currentMealType = getMealTypeByTime();
let currentSetName = "一般菜單"; // Default tracking
let isSpinning = false;
let history = [];

// DOM Elements
const ui = {
    tabs: document.querySelectorAll('.meal-tab'),
    spinBtn: document.getElementById('spin-btn'),
    resultText: document.getElementById('result-text'),
    resultEmoji: document.getElementById('result-emoji'),
    historyList: document.getElementById('history-list'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    resultDisplay: document.querySelector('.result-display'),

    // Modal
    settingsBtn: document.getElementById('settings-btn'),
    modal: document.getElementById('settings-modal'),
    closeModalBtn: document.getElementById('close-modal'),
    modalTabs: document.querySelectorAll('.modal-tab'),
    foodList: document.getElementById('food-list'),
    addInput: document.getElementById('new-food-input'),
    addBtn: document.getElementById('add-food-btn'),

    // Settings specific
    setSelector: document.getElementById('set-selector'),
    loadSetBtn: document.getElementById('load-set-btn'),
    currentSetBadge: document.getElementById('current-set-badge'),
    toast: document.getElementById('toast')
};

// Init
function init() {
    loadData(); // Load first
    setupEventListeners();
    updateActiveTab(currentMealType);
    initSetSelector();
    renderFoodList(currentMealType);
}

// Data Functions
function loadData() {
    const saved = localStorage.getItem('whatToEatData');
    const savedName = localStorage.getItem('whatToEatSetName');

    if (savedName) currentSetName = savedName;

    if (saved) {
        try {
            foodData = JSON.parse(saved);
        } catch (e) {
            console.error("Data parse error", e);
            resetToDefault();
        }
    } else {
        resetToDefault();
    }
}

function resetToDefault() {
    if (window.MENU_SETS) {
        // Pick the first key as default
        const defaultKey = Object.keys(window.MENU_SETS)[0];
        foodData = JSON.parse(JSON.stringify(window.MENU_SETS[defaultKey]));
        currentSetName = defaultKey;
    } else {
        foodData = {
            breakfast: ['蛋餅', '吐司'],
            lunch: ['便當', '麵'],
            dinner: ['火鍋', '牛排']
        };
        currentSetName = "未知";
    }
    saveData();
}

function saveData() {
    localStorage.setItem('whatToEatData', JSON.stringify(foodData));
    localStorage.setItem('whatToEatSetName', currentSetName);
}

function getMealTypeByTime() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 17) return 'lunch';
    return 'dinner';
}

function getRandomFood(type) {
    const list = foodData[type];
    if (!list || list.length === 0) return '沒東西吃QQ';

    // Get recently selected items of the same meal type
    const recentItems = history
        .filter(h => h.type === type)
        .map(h => h.item);

    // Filter out recent items to reduce repetition
    let availableItems = list.filter(item => !recentItems.includes(item));

    // If all items were recently selected, use the full list
    if (availableItems.length === 0) {
        availableItems = list;
    }

    const index = Math.floor(Math.random() * availableItems.length);
    return availableItems[index];
}

// Set Management
function initSetSelector() {
    if (!window.MENU_SETS || !ui.setSelector) return;

    ui.setSelector.innerHTML = Object.keys(window.MENU_SETS)
        .map(name => `<option value="${name}">${name}</option>`)
        .join('');

    ui.loadSetBtn.addEventListener('click', () => {
        const selectedName = ui.setSelector.value;
        const selectedSet = window.MENU_SETS[selectedName];

        if (!selectedSet) {
            showToast("找不到該菜單組合！");
            return;
        }

        // Direct apply
        foodData = JSON.parse(JSON.stringify(selectedSet));
        currentSetName = selectedName;
        saveData();

        // Update visible list
        renderFoodList(currentEditType);
        updateSetBadge();

        showToast("已成功套用！");
    });
}

function updateSetBadge() {
    if (ui.currentSetBadge) {
        ui.currentSetBadge.innerText = `目前: ${currentSetName}`;
    }
}

function showToast(msg) {
    ui.toast.innerText = msg;
    ui.toast.classList.remove('hidden');
    void ui.toast.offsetWidth; // force reflow
    ui.toast.classList.add('show');

    setTimeout(() => {
        ui.toast.classList.remove('show');
        setTimeout(() => {
            ui.toast.classList.add('hidden');
        }, 300);
    }, 2000);
}

// UI Functions
function setupEventListeners() {
    // Tabs
    ui.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentMealType = tab.dataset.type;
            updateActiveTab(currentMealType);
        });
    });

    // Spin
    ui.spinBtn.addEventListener('click', spin);

    // Clear History
    ui.clearHistoryBtn.addEventListener('click', clearHistory);

    // Modal
    ui.settingsBtn.addEventListener('click', () => openModal());
    ui.closeModalBtn.addEventListener('click', () => closeModal());

    // Modal Tabs
    ui.modalTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const type = e.target.dataset.target.replace('edit-', '');

            ui.modalTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');

            currentEditType = type;
            renderFoodList(type);
        });
    });

    // Add Food
    ui.addBtn.addEventListener('click', addFood);
    ui.addInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addFood();
    });
}

function updateActiveTab(type) {
    ui.tabs.forEach(tab => {
        if (tab.dataset.type === type) tab.classList.add('active');
        else tab.classList.remove('active');
    });
}

function spin() {
    if (isSpinning) return;

    const list = foodData[currentMealType];
    if (!list || list.length === 0) {
        ui.resultText.innerText = "請先新增食物！";
        return;
    }

    isSpinning = true;
    ui.resultDisplay.classList.add('spinning');

    let counter = 0;
    const maxSpins = 15;
    const interval = setInterval(() => {
        ui.resultText.innerText = list[counter % list.length];
        counter++;
        if (counter >= maxSpins) {
            clearInterval(interval);
            finishSpin();
        }
    }, 100);
}

function finishSpin() {
    const finalChoice = getRandomFood(currentMealType);

    ui.resultDisplay.classList.remove('spinning');
    ui.resultDisplay.classList.add('blur-in');

    ui.resultText.innerText = finalChoice;
    ui.resultEmoji.innerText = getEmojiForFood(finalChoice);

    addToHistory(finalChoice);

    setTimeout(() => {
        ui.resultDisplay.classList.remove('blur-in');
        isSpinning = false;
    }, 500);
}

function addToHistory(item) {
    // Check if item already exists
    if (history.some(h => h.item === item)) return;

    // Store with meal type for color coding - append to end to avoid jumping
    history.push({ item: item, type: currentMealType });

    // Create and append new chip element (only new item animates)
    const chip = document.createElement('span');
    chip.className = `chip chip-${currentMealType} blur-in`;
    chip.textContent = item;
    ui.historyList.appendChild(chip);

    // Remove oldest item if over limit
    if (history.length > 18) {
        history.shift();
        ui.historyList.firstChild.remove();
    }
}

function renderHistory() {
    ui.historyList.innerHTML = history.map(h =>
        `<span class="chip chip-${h.type}">${h.item}</span>`
    ).join('');
}

function clearHistory() {
    history = [];
    renderHistory();
}

function getEmojiForFood(food) {
    if (!food) return '🍽️';
    if (food.includes('麵')) return '🍜';
    if (food.includes('飯')) return '🍚';
    if (food.includes('蛋')) return '🍳';
    if (food.includes('鍋')) return '🍲';
    if (food.includes('堡') || food.includes('麥當勞')) return '🍔';
    if (food.includes('雞')) return '🍗';
    if (food.includes('酒')) return '🍺';
    if (food.includes('茶')) return '🍵';
    if (food.includes('甜')) return '🍰';
    return '😋';
}

// Modal Logic
let currentEditType = 'breakfast'; // Default for modal

function openModal() {
    ui.modal.classList.remove('hidden');
    void ui.modal.offsetWidth; // Force reflow
    ui.modal.classList.add('visible');

    currentEditType = currentMealType;

    ui.modalTabs.forEach(t => {
        t.dataset.target === `edit-${currentEditType}`
            ? t.classList.add('active')
            : t.classList.remove('active');
    });

    renderFoodList(currentEditType);
    initSetSelector();
    updateSetBadge(); // Update badge when opening
}

function closeModal() {
    ui.modal.classList.remove('visible');
    setTimeout(() => {
        ui.modal.classList.add('hidden');
    }, 300);
}

function renderFoodList(type) {
    currentEditType = type;
    const list = foodData[type];
    if (!list) return;

    ui.foodList.innerHTML = list.map((food, index) => `
        <li class="food-item">
            <span>${food}</span>
            <button onclick="removeFood(${index})"><i class="fa-solid fa-trash"></i></button>
        </li>
    `).join('');
}

function addFood() {
    const val = ui.addInput.value.trim();
    if (!val) return;

    foodData[currentEditType].push(val);
    saveData();
    renderFoodList(currentEditType);
    ui.addInput.value = '';
}

window.removeFood = function (index) {
    foodData[currentEditType].splice(index, 1);
    saveData();
    renderFoodList(currentEditType);
}

init();
