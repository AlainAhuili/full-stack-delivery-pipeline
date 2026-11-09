document.addEventListener('DOMContentLoaded', () => {
    let isLoginMode = true;

    // ==========================================
    // DOM ELEMENTS CACHE
    // ==========================================
    const authSection = document.getElementById('auth-section');
    const crudSection = document.getElementById('crud-section');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const switchAuthMode = document.getElementById('switch-auth-mode');
    const authSwitchText = document.getElementById('auth-switch-text');
    
    const itemForm = document.getElementById('item-form');
    const itemNameInput = document.getElementById('item-name');
    const itemsList = document.getElementById('items-list');
    const logoutBtn = document.getElementById('logout-btn');
    const errorBox = document.getElementById('error-box');

    // ==========================================
    // UI NOTIFICATION LIFECYCLE MANAGEMENT
    // ==========================================
    function displaySystemMessage(message, isError = true) {
        if (!errorBox) return;
        errorBox.innerText = message;
        errorBox.classList.remove('hidden');
        
        // Dynamically style based on intent condition
        errorBox.style.background = isError ? '#F8D7DA' : '#D4EDDA';
        errorBox.style.color = isError ? '#721C24' : '#155724';
        errorBox.style.border = isError ? '1px solid #F5C6CB' : '1px solid #C3E6CB';

        // Auto-dismiss banner message after active operational window threshold
        setTimeout(() => {
            errorBox.classList.add('hidden');
        }, 4000);
    }

    // UI View State Orchestration Matrix Engine
    function renderView() {
        if (App.getToken()) {
            authSection.classList.add('hidden');
            crudSection.classList.remove('hidden');
            loadItems();
        } else {
            authSection.classList.remove('hidden');
            crudSection.classList.add('hidden');
            itemsList.innerHTML = '';
        }
    }

    // ==========================================
    // AUTHENTICATION TRANSITION ACTIONS
    // ==========================================
    switchAuthMode.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            authTitle.innerText = 'Login';
            authSubmitBtn.innerText = 'Login';
            authSwitchText.innerHTML = `Don't have an account? <span id="switch-auth-mode">Register here</span>`;
        } else {
            authTitle.innerText = 'Register';
            authSubmitBtn.innerText = 'Register';
            authSwitchText.innerHTML = `Already have an account? <span id="switch-auth-mode">Login here</span>`;
        }
        // Re-attach routing reference listener to newly appended block dynamically
        document.getElementById('switch-auth-mode').addEventListener('click', () => switchAuthMode.click());
    });

    // Auth Submission Control Gateway Handler
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            if (isLoginMode) {
                await App.login(username, password);
                displaySystemMessage('Authenticated successfully!', false);
            } else {
                await App.register(username, password);
                displaySystemMessage('Registration complete! Proceeding to gateway.', false);
                switchAuthMode.click(); // Flip back to login view natively
            }
            authForm.reset();
            renderView();
        } catch (err) {
            displaySystemMessage(err.message, true);
        }
    });

    // ==========================================
    // PROTECTED CRUD OPERATIONS LIFECYCLE
    // ==========================================
    
    // Read: Fetch and Render Items
    async function loadItems() {
        try {
            const items = await App.getItems();
            if (items === null) {
                renderView();
                return;
            }
            itemsList.innerHTML = '';
            items.forEach(item => {
                // Built with textContent, not innerHTML: item names are user input.
                const li = document.createElement('li');
                const label = document.createElement('span');
                label.textContent = item.name;
                const button = document.createElement('button');
                button.className = 'delete-item-btn';
                button.dataset.id = String(item.id);
                button.style.background = '#DC3545';
                button.style.padding = '4px 10px';
                button.textContent = 'X';
                li.append(label, button);
                itemsList.appendChild(li);
            });
        } catch (err) {
            displaySystemMessage(`Fetch Sync Defect: ${err.message}`, true);
        }
    }

    // Create: Add New Record Entry
    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = itemNameInput.value.trim();
        try {
            await App.createItem(name);
            itemNameInput.value = '';
            loadItems();
        } catch (err) {
            displaySystemMessage(err.message, true);
        }
    });

    // Delete: Event Delegation Listener (Eliminates leaky window global handlers)
    itemsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-item-btn')) {
            const targetId = e.target.getAttribute('data-id');
            try {
                await App.deleteItem(targetId);
                loadItems();
            } catch (err) {
                displaySystemMessage(err.message, true);
            }
        }
    });

    // ==========================================
    // TEARDOWN LIFECYCLE
    // ==========================================
    logoutBtn.addEventListener('click', () => {
        App.clearToken();
        renderView();
    });

    // Boot Initialization Sequence Execution Core
    renderView();
});
