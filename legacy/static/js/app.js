// VibeCheck App - Complete Interactive System

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    setupSearch();
    setupFavorites();
    setupNavigation();
    setupGridInteractions();
    setupModals();
    setupBoards();
    setupCredits();
    setupNotifications();
    setupTabs();
    setupNewVideo();
    setupSmartBoard();
}

/* ============================================
   MODALS & DROPDOWNS
============================================ */
function setupModals() {
    // User Dropdown
    const userTrigger = document.getElementById('user-profile-trigger');
    const userDropdown = document.getElementById('user-dropdown');

    if (userTrigger && userDropdown) {
        userTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });
    }

    // Modal Triggers
    const triggers = [
        { btn: 'btn-new-board', modal: 'modal-new-board' },
        { btn: 'nav-settings', modal: 'modal-settings' },
        { btn: 'nav-profile', modal: 'modal-profile' },
        { btn: 'nav-buy-credits', modal: 'modal-credits' },
        { btn: 'btn-new-video', modal: 'modal-new-video' },
        { btn: 'btn-smart-board', modal: 'modal-smart-board' }
    ];

    triggers.forEach(t => {
        const btn = document.getElementById(t.btn);
        const modal = document.getElementById(t.modal);

        if (btn && modal) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openModal(modal);
                if (userDropdown) userDropdown.classList.remove('active');
            });
        }
    });

    // Close Modal Logic
    document.querySelectorAll('.btn-close, .btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalOverlay = btn.closest('.modal-overlay');
            if (modalOverlay) closeModal(modalOverlay);
        });
    });

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay);
            }
        });
    });

    // ESC key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                closeModal(modal);
            });
        }
    });

    // Logout handler
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Logged out successfully');
            // In real app: window.location.href = '/logout';
        });
    }

    // Save settings handler
    const saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            showToast('Settings saved!');
            closeModal(document.getElementById('modal-settings'));
        });
    }
}

function openModal(modal) {
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 200);
}

/* ============================================
   NOTIFICATIONS
============================================ */
function setupNotifications() {
    const trigger = document.getElementById('notification-trigger');
    const dropdown = document.getElementById('notifications-dropdown');

    if (trigger && dropdown) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== trigger) {
                dropdown.classList.remove('active');
            }
        });

        // Mark all read
        const markAllRead = dropdown.querySelector('a');
        if (markAllRead) {
            markAllRead.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('All notifications marked as read');
                dropdown.classList.remove('active');
                // Remove the red dot
                trigger.style.cssText = trigger.style.cssText.replace('::after', '');
            });
        }
    }
}

/* ============================================
   TABS
============================================ */
function setupTabs() {
    document.querySelectorAll('.tabs').forEach(tabContainer => {
        const tabs = tabContainer.querySelectorAll('.tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                const modal = tab.closest('.modal');

                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update tab content
                modal.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                const targetContent = modal.querySelector(`#${tabId}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    });
}

/* ============================================
   CREDITS SYSTEM
============================================ */
let currentCredits = 100;

function setupCredits() {
    // Load from localStorage
    const saved = localStorage.getItem('vibecheck_credits');
    if (saved) {
        currentCredits = parseInt(saved);
    }
    updateCreditsDisplay();

    // Pricing cards
    document.querySelectorAll('.pricing-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.pricing-card').forEach(c => c.style.borderColor = '');
            card.style.borderColor = 'var(--accent)';
        });
    });

    // Buy credits button
    const buyBtn = document.getElementById('buy-credits-btn');
    if (buyBtn) {
        buyBtn.addEventListener('click', () => {
            const selectedCard = document.querySelector('.pricing-card[style*="border-color"]');
            if (selectedCard) {
                const credits = parseInt(selectedCard.dataset.credits);
                addCredits(credits);
                closeModal(document.getElementById('modal-credits'));
                showToast(`Purchased ${credits} credits!`);
            } else {
                showToast('Please select a package');
            }
        });
    }
}

function updateCreditsDisplay() {
    document.querySelectorAll('#credits-count, #credits-topbar, #credits-modal').forEach(el => {
        if (el) el.textContent = currentCredits;
    });
}

function deductCredits(amount = 1) {
    currentCredits = Math.max(0, currentCredits - amount);
    localStorage.setItem('vibecheck_credits', currentCredits);
    updateCreditsDisplay();
    return currentCredits >= 0;
}

function addCredits(amount) {
    currentCredits += amount;
    localStorage.setItem('vibecheck_credits', currentCredits);
    updateCreditsDisplay();
}

/* ============================================
   BOARDS - Full CRUD with localStorage
============================================ */
const BOARDS_STORAGE_KEY = 'vibecheck_boards';
let currentActiveBoard = null;

function setupBoards() {
    // Load existing boards from localStorage
    loadBoardsFromStorage();

    // New board creation
    const createBtn = document.getElementById('submit-new-board');
    const input = document.getElementById('new-board-name');

    if (createBtn && input) {
        createBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (name) {
                createBoard(name);
                input.value = '';
                closeModal(document.getElementById('modal-new-board'));
            }
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                createBtn.click();
            }
        });
    }

    // Context menu for boards
    setupBoardContextMenu();

    // Toggle Switches
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            const setting = toggle.dataset.setting;
            const isActive = toggle.classList.contains('active');
            localStorage.setItem(`vibecheck_${setting}`, isActive);
        });

        const setting = toggle.dataset.setting;
        if (setting) {
            const saved = localStorage.getItem(`vibecheck_${setting}`);
            if (saved === 'true') {
                toggle.classList.add('active');
            } else if (saved === 'false') {
                toggle.classList.remove('active');
            }
        }
    });
}

function getBoards() {
    const stored = localStorage.getItem(BOARDS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveBoards(boards) {
    localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(boards));
}

function createBoard(name, parentId = null) {
    const boards = getBoards();
    const id = 'board-' + Date.now();
    const newBoard = {
        id,
        name,
        images: [],
        subfolders: [],
        createdAt: new Date().toISOString()
    };

    if (parentId) {
        // Add as subfolder
        const parent = findBoardById(boards, parentId);
        if (parent) {
            parent.subfolders.push(newBoard);
        }
    } else {
        boards.push(newBoard);
    }

    saveBoards(boards);
    renderBoardList();
    showToast(`Board "${name}" created`);
    return newBoard;
}

function findBoardById(boards, id) {
    for (const board of boards) {
        if (board.id === id) return board;
        if (board.subfolders) {
            const found = findBoardById(board.subfolders, id);
            if (found) return found;
        }
    }
    return null;
}

function deleteBoard(boardId) {
    let boards = getBoards();

    function removeFromList(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === boardId) {
                list.splice(i, 1);
                return true;
            }
            if (list[i].subfolders && removeFromList(list[i].subfolders)) {
                return true;
            }
        }
        return false;
    }

    removeFromList(boards);
    saveBoards(boards);
    renderBoardList();

    if (currentActiveBoard === boardId) {
        currentActiveBoard = null;
        showAllItems();
    }

    showToast('Board deleted');
}

function renameBoard(boardId, newName) {
    const boards = getBoards();
    const board = findBoardById(boards, boardId);
    if (board) {
        board.name = newName;
        saveBoards(boards);
        renderBoardList();
        showToast(`Board renamed to "${newName}"`);
    }
}

function addImageToBoard(boardId, imageId) {
    const boards = getBoards();
    const board = findBoardById(boards, boardId);
    if (board && !board.images.includes(imageId)) {
        board.images.push(imageId);
        saveBoards(boards);
        showToast('Image added to board');
    }
}

function removeImageFromBoard(boardId, imageId) {
    const boards = getBoards();
    const board = findBoardById(boards, boardId);
    if (board) {
        board.images = board.images.filter(id => id !== imageId);
        saveBoards(boards);
    }
}

function loadBoardsFromStorage() {
    renderBoardList();
}

function renderBoardList() {
    const list = document.getElementById('board-list');
    if (!list) return;

    const boards = getBoards();
    list.innerHTML = '';

    boards.forEach(board => {
        renderBoardItem(list, board, 0);
    });
}

function renderBoardItem(container, board, depth) {
    // Limit depth to 2 levels
    if (depth > 2) return;

    const hasSubfolders = board.subfolders && board.subfolders.length > 0;
    const isExpanded = localStorage.getItem(`board_expanded_${board.id}`) !== 'false';

    const wrapper = document.createElement('div');
    wrapper.className = 'board-item-wrapper';
    wrapper.dataset.boardId = board.id;

    const link = document.createElement('a');
    link.href = '#';
    link.className = 'nav-item board-link';
    link.dataset.board = board.id;
    link.style.paddingLeft = `${12 + depth * 16}px`;

    const icon = hasSubfolders ? (isExpanded ? 'bi-folder2-open' : 'bi-folder2') : 'bi-folder';

    link.innerHTML = `
        ${hasSubfolders ? `<button class="expand-toggle" onclick="event.preventDefault(); event.stopPropagation(); toggleBoardExpand('${board.id}')">
            <i class="bi bi-chevron-${isExpanded ? 'down' : 'right'}"></i>
        </button>` : '<span style="width: 16px; display: inline-block;"></span>'}
        <i class="bi ${icon}"></i>
        <span class="board-name">${board.name}</span>
        <span class="board-count">${board.images.length}</span>
    `;

    link.addEventListener('click', (e) => {
        e.preventDefault();
        filterByBoard(board.id);
        setActiveNav(link);
    });

    // Right-click context menu
    link.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showBoardContextMenu(e, board);
    });

    wrapper.appendChild(link);
    container.appendChild(wrapper);

    // Render subfolders in collapsible container
    if (hasSubfolders) {
        const subContainer = document.createElement('div');
        subContainer.className = 'sub-boards';
        subContainer.style.display = isExpanded ? 'block' : 'none';
        subContainer.dataset.parentBoard = board.id;

        board.subfolders.forEach(sub => {
            renderBoardItem(subContainer, sub, depth + 1);
        });

        container.appendChild(subContainer);
    }
}

function toggleBoardExpand(boardId) {
    const isCurrentlyExpanded = localStorage.getItem(`board_expanded_${boardId}`) !== 'false';
    localStorage.setItem(`board_expanded_${boardId}`, !isCurrentlyExpanded);
    renderBoardList(); // Re-render to update state
}

function filterByBoard(boardId) {
    const boards = getBoards();
    const board = findBoardById(boards, boardId);

    if (!board) {
        showAllItems();
        return;
    }

    currentActiveBoard = boardId;
    const gridItems = document.querySelectorAll('.grid-item');
    let hasResults = false;

    gridItems.forEach(item => {
        if (board.images.includes(item.dataset.id)) {
            item.style.display = 'block';
            hasResults = true;
        } else {
            item.style.display = 'none';
        }
    });

    handleEmptyState(hasResults);
    showToast(`Showing: ${board.name}`);
}

function setupBoardContextMenu() {
    // Create context menu element if not exists
    let menu = document.getElementById('board-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'board-context-menu';
        menu.className = 'context-menu hidden';
        menu.innerHTML = `
            <a href="#" data-action="add-subfolder"><i class="bi bi-folder-plus"></i> Add Subfolder</a>
            <a href="#" data-action="rename"><i class="bi bi-pencil"></i> Rename</a>
            <div class="divider"></div>
            <a href="#" data-action="delete" class="text-danger"><i class="bi bi-trash"></i> Delete</a>
        `;
        document.body.appendChild(menu);
    }

    // Close on click outside
    document.addEventListener('click', () => {
        menu.classList.add('hidden');
    });
}

function showBoardContextMenu(event, board) {
    const menu = document.getElementById('board-context-menu');
    if (!menu) return;

    menu.classList.remove('hidden');
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';

    // Remove old listeners and add new ones
    const newMenu = menu.cloneNode(true);
    menu.parentNode.replaceChild(newMenu, menu);

    newMenu.querySelector('[data-action="add-subfolder"]').addEventListener('click', (e) => {
        e.preventDefault();
        const name = prompt('Subfolder name:');
        if (name) {
            createBoard(name, board.id);
        }
    });

    newMenu.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
        e.preventDefault();
        const newName = prompt('New name:', board.name);
        if (newName && newName !== board.name) {
            renameBoard(board.id, newName);
        }
    });

    newMenu.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm(`Delete "${board.name}"?`)) {
            deleteBoard(board.id);
        }
    });
}

/* ============================================
   NEW VIDEO ANALYSIS with Quality Presets & Frame Approval
============================================ */
// Global state for background jobs
let activeVideoJob = null;
let approvalFrameState = { selected: new Set(), allFrames: [] };

function setupNewVideo() {
    const startBtn = document.getElementById('start-video-analysis');
    const urlInput = document.getElementById('video-url-input');
    const inputSection = document.getElementById('video-input-section');
    const progressSection = document.getElementById('video-progress-section');
    const approvalSection = document.getElementById('video-approval-section');
    const successSection = document.getElementById('video-success-section');
    const progressBar = document.getElementById('progress-bar');
    const progressMessage = document.getElementById('progress-message');
    const progressPercent = document.getElementById('progress-percent');
    const cancelBtn = document.getElementById('cancel-video-btn');
    const minimizeBtn = document.getElementById('minimize-video-btn');
    const approveBtn = document.getElementById('approve-frames-btn');
    const selectAllBtn = document.getElementById('select-all-btn');

    // Create floating status indicator
    createBackgroundIndicator();

    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            const url = urlInput?.value.trim();
            const qualityMode = document.querySelector('input[name="quality-mode"]:checked')?.value || 'medium';

            if (!url) {
                showToast('Please enter a video URL');
                return;
            }

            if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('vimeo.com')) {
                showToast('Please enter a valid YouTube or Vimeo URL');
                return;
            }

            // Show progress
            inputSection.style.display = 'none';
            progressSection.style.display = 'block';
            startBtn.style.display = 'none';

            try {
                // Start processing job with quality mode
                const response = await fetch('/api/process-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: url, quality_mode: qualityMode })
                });

                if (!response.ok) {
                    throw new Error('Failed to start processing');
                }

                const data = await response.json();

                // Check if already processed
                if (data.already_processed) {
                    showToast(data.message);
                    resetVideoModal();
                    if (data.redirect_url) {
                        window.location.href = data.redirect_url;
                    }
                    return;
                }

                const jobId = data.job_id;
                activeVideoJob = { jobId, url, qualityMode };

                // Start polling
                pollJobStatus(jobId);

            } catch (error) {
                console.error('Error:', error);
                showToast('Error: ' + error.message);
                resetVideoModal();
            }
        });
    }

    // Minimize button
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            const modal = document.getElementById('modal-new-video');
            if (modal) {
                closeModal(modal);
                showBackgroundIndicator();
                showToast('Processing continues in background');
            }
        });
    }

    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            activeVideoJob = null;
            hideBackgroundIndicator();
            const modal = document.getElementById('modal-new-video');
            if (modal) closeModal(modal);
            resetVideoModal();
        });
    }

    // Approve frames button
    if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
            await approveSelectedFrames();
        });
    }

    // Select all button
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const allSelected = approvalFrameState.selected.size === approvalFrameState.allFrames.length;
            if (allSelected) {
                approvalFrameState.selected.clear();
                selectAllBtn.textContent = 'Select All';
            } else {
                approvalFrameState.allFrames.forEach(f => approvalFrameState.selected.add(f.url));
                selectAllBtn.textContent = 'Deselect All';
            }
            updateApprovalUI();
        });
    }
}

async function pollJobStatus(jobId) {
    const progressBar = document.getElementById('progress-bar');
    const progressMessage = document.getElementById('progress-message');
    const progressPercent = document.getElementById('progress-percent');
    const progressSection = document.getElementById('video-progress-section');
    const approvalSection = document.getElementById('video-approval-section');

    while (activeVideoJob?.jobId === jobId) {
        try {
            const statusRes = await fetch(`/api/process-video/status/${jobId}`);
            const status = await statusRes.json();

            if (status.status === 'failed') {
                throw new Error(status.message || 'Processing failed');
            }

            // Update UI elements if visible
            if (progressMessage) progressMessage.textContent = status.message || 'Processing...';
            const progress = status.progress || 0;
            if (progressBar) progressBar.style.width = progress + '%';
            if (progressPercent) progressPercent.textContent = progress + '%';

            // Update background indicator
            updateBackgroundIndicator(progress, status.message);

            // Check for pending approval state
            if (status.status === 'pending_approval') {
                hideBackgroundIndicator();
                progressSection.style.display = 'none';
                approvalSection.style.display = 'block';

                // Update footer buttons
                document.getElementById('start-video-analysis').style.display = 'none';
                document.getElementById('approve-frames-btn').style.display = 'flex';

                // Render frames for approval
                renderApprovalFrames(status.selected_frames || [], status.rejected_frames || []);
                return;
            }

            if (status.status === 'completed') {
                handleProcessingComplete();
                return;
            }

            await sleep(2000);
        } catch (error) {
            console.error('Polling error:', error);
            showToast('Error: ' + error.message);
            activeVideoJob = null;
            hideBackgroundIndicator();
            resetVideoModal();
            return;
        }
    }
}

function renderApprovalFrames(selectedFrames, rejectedFrames) {
    const selectedGrid = document.getElementById('selected-frames-grid');
    const rejectedGrid = document.getElementById('rejected-frames-grid');
    const selectedCount = document.getElementById('selected-count');
    const rejectedCount = document.getElementById('rejected-count');

    // Store all frames for state management
    approvalFrameState.allFrames = [...selectedFrames, ...rejectedFrames];
    approvalFrameState.selected = new Set(selectedFrames.map(f => f.url));

    // Update counts
    selectedCount.textContent = selectedFrames.length;
    rejectedCount.textContent = rejectedFrames.length;

    // Render selected frames
    selectedGrid.innerHTML = selectedFrames.map(frame => `
        <div class="approval-frame selected" data-url="${frame.url}">
            <img src="${frame.url}" alt="Frame">
            <div class="check-overlay"><i class="bi bi-check"></i></div>
        </div>
    `).join('');

    // Render rejected frames
    rejectedGrid.innerHTML = rejectedFrames.map(frame => `
        <div class="approval-frame" data-url="${frame.url}">
            <img src="${frame.url}" alt="Frame">
            <div class="check-overlay"><i class="bi bi-check"></i></div>
            <div class="rejection-badge">${frame.reason || 'filtered'}</div>
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.approval-frame').forEach(el => {
        el.addEventListener('click', () => toggleFrameSelection(el));
    });

    updateApprovalUI();
}

function toggleFrameSelection(el) {
    const url = el.dataset.url;
    if (approvalFrameState.selected.has(url)) {
        approvalFrameState.selected.delete(url);
        el.classList.remove('selected');
    } else {
        approvalFrameState.selected.add(url);
        el.classList.add('selected');
    }
    updateApprovalUI();
}

function updateApprovalUI() {
    const count = approvalFrameState.selected.size;
    document.getElementById('approval-frame-count').textContent = count;
    document.getElementById('approval-credit-cost').textContent = count; // 1 credit per frame

    // Update visual state of all frames
    document.querySelectorAll('.approval-frame').forEach(el => {
        const url = el.dataset.url;
        if (approvalFrameState.selected.has(url)) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
}

async function approveSelectedFrames() {
    const approvedUrls = Array.from(approvalFrameState.selected);
    const rejectedUrls = approvalFrameState.allFrames
        .filter(f => !approvalFrameState.selected.has(f.url))
        .map(f => f.url);

    if (approvedUrls.length === 0) {
        showToast('Please select at least one frame to approve');
        return;
    }

    const approveBtn = document.getElementById('approve-frames-btn');
    approveBtn.disabled = true;
    approveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

    try {
        // Approve selected frames
        const approveRes = await fetch('/api/process-video/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: activeVideoJob.jobId,
                approved_urls: approvedUrls,
                video_url: activeVideoJob.url
            })
        });

        if (!approveRes.ok) {
            throw new Error('Failed to approve frames');
        }

        const approveResult = await approveRes.json();

        // Delete rejected frames from storage
        if (rejectedUrls.length > 0) {
            await fetch('/api/process-video/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_id: activeVideoJob.jobId,
                    rejected_urls: rejectedUrls
                })
            });
        }

        // Deduct credits
        deductCredits(approvedUrls.length);

        // Show success
        handleProcessingComplete(approveResult.approved_count);

    } catch (error) {
        console.error('Approval error:', error);
        showToast('Error: ' + error.message);
        approveBtn.disabled = false;
        approveBtn.innerHTML = '<i class="bi bi-check-lg"></i> Approve Selected';
    }
}

function handleProcessingComplete(frameCount) {
    const approvalSection = document.getElementById('video-approval-section');
    const successSection = document.getElementById('video-success-section');
    const successMessage = document.getElementById('success-message');

    if (approvalSection) approvalSection.style.display = 'none';
    if (successSection) successSection.style.display = 'block';
    if (successMessage && frameCount) {
        successMessage.textContent = `Added ${frameCount} frames to your library`;
    }

    // Hide approve button, show close
    document.getElementById('approve-frames-btn').style.display = 'none';

    activeVideoJob = null;
    hideBackgroundIndicator();
    showToast('Frames added successfully!');

    // Refresh grid
    setTimeout(() => {
        window.location.reload();
    }, 1500);
}

function createBackgroundIndicator() {
    if (document.getElementById('bg-process-indicator')) return;

    const indicator = document.createElement('div');
    indicator.id = 'bg-process-indicator';
    indicator.innerHTML = `
        <div class="bg-indicator-content">
            <div class="bg-indicator-spinner"></div>
            <div class="bg-indicator-text">
                <span class="bg-label">Processing video...</span>
                <span class="bg-progress">0%</span>
            </div>
            <button class="bg-indicator-expand" onclick="reopenVideoModal()">
                <i class="bi bi-arrows-angle-expand"></i>
            </button>
        </div>
    `;
    indicator.style.display = 'none';
    document.body.appendChild(indicator);
}

function showBackgroundIndicator() {
    const indicator = document.getElementById('bg-process-indicator');
    if (indicator) indicator.style.display = 'flex';
}

function hideBackgroundIndicator() {
    const indicator = document.getElementById('bg-process-indicator');
    if (indicator) indicator.style.display = 'none';
}

function updateBackgroundIndicator(progress, message) {
    const indicator = document.getElementById('bg-process-indicator');
    if (indicator) {
        const progressEl = indicator.querySelector('.bg-progress');
        const labelEl = indicator.querySelector('.bg-label');
        if (progressEl) progressEl.textContent = progress + '%';
        if (labelEl) labelEl.textContent = message || 'Processing...';
    }
}

function reopenVideoModal() {
    hideBackgroundIndicator();
    const modal = document.getElementById('modal-new-video');
    if (modal) openModal(modal);
}

function resetVideoModal() {
    const inputSection = document.getElementById('video-input-section');
    const progressSection = document.getElementById('video-progress-section');
    const approvalSection = document.getElementById('video-approval-section');
    const successSection = document.getElementById('video-success-section');
    const startBtn = document.getElementById('start-video-analysis');
    const approveBtn = document.getElementById('approve-frames-btn');
    const urlInput = document.getElementById('video-url-input');
    const progressBar = document.getElementById('progress-bar');

    if (inputSection) inputSection.style.display = 'block';
    if (progressSection) progressSection.style.display = 'none';
    if (approvalSection) approvalSection.style.display = 'none';
    if (successSection) successSection.style.display = 'none';
    if (startBtn) startBtn.style.display = 'flex';
    if (approveBtn) approveBtn.style.display = 'none';
    if (urlInput) urlInput.value = '';
    if (progressBar) progressBar.style.width = '0%';

    // Reset quality mode to medium
    const mediumRadio = document.querySelector('input[name="quality-mode"][value="medium"]');
    if (mediumRadio) mediumRadio.checked = true;

    // Clear approval state
    approvalFrameState = { selected: new Set(), allFrames: [] };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* ============================================
   SEARCH & FILTERING
============================================ */
let searchTimeout = null;
let isSemanticSearch = false;

function setupSearch() {
    const searchInput = document.querySelector('.search-bar input');
    const searchForm = document.querySelector('.search-bar');
    const semanticToggle = document.getElementById('semantic-toggle');

    if (searchInput) {
        // Prevent form submission - we handle search via AJAX
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                performSearch(searchInput.value);
            });
        }

        // Debounced search - wait 300ms after user stops typing
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;

            // Clear any pending search
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            // Show loading indicator
            showSearchLoading(true);

            // Debounce: wait 300ms before executing search
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300);
        });

        // Clear on ESC
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (searchTimeout) clearTimeout(searchTimeout);
                searchInput.value = '';
                showAllItems();
                showSearchLoading(false);
                searchInput.blur();
            }
        });
    }

    // Semantic search toggle
    if (semanticToggle) {
        semanticToggle.addEventListener('click', () => {
            isSemanticSearch = !isSemanticSearch;
            semanticToggle.classList.toggle('active', isSemanticSearch);
            semanticToggle.title = isSemanticSearch ? 'Semantic search ON (AI meaning)' : 'Text search (exact match)';

            // Re-run search with new mode if there's a query
            const query = document.querySelector('.search-bar input')?.value;
            if (query) {
                performSearch(query);
            }

            showToast(isSemanticSearch ? 'Semantic search enabled' : 'Text search enabled');
        });
    }
}

// Filter Menu Toggle
function toggleFilterMenu() {
    const popover = document.getElementById('filter-popover');
    const btn = document.getElementById('btn-filter-toggle');

    if (popover) {
        popover.classList.toggle('hidden');
        const isVisible = !popover.classList.contains('hidden');

        if (btn) {
            if (isVisible) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }
}

function showSearchLoading(show) {
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        if (show) {
            searchBar.classList.add('loading');
        } else {
            searchBar.classList.remove('loading');
        }
    }
}

async function performSearch(query) {
    showSearchLoading(true);

    // If empty query, show all items
    if (!query || query.trim() === '') {
        showAllItems();
        showSearchLoading(false);
        return;
    }

    // For local/client-side filtering (fast, works without API)
    if (!isSemanticSearch) {
        filterGridLocal(query.toLowerCase());
        showSearchLoading(false);
        return;
    }

    // Semantic search via API
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=semantic`);

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const data = await response.json();

        if (data.images && data.images.length > 0) {
            // Get IDs of matching images
            const matchingIds = new Set(data.images.map(img => String(img.id)));

            // Filter grid items
            const gridItems = document.querySelectorAll('.grid-item');
            let hasResults = false;

            gridItems.forEach(item => {
                if (matchingIds.has(item.dataset.id)) {
                    item.style.display = 'block';
                    hasResults = true;
                } else {
                    item.style.display = 'none';
                }
            });

            handleEmptyState(hasResults);
        } else {
            handleEmptyState(false);
        }
    } catch (error) {
        console.error('Semantic search error:', error);
        // Fallback to local filtering
        filterGridLocal(query.toLowerCase());
        showToast('Semantic search unavailable, using text search');
    }

    showSearchLoading(false);
}

function filterGridLocal(query) {
    const gridItems = document.querySelectorAll('.grid-item');
    let matchCount = 0;

    gridItems.forEach(item => {
        const prompt = item.dataset.prompt?.toLowerCase() || '';
        const tags = item.dataset.tags?.toLowerCase() || '';
        const mood = item.dataset.mood?.toLowerCase() || '';

        const match = prompt.includes(query) || tags.includes(query) || mood.includes(query);

        if (match) {
            item.style.display = 'block';
            matchCount++;
        } else {
            item.style.display = 'none';
        }
    });

    // Update result count display
    updateSearchResultCount(matchCount, gridItems.length);
    handleEmptyState(matchCount > 0);
}

function updateSearchResultCount(count, total) {
    let countEl = document.getElementById('search-result-count');
    if (!countEl) {
        // Create count element if it doesn't exist
        const searchBar = document.querySelector('.search-bar');
        if (searchBar) {
            countEl = document.createElement('span');
            countEl.id = 'search-result-count';
            countEl.className = 'search-count';
            searchBar.parentNode.insertBefore(countEl, searchBar.nextSibling);
        }
    }
    if (countEl) {
        if (count < total) {
            countEl.textContent = `${count} of ${total}`;
            countEl.style.display = 'inline';
        } else {
            countEl.style.display = 'none';
        }
    }
}

// Keep old function name for backwards compatibility
function filterGrid(query) {
    filterGridLocal(query);
}

function handleEmptyState(hasResults) {
    let emptyState = document.getElementById('empty-state');
    const grid = document.querySelector('.masonry-grid');

    if (!grid) return;

    if (!hasResults) {
        if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.id = 'empty-state';
            emptyState.innerHTML = `
                <i class="bi bi-search"></i>
                <p>No vibes found matching your search.</p>
            `;
            grid.parentNode.insertBefore(emptyState, grid.nextSibling);
        }
        emptyState.style.display = 'block';
        grid.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        grid.style.display = 'block';
    }
}

/* ============================================
   FAVORITES SYSTEM
============================================ */
function setupFavorites() {
    const favorites = JSON.parse(localStorage.getItem('vibecheck_favorites') || '[]');
    updateFavoriteIcons(favorites);

    document.addEventListener('click', (e) => {
        const starBtn = e.target.closest('.btn-star, .action-btn');
        if (starBtn) {
            e.stopPropagation();
            e.preventDefault();

            const itemId = starBtn.dataset.id;
            if (itemId) {
                toggleFavorite(itemId, starBtn);
            }
        }
    });
}

function toggleFavorite(id, btn) {
    let favorites = JSON.parse(localStorage.getItem('vibecheck_favorites') || '[]');
    const index = favorites.indexOf(id);
    const icon = btn.querySelector('i');

    if (index === -1) {
        favorites.push(id);
        icon.classList.remove('bi-star');
        icon.classList.add('bi-star-fill');
        btn.classList.add('active');
        showToast('Added to Favorites');
    } else {
        favorites.splice(index, 1);
        icon.classList.remove('bi-star-fill');
        icon.classList.add('bi-star');
        btn.classList.remove('active');
        showToast('Removed from Favorites');
    }

    localStorage.setItem('vibecheck_favorites', JSON.stringify(favorites));

    if (document.body.dataset.view === 'favorites') {
        filterFavoritesView();
    }
}

function updateFavoriteIcons(favorites) {
    const buttons = document.querySelectorAll('.btn-star[data-id], .action-btn[data-id]');
    buttons.forEach(btn => {
        const id = btn.dataset.id;
        const icon = btn.querySelector('i');
        if (favorites.includes(id)) {
            icon.classList.remove('bi-star');
            icon.classList.add('bi-star-fill');
            btn.classList.add('active');
        } else {
            icon.classList.remove('bi-star-fill');
            icon.classList.add('bi-star');
            btn.classList.remove('active');
        }
    });
}

/* ============================================
   NAVIGATION & SIDEBAR
============================================ */
function setupNavigation() {
    const navItems = {
        'nav-all-photos': () => {
            document.body.dataset.view = 'all';
            resetFilters();
            showAllItems();
        },
        'nav-favorites': () => {
            document.body.dataset.view = 'favorites';
            filterFavoritesView();
        },
        'nav-recent': () => {
            document.body.dataset.view = 'recent';
            showToast('Showing recent items');
            showAllItems(); // In real app, sort by timestamp
        },
        'nav-discover': () => {
            document.body.dataset.view = 'discover';
            showToast('Discover: Community uploads');
            showAllItems();
        },
        'nav-trending': () => {
            document.body.dataset.view = 'trending';
            showToast('Trending: Popular this week');
            showAllItems();
        }
    };

    Object.entries(navItems).forEach(([id, handler]) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                setActiveNav(el);
                handler();
            });
        }
    });
}

function setActiveNav(activeElement) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    activeElement.classList.add('active');
}

function resetFilters() {
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.value = '';
    }
}

function showAllItems() {
    const gridItems = document.querySelectorAll('.grid-item');
    gridItems.forEach(item => item.style.display = 'block');
    handleEmptyState(gridItems.length > 0);
}

function filterFavoritesView() {
    const favorites = JSON.parse(localStorage.getItem('vibecheck_favorites') || '[]');
    const gridItems = document.querySelectorAll('.grid-item');
    let hasResults = false;

    gridItems.forEach(item => {
        const id = item.dataset.id;
        if (favorites.includes(id)) {
            item.style.display = 'block';
            hasResults = true;
        } else {
            item.style.display = 'none';
        }
    });

    handleEmptyState(hasResults);
}

/* ============================================
   GRID INTERACTIONS
============================================ */
function setupGridInteractions() {
    // Copy prompt on hover button click
    document.querySelectorAll('.btn-copy-overlay').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const gridItem = btn.closest('.grid-item');
            const prompt = gridItem?.dataset.prompt;
            if (prompt) {
                copyPrompt(prompt);
            }
        });
    });
}

/* ============================================
   HELPER FUNCTIONS
============================================ */
function copyPrompt(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Prompt copied!');
        addNotification('Prompt copied to clipboard');
    });
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied: ' + text);
    });
}

function addNotification(message) {
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown) {
        const header = dropdown.querySelector('.notifications-header');
        const item = document.createElement('div');
        item.className = 'notification-item';
        item.innerHTML = `
            <div class="icon"><i class="bi bi-clipboard-check"></i></div>
            <div class="content">
                <p>${message}</p>
                <span>Just now</span>
            </div>
        `;
        header.insertAdjacentElement('afterend', item);
    }
}

function showToast(message) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 2000;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    toast.style.cssText = `
        padding: 14px 24px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(236, 72, 153, 0.9) 100%);
        backdrop-filter: blur(10px);
        color: white;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 10px 40px rgba(139, 92, 246, 0.4);
        animation: toastSlideIn 0.3s ease forwards;
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animation keyframes
const style = document.createElement('style');
style.innerHTML = `
    @keyframes toastSlideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

/* ============================================
   SMART MOODBOARD
============================================ */
let smartBoardState = {
    prompt: '',
    concepts: null,
    selectedConcepts: [], // Track which concepts are selected
    preview: [],
    imageCount: 20,
    strictness: 0.55,
    referenceImages: [] // Track uploaded reference images
};

function setupSmartBoard() {
    const analyzeBtn = document.getElementById('analyze-prompt-btn');
    const generateBtn = document.getElementById('generate-smart-board');
    const promptInput = document.getElementById('smart-prompt');
    const strictnessSlider = document.getElementById('strictness-slider');
    const countGroup = document.getElementById('image-count-group');
    const refImageInput = document.getElementById('ref-image-input');

    // Reference image upload handler
    if (refImageInput) {
        refImageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    addReferenceImage(event.target.result, file.name);
                };
                reader.readAsDataURL(file);
            });
            refImageInput.value = ''; // Reset for next upload
        });
    }

    // Analyze button
    if (analyzeBtn && promptInput) {
        analyzeBtn.addEventListener('click', async () => {
            const prompt = promptInput.value.trim();
            if (!prompt) {
                showToast('Please describe your vision first');
                return;
            }

            smartBoardState.prompt = prompt;
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Analyzing...';

            try {
                await analyzeSmartPrompt(prompt);

                // Show analysis section
                document.getElementById('smart-input-section').style.display = 'none';
                document.getElementById('smart-analysis-section').style.display = 'block';
                generateBtn.style.display = 'flex';

            } catch (error) {
                console.error('Analysis error:', error);
                showToast('Failed to analyze prompt');
            }

            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="bi bi-magic"></i> Analyze';
        });
    }

    // Image count slider (new)
    const imageCountSlider = document.getElementById('image-count-slider');
    if (imageCountSlider) {
        imageCountSlider.addEventListener('input', () => {
            const value = parseInt(imageCountSlider.value);
            smartBoardState.imageCount = value;
            const label = document.getElementById('image-count-label');
            if (label) label.textContent = value;
        });
    }

    // Strictness slider
    if (strictnessSlider) {
        strictnessSlider.addEventListener('input', () => {
            const value = parseInt(strictnessSlider.value);
            smartBoardState.strictness = value / 100;

            const label = document.getElementById('strictness-label');
            if (value < 45) {
                label.textContent = 'Loose';
            } else if (value < 65) {
                label.textContent = 'Medium';
            } else {
                label.textContent = 'Strict';
            }
        });
    }

    // Find More button
    const findMoreBtn = document.getElementById('find-more-btn');
    if (findMoreBtn) {
        findMoreBtn.addEventListener('click', async () => {
            if (!smartBoardState.prompt) return;

            findMoreBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Finding...';
            findMoreBtn.disabled = true;

            try {
                const response = await fetch('/api/smart-board/parse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: smartBoardState.prompt })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.preview?.length) {
                        // Add new previews that aren't already in the list
                        const existingIds = smartBoardState.preview.map(p => p.id);
                        const newPreviews = data.preview.filter(p => !existingIds.includes(p.id));
                        smartBoardState.preview.push(...newPreviews);

                        // Re-render preview
                        const previewGrid = document.getElementById('smart-preview');
                        if (previewGrid) {
                            previewGrid.innerHTML = smartBoardState.preview.map((img, i) => `
                                <div class="preview-item" data-id="${img.id}">
                                    <img src="${img.image_url}" alt="Preview">
                                    <button class="remove-btn" onclick="removePreviewImage(${i}, event)">✕</button>
                                </div>
                            `).join('');
                        }
                    }
                }
            } catch (e) {
                console.error('Find more error:', e);
            }

            findMoreBtn.innerHTML = '<i class="bi bi-plus"></i> Find More';
            findMoreBtn.disabled = false;
        });
    }

    // Select All suggestions toggle
    const toggleAllBtn = document.getElementById('toggle-all-suggestions');
    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', () => {
            const suggestions = smartBoardState.concepts?.suggestions || [];
            const allSelected = smartBoardState.selectedSuggestions?.length === suggestions.length;

            if (allSelected) {
                // Deselect all
                smartBoardState.selectedSuggestions = [];
                document.querySelectorAll('.suggestion-item').forEach(item => {
                    item.classList.remove('selected');
                });
                toggleAllBtn.textContent = 'Select All';
            } else {
                // Select all
                smartBoardState.selectedSuggestions = [...suggestions];
                document.querySelectorAll('.suggestion-item').forEach(item => {
                    item.classList.add('selected');
                });
                toggleAllBtn.textContent = 'Deselect All';
            }
        });
    }

    // Generate button
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const name = document.getElementById('smart-board-name')?.value.trim() || 'Smart Board';
            await generateSmartBoard(smartBoardState.prompt, name);
        });
    }
}

function addReferenceImage(dataUrl, fileName) {
    smartBoardState.referenceImages.push({ dataUrl, fileName });
    renderReferenceImages();
}

function removeReferenceImage(index) {
    smartBoardState.referenceImages.splice(index, 1);
    renderReferenceImages();
}

function renderReferenceImages() {
    const container = document.getElementById('ref-images-container');
    if (!container) return;

    container.innerHTML = smartBoardState.referenceImages.map((img, idx) => `
        <div class="ref-image-item">
            <img src="${img.dataUrl}" alt="${img.fileName}">
            <button class="remove-btn" onclick="removeReferenceImage(${idx})">
                <i class="bi bi-x"></i>
            </button>
        </div>
    `).join('');
}

async function analyzeSmartPrompt(prompt) {
    const response = await fetch('/api/smart-board/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error('Parse failed');

    const data = await response.json();
    smartBoardState.concepts = data.concepts;
    smartBoardState.selectedSuggestions = []; // Track selected suggestions
    smartBoardState.preview = data.preview || [];

    // Generate main insight from AI understanding
    const insightEl = document.getElementById('insight-text');
    if (insightEl && data.concepts) {
        const moods = data.concepts.moods?.slice(0, 2).join(', ') || 'creative';
        const styles = data.concepts.styles?.slice(0, 2).join(', ') || 'visual';
        const subjects = data.concepts.subjects?.slice(0, 2).join(', ') || 'imagery';
        insightEl.textContent = `Looking for ${moods} ${styles} ${subjects}...`;
    }

    // Render suggestions as checklist (natural language)
    const suggestionsList = document.getElementById('suggestions-list');
    if (suggestionsList && data.concepts?.suggestions) {
        const suggestions = data.concepts.suggestions;
        suggestionsList.innerHTML = suggestions.map((s, i) => `
            <div class="suggestion-item selected" data-index="${i}" onclick="toggleSuggestion(${i})">
                <div class="suggestion-checkbox"></div>
                <div class="suggestion-text">${s}</div>
            </div>
        `).join('');

        // Select all suggestions by default
        smartBoardState.selectedSuggestions = [...suggestions];
    } else {
        suggestionsList.innerHTML = '<div class="suggestion-item"><div class="suggestion-text" style="color: var(--text-secondary);">No specific suggestions - using your description directly</div></div>';
    }

    // Render preview grid with remove buttons
    const previewGrid = document.getElementById('smart-preview');
    if (previewGrid) {
        if (data.preview?.length) {
            previewGrid.innerHTML = data.preview.map((img, i) => `
                <div class="preview-item" data-id="${img.id}">
                    <img src="${img.image_url}" alt="Preview">
                    <button class="remove-btn" onclick="removePreviewImage(${i}, event)">✕</button>
                </div>
            `).join('');
        } else {
            previewGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1; padding: 20px;">No preview matches yet</p>';
        }
    }

    // Store filter concepts for "More Options"
    renderFilterChips(data.concepts);

    // Suggested name
    const nameInput = document.getElementById('smart-board-name');
    if (nameInput && data.suggested_name) {
        nameInput.value = data.suggested_name;
    }
}

// Toggle suggestion selection
function toggleSuggestion(index) {
    const suggestions = smartBoardState.concepts?.suggestions || [];
    const suggestion = suggestions[index];
    if (!suggestion) return;

    const idx = smartBoardState.selectedSuggestions.indexOf(suggestion);
    if (idx > -1) {
        smartBoardState.selectedSuggestions.splice(idx, 1);
    } else {
        smartBoardState.selectedSuggestions.push(suggestion);
    }

    // Update UI
    const item = document.querySelector(`.suggestion-item[data-index="${index}"]`);
    if (item) {
        item.classList.toggle('selected', idx === -1);
    }
}

// Remove image from preview
function removePreviewImage(index, event) {
    event.stopPropagation();
    smartBoardState.preview.splice(index, 1);

    // Re-render preview
    const previewGrid = document.getElementById('smart-preview');
    if (previewGrid) {
        previewGrid.innerHTML = smartBoardState.preview.map((img, i) => `
            <div class="preview-item" data-id="${img.id}">
                <img src="${img.image_url}" alt="Preview">
                <button class="remove-btn" onclick="removePreviewImage(${i}, event)">✕</button>
            </div>
        `).join('') || '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">No images selected</p>';
    }
}

// Render filter chips in "More Options"
function renderFilterChips(concepts) {
    const filterContainer = document.getElementById('filter-chips');
    if (!filterContainer || !concepts) return;

    let chips = [];

    // Add mood filters
    if (concepts.moods?.length) {
        concepts.moods.slice(0, 4).forEach(m => {
            chips.push({ type: 'mood', value: m, active: true });
        });
    }

    // Add color filters
    if (concepts.colors?.length) {
        concepts.colors.slice(0, 4).forEach(c => {
            chips.push({ type: 'color', value: c, active: true });
        });
    }

    smartBoardState.filterChips = chips;

    filterContainer.innerHTML = chips.map((chip, i) => `
        <span class="filter-chip ${chip.active ? 'active' : ''}" data-index="${i}" onclick="toggleFilterChip(${i})">
            ${chip.value}
        </span>
    `).join('') || '<span style="color: var(--text-secondary); font-size: 11px;">No filters available</span>';
}

// Toggle filter chip
function toggleFilterChip(index) {
    if (!smartBoardState.filterChips?.[index]) return;
    smartBoardState.filterChips[index].active = !smartBoardState.filterChips[index].active;

    const chip = document.querySelector(`.filter-chip[data-index="${index}"]`);
    if (chip) {
        chip.classList.toggle('active', smartBoardState.filterChips[index].active);
    }
}

// Toggle concept selection
function toggleConcept(concept) {
    const idx = smartBoardState.selectedConcepts.indexOf(concept);
    if (idx > -1) {
        // Deselect
        smartBoardState.selectedConcepts.splice(idx, 1);
    } else {
        // Select
        smartBoardState.selectedConcepts.push(concept);
    }

    // Update visual state
    const chip = document.querySelector(`.concept-tag[data-concept="${concept}"]`);
    if (chip) {
        chip.classList.toggle('deselected', idx > -1);
    }
}

async function generateSmartBoard(prompt, name) {
    const inputSection = document.getElementById('smart-input-section');
    const analysisSection = document.getElementById('smart-analysis-section');
    const progressSection = document.getElementById('smart-progress-section');
    const successSection = document.getElementById('smart-success-section');
    const generateBtn = document.getElementById('generate-smart-board');
    const progressBar = document.getElementById('smart-progress-bar');
    const progressMessage = document.getElementById('smart-progress-message');

    // Show progress
    analysisSection.style.display = 'none';
    progressSection.style.display = 'block';
    generateBtn.style.display = 'none';

    progressBar.style.width = '30%';
    progressMessage.textContent = 'Searching for matching images...';

    try {
        const response = await fetch('/api/smart-board/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                count: smartBoardState.imageCount,
                strictness: smartBoardState.strictness,
                name,
                selectedConcepts: smartBoardState.selectedConcepts,
                referenceImages: smartBoardState.referenceImages.map(img => img.dataUrl)
            })
        });

        progressBar.style.width = '70%';
        progressMessage.textContent = 'Creating your board...';

        if (!response.ok) throw new Error('Generation failed');

        const data = await response.json();

        progressBar.style.width = '100%';

        // Add board to localStorage
        if (data.board) {
            const boards = getBoards();
            boards.push({
                id: data.board.id,
                name: data.board.name,
                images: data.board.images.map(id => String(id)),
                subfolders: [],
                isSmartBoard: true,
                prompt: prompt,
                createdAt: new Date().toISOString()
            });
            saveBoards(boards);
            renderBoardList();
        }

        // Show success
        setTimeout(() => {
            progressSection.style.display = 'none';
            successSection.style.display = 'block';

            const successMsg = document.getElementById('smart-success-message');
            if (successMsg) {
                successMsg.textContent = `Added ${data.board.images.length} images to "${name}"`;
            }

            showToast('Smart Board created!');

            // Reset after delay
            setTimeout(() => {
                resetSmartBoardModal();
            }, 2000);
        }, 500);

    } catch (error) {
        console.error('Generation error:', error);
        showToast('Failed to create board');
        resetSmartBoardModal();
    }
}

function resetSmartBoardModal() {
    const modal = document.getElementById('modal-smart-board');
    if (modal) closeModal(modal);

    // Reset all sections
    document.getElementById('smart-input-section').style.display = 'block';
    document.getElementById('smart-analysis-section').style.display = 'none';
    document.getElementById('smart-progress-section').style.display = 'none';
    document.getElementById('smart-success-section').style.display = 'none';
    document.getElementById('generate-smart-board').style.display = 'none';
    document.getElementById('smart-progress-bar').style.width = '0%';

    // Reset inputs
    document.getElementById('smart-prompt').value = '';
    document.getElementById('smart-board-name').value = '';
    document.getElementById('strictness-slider').value = 55;
    document.getElementById('strictness-label').textContent = 'Medium';

    // Reset count buttons
    document.querySelectorAll('#image-count-group button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.count === '20');
    });

    // Reset state
    smartBoardState = {
        prompt: '',
        concepts: null,
        preview: [],
        imageCount: 20,
        strictness: 0.55
    };
}

async function togglePrivacy(imageId, btnElement) {
    const icon = btnElement.querySelector('i');
    const isCurrentlyPublic = icon.classList.contains('bi-globe');
    const newVisibility = !isCurrentlyPublic;

    // Optimistic UI update
    if (isCurrentlyPublic) {
        icon.classList.remove('bi-globe');
        icon.classList.add('bi-lock-fill');
        btnElement.classList.add('text-danger');
        btnElement.title = "Private";
    } else {
        icon.classList.remove('bi-lock-fill');
        icon.classList.add('bi-globe');
        btnElement.classList.remove('text-danger');
        btnElement.title = "Public";
    }

    try {
        const response = await fetch(`/api/images/${imageId}/visibility`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_public: newVisibility })
        });

        if (!response.ok) throw new Error('API request failed');

        showToast(newVisibility ? 'Made public' : 'Made private');

    } catch (e) {
        console.error('Privacy toggle failed', e);
        // Revert UI on error
        if (isCurrentlyPublic) {
            icon.classList.add('bi-globe');
            icon.classList.remove('bi-lock-fill');
            btnElement.classList.remove('text-danger');
            btnElement.title = "Public";
        } else {
            icon.classList.add('bi-lock-fill');
            icon.classList.remove('bi-globe');
            btnElement.classList.add('text-danger');
            btnElement.title = "Private";
        }
        showToast('Failed to update privacy');
    }
}

// Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const brandText = document.querySelector('.brand-text');

    if (sidebar) {
        sidebar.classList.toggle('collapsed');

        // Persist state
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    }
}

// Init Sidebar State
document.addEventListener('DOMContentLoaded', () => {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    const sidebar = document.querySelector('.sidebar');
    if (isCollapsed && sidebar) {
        sidebar.classList.add('collapsed');
    }
});

/* ============================================
   PINTEREST-STYLE CARD FEATURES
============================================ */

// Toggle Save Dropdown
function toggleSaveDropdown(btn) {
    const wrapper = btn.closest('.save-dropdown-wrapper');
    const dropdown = wrapper.querySelector('.save-dropdown');

    // Close any other open dropdowns first
    document.querySelectorAll('.save-dropdown:not(.hidden)').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
    });

    dropdown.classList.toggle('hidden');

    if (!dropdown.classList.contains('hidden')) {
        populateBoardList(dropdown);
        dropdown.querySelector('.dropdown-search')?.focus();
    }
}

// Populate board list in dropdown
function populateBoardList(dropdown) {
    const boardList = dropdown.querySelector('.board-list');
    const imageId = boardList.dataset.imageId;
    const boards = getBoards();

    boardList.innerHTML = '';

    if (boards.length === 0) {
        boardList.innerHTML = '<div style="padding: 12px 16px; color: var(--text-tertiary); font-size: 13px;">No boards yet</div>';
        return;
    }

    boards.slice(0, 5).forEach(board => {
        const item = document.createElement('div');
        item.className = 'board-item';
        item.innerHTML = `
            <div class="board-item-left">
                <i class="bi bi-grid-3x3-gap"></i>
                <span>${board.name}</span>
            </div>
            <button class="add-btn" onclick="event.stopPropagation(); quickAddToBoard('${board.id}', '${imageId}', this)">
                <i class="bi bi-plus"></i>
            </button>
        `;
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.add-btn')) {
                addImageToBoard(board.id, imageId);
                dropdown.classList.add('hidden');
            }
        });
        boardList.appendChild(item);
    });
}

// Quick add to board (+ button)
function quickAddToBoard(boardId, imageId, btn) {
    addImageToBoard(boardId, imageId);
    btn.innerHTML = '<i class="bi bi-check"></i>';
    btn.style.background = 'var(--accent-green, #22c55e)';

    setTimeout(() => {
        btn.innerHTML = '<i class="bi bi-plus"></i>';
        btn.style.background = '';
    }, 1500);
}

// Filter boards in dropdown
function filterBoards(input) {
    const query = input.value.toLowerCase();
    const dropdown = input.closest('.save-dropdown');
    const boardList = dropdown.querySelector('.board-list');
    const boards = getBoards().filter(b => b.name.toLowerCase().includes(query));

    boardList.innerHTML = '';
    boards.forEach(board => {
        const item = document.createElement('div');
        item.className = 'board-item';
        item.innerHTML = `
            <div class="board-item-left">
                <i class="bi bi-grid-3x3-gap"></i>
                <span>${board.name}</span>
            </div>
            <button class="add-btn" onclick="event.stopPropagation(); quickAddToBoard('${board.id}', '${boardList.dataset.imageId}', this)">
                <i class="bi bi-plus"></i>
            </button>
        `;
        boardList.appendChild(item);
    });
}

// Open new board modal (with image to add)
function openNewBoardModal(imageId) {
    const modal = document.getElementById('modal-new-board');
    if (modal) {
        modal.dataset.pendingImage = imageId;
        openModal(modal);
    }
    // Close save dropdown
    document.querySelectorAll('.save-dropdown').forEach(d => d.classList.add('hidden'));
}

// Search Similar Items
function searchSimilar(imageId) {
    // Redirect to search with image-based query
    window.location.href = `/search?similar_to=${imageId}`;
}

// Multi-select Toggle
let selectedImages = new Set();

function toggleSelect(imageId, element) {
    const icon = element.querySelector('i');

    if (selectedImages.has(imageId)) {
        selectedImages.delete(imageId);
        element.classList.remove('selected');
        icon.className = 'bi bi-square';
    } else {
        selectedImages.add(imageId);
        element.classList.add('selected');
        icon.className = 'bi bi-check-square-fill';
    }

    updateMultiSelectUI();
}

function updateMultiSelectUI() {
    const count = selectedImages.size;
    let bar = document.getElementById('multi-select-bar');

    if (count > 0) {
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'multi-select-bar';
            bar.className = 'multi-select-bar';
            bar.innerHTML = `
                <span class="count">${count} selected</span>
                <div class="actions">
                    <button onclick="bulkAddToBoard()"><i class="bi bi-folder-plus"></i> Add to Board</button>
                    <button onclick="clearSelection()"><i class="bi bi-x"></i> Clear</button>
                </div>
            `;
            document.body.appendChild(bar);
        } else {
            bar.querySelector('.count').textContent = `${count} selected`;
        }
        bar.classList.add('visible');
    } else if (bar) {
        bar.classList.remove('visible');
    }
}

function clearSelection() {
    selectedImages.clear();
    document.querySelectorAll('.card-select.selected').forEach(el => {
        el.classList.remove('selected');
        el.querySelector('i').className = 'bi bi-square';
    });
    updateMultiSelectUI();
}

function bulkAddToBoard() {
    if (selectedImages.size === 0) return;

    const boards = getBoards();
    if (boards.length === 0) {
        showToast('Create a board first');
        return;
    }

    // For simplicity, add to first board. Could show picker modal.
    const firstBoard = boards[0];
    selectedImages.forEach(id => addImageToBoard(firstBoard.id, id));
    showToast(`Added ${selectedImages.size} images to "${firstBoard.name}"`);
    clearSelection();
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.save-dropdown-wrapper')) {
        document.querySelectorAll('.save-dropdown').forEach(d => d.classList.add('hidden'));
    }
});

// Share to Community (make private image public)
async function shareToCommunity(imageId) {
    if (!confirm('Make this image public and share with the community?')) return;

    // Optimistic UI update
    const card = document.querySelector(`[data-id="${imageId}"]`);
    if (card) {
        const privacyBtn = card.querySelector('[title="Private"]');
        if (privacyBtn) {
            privacyBtn.title = 'Public';
            privacyBtn.classList.remove('text-danger');
            privacyBtn.querySelector('i').className = 'bi bi-globe';
        }
    }

    try {
        const response = await fetch(`/api/images/${imageId}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Share failed');

        showToast('Image shared with community!');

    } catch (e) {
        console.error('Share error:', e);
        showToast('Failed to share image');
        // Revert UI
        if (card) {
            const privacyBtn = card.querySelector('[title="Public"]');
            if (privacyBtn) {
                privacyBtn.title = 'Private';
                privacyBtn.classList.add('text-danger');
                privacyBtn.querySelector('i').className = 'bi bi-lock-fill';
            }
        }
    }
}

/* ============================================
   INFINITE SCROLL / PAGINATION
============================================ */

let currentPage = 1;
let isLoadingMore = false;
let hasMoreImages = true;

function setupInfiniteScroll() {
    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.style.height = '1px';

    const grid = document.querySelector('.masonry-grid');
    if (!grid) return;

    grid.parentNode.insertBefore(sentinel, grid.nextSibling);

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreImages && !isLoadingMore) {
            loadMoreImages();
        }
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
}

async function loadMoreImages() {
    if (isLoadingMore || !hasMoreImages) return;

    isLoadingMore = true;
    currentPage++;

    // Show loading indicator
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) {
        sentinel.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="bi bi-arrow-repeat spin"></i> Loading more...</div>';
    }

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sort = urlParams.get('sort') || 'ranked';
        const offset = (currentPage - 1) * 50;

        const response = await fetch(`/api/images?sort=${sort}&offset=${offset}&limit=50`);

        if (!response.ok) throw new Error('Failed to load');

        const data = await response.json();

        if (data.images && data.images.length > 0) {
            appendImagesToGrid(data.images);
            hasMoreImages = data.images.length === 50;
        } else {
            hasMoreImages = false;
        }

    } catch (e) {
        console.error('Load more error:', e);
        hasMoreImages = false;
    } finally {
        isLoadingMore = false;
        if (sentinel) sentinel.innerHTML = '';
    }
}

function appendImagesToGrid(images) {
    const grid = document.querySelector('.masonry-grid');
    if (!grid) return;

    images.forEach(img => {
        const card = document.createElement('div');
        card.className = 'grid-item card-hover';
        card.dataset.id = img.id;
        card.innerHTML = `
            <div class="image-wrapper">
                <img src="${img.image_url}" alt="" loading="lazy" onclick="window.location.href='/image/${img.id}'">
                <div class="card-select" onclick="event.stopPropagation(); toggleSelect('${img.id}', this)">
                    <i class="bi bi-square"></i>
                </div>
                <div class="card-top-actions">
                    <button class="btn-card" onclick="event.stopPropagation(); searchSimilar('${img.id}')" title="Search similar">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setupInfiniteScroll();
});

/* ============================================
   ADD TO FOLDER ACTION
============================================ */

function showCardContextMenu(e, imageId) {
    e.preventDefault();
    
    // Remove existing context menu
    document.querySelectorAll('.context-menu').forEach(m => m.remove());
    
    const boards = getBoards();
    const boardOptions = boards.map(b => 
        `<div class="context-item" onclick="addImageToBoard('${b.id}', '${imageId}'); closeContextMenu();">
            <i class="bi bi-folder"></i> ${b.name}
        </div>`
    ).join('');
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-item" onclick="searchSimilar('${imageId}'); closeContextMenu();">
            <i class="bi bi-search"></i> Search Similar
        </div>
        <div class="context-item" onclick="copyImageUrl('${imageId}'); closeContextMenu();">
            <i class="bi bi-link-45deg"></i> Copy Link
        </div>
        <div class="context-divider"></div>
        <div class="context-label">Add to Folder</div>
        ${boardOptions || '<div class="context-item disabled">No folders yet</div>'}
        <div class="context-divider"></div>
        <div class="context-item text-danger" onclick="hideImage('${imageId}'); closeContextMenu();">
            <i class="bi bi-eye-slash"></i> Hide from Feed
        </div>
    `;
    
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    
    document.body.appendChild(menu);
    
    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', closeContextMenu, { once: true });
    }, 10);
}

function closeContextMenu() {
    document.querySelectorAll('.context-menu').forEach(m => m.remove());
}

function copyImageUrl(imageId) {
    const url = `${window.location.origin}/image/${imageId}`;
    navigator.clipboard.writeText(url);
    showToast('Link copied!');
}

function hideImage(imageId) {
    // Hide from current view (client-side only)
    const card = document.querySelector(`[data-id="${imageId}"]`);
    if (card) {
        card.style.display = 'none';
    }
    showToast('Image hidden from feed');
}

// Attach context menu to all cards
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', (e) => {
        const card = e.target.closest('.grid-item');
        if (card && card.dataset.id) {
            showCardContextMenu(e, card.dataset.id);
        }
    });
});
