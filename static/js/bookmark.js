/**
 * AnimeStream Bookmark System - Client-side with localStorage
 * Compatible with Vercel deployment (no backend database)
 */

// Namespace untuk bookmark functions
window.DayystreamBookmarks = {
    STORAGE_KEY: 'animestream_bookmarks',
    
    /**
     * Get all bookmarks from localStorage
     */
    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading bookmarks:', error);
            return [];
        }
    },
    
    /**
     * Save bookmarks to localStorage
     */
    saveAll(bookmarks) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookmarks));
            return true;
        } catch (error) {
            console.error('Error saving bookmarks:', error);
            return false;
        }
    },
    
    /**
     * Add bookmark
     */
    add(animeData) {
        const bookmarks = this.getAll();
        
        // Check if already exists
        const exists = bookmarks.some(b => b.animeId === animeData.animeId);
        if (exists) {
            return { success: false, message: 'Already bookmarked' };
        }
        
        // Add timestamp
        animeData.addedAt = new Date().toISOString();
        
        bookmarks.push(animeData);
        
        if (this.saveAll(bookmarks)) {
            this.updateCount();
            return { success: true, message: 'Added to bookmarks' };
        }
        
        return { success: false, message: 'Failed to save' };
    },
    
    /**
     * Remove bookmark
     */
    remove(animeId) {
        const bookmarks = this.getAll();
        const filtered = bookmarks.filter(b => b.animeId !== animeId);
        
        if (this.saveAll(filtered)) {
            this.updateCount();
            return { success: true, message: 'Removed from bookmarks' };
        }
        
        return { success: false, message: 'Failed to remove' };
    },
    
    /**
     * Toggle bookmark
     */
    toggle(animeData) {
        const bookmarks = this.getAll();
        const exists = bookmarks.some(b => b.animeId === animeData.animeId);
        
        if (exists) {
            return this.remove(animeData.animeId);
        } else {
            return this.add(animeData);
        }
    },
    
    /**
     * Check if anime is bookmarked
     */
    isBookmarked(animeId) {
        const bookmarks = this.getAll();
        return bookmarks.some(b => b.animeId === animeId);
    },
    
    /**
     * Clear all bookmarks
     */
    clearAll() {
        showConfirmDialog(
            'Clear All Bookmarks?',
            'This will remove all your saved anime. This action cannot be undone.',
            'danger',
            () => {
                if (this.saveAll([])) {
                    this.updateCount();
                    // Reload page to show empty state
                    window.location.reload();
                    showToast('All bookmarks cleared', 'success');
                } else {
                    showToast('Failed to clear bookmarks', 'error');
                }
            }
        );
    },
    
    /**
     * Update bookmark count in sidebar
     */
    updateCount() {
        const count = this.getAll().length;
        const badge = document.getElementById('sidebarBookmarkCount');
        const countElement = document.getElementById('bookmarkCount');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
        
        if (countElement) {
            countElement.textContent = count;
        }
    },
    
    /**
     * Search bookmarks
     */
    search(keyword) {
        const bookmarks = this.getAll();
        
        if (!keyword) return bookmarks;
        
        const lowerKeyword = keyword.toLowerCase();
        return bookmarks.filter(anime => 
            anime.title.toLowerCase().includes(lowerKeyword) ||
            (anime.status && anime.status.toLowerCase().includes(lowerKeyword)) ||
            (anime.type && anime.type.toLowerCase().includes(lowerKeyword))
        );
    },
    
    /**
     * Sort bookmarks
     */
    sort(bookmarks, sortBy) {
        const sorted = [...bookmarks];
        
        switch(sortBy) {
            case 'newest':
                return sorted.sort((a, b) => 
                    new Date(b.addedAt) - new Date(a.addedAt)
                );
            case 'oldest':
                return sorted.sort((a, b) => 
                    new Date(a.addedAt) - new Date(b.addedAt)
                );
            case 'title':
                return sorted.sort((a, b) => 
                    a.title.localeCompare(b.title)
                );
            case 'title-desc':
                return sorted.sort((a, b) => 
                    b.title.localeCompare(a.title)
                );
            default:
                return sorted;
        }
    },
    
    /**
     * Render bookmarks to grid
     */
    renderBookmarks(bookmarks) {
        const grid = document.getElementById('bookmarkGrid');
        const emptyState = document.getElementById('emptyState');
        const noResults = document.getElementById('noResults');
        
        if (!grid) return;
        
        // Hide all states first
        if (emptyState) emptyState.style.display = 'none';
        if (noResults) noResults.style.display = 'none';
        
        if (bookmarks.length === 0) {
            grid.innerHTML = '';
            
            // Check if it's search result or truly empty
            const searchInput = document.getElementById('searchBookmark');
            if (searchInput && searchInput.value) {
                if (noResults) noResults.style.display = 'block';
            } else {
                if (emptyState) emptyState.style.display = 'block';
            }
            return;
        }
        
        grid.innerHTML = bookmarks.map(anime => `
            <div class="bookmark-item">
                <a href="/anime/${anime.animeId}" class="card-link">
                    <div class="anime-card">
                        <div class="anime-poster">
                            <img src="${anime.poster}" alt="${anime.title}" loading="lazy">
                        </div>
                        <div class="anime-info">
                            <div class="anime-title">${anime.title}</div>
                            <div class="anime-meta">
                                ${anime.score ? `
                                    <span class="meta-item">
                                        <i class="fas fa-star"></i>
                                        ${anime.score}
                                    </span>
                                ` : ''}
                                ${anime.type ? `
                                    <span class="meta-item">
                                        <i class="fas fa-tv"></i>
                                        ${anime.type}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </a>
                <button class="remove-bookmark-btn" onclick="window.DayystreamBookmarks.removeWithConfirm('${anime.animeId}', '${anime.title.replace(/'/g, "\\'")}')" title="Remove from bookmarks">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    },
    
    /**
     * Remove bookmark with confirmation
     */
    removeWithConfirm(animeId, animeTitle) {
        showConfirmDialog(
            'Remove Bookmark?',
            `Remove "${animeTitle}" from your bookmarks?`,
            'warning',
            () => {
                const result = this.remove(animeId);
                if (result.success) {
                    showToast('Bookmark removed', 'success');
                    // Re-render the page
                    this.renderBookmarksPage();
                } else {
                    showToast('Failed to remove bookmark', 'error');
                }
            }
        );
    },
    
    /**
     * Initialize bookmarks page
     */
    initBookmarksPage() {
        const searchInput = document.getElementById('searchBookmark');
        const sortSelect = document.getElementById('sortBookmark');
        
        // Initial render
        this.renderBookmarksPage();
        
        // Search functionality
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.renderBookmarksPage();
            });
        }
        
        // Sort functionality
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.renderBookmarksPage();
            });
        }
        
        // Update count
        this.updateCount();
    },
    
    /**
     * Render bookmarks page with search and sort
     */
    renderBookmarksPage() {
        const searchInput = document.getElementById('searchBookmark');
        const sortSelect = document.getElementById('sortBookmark');
        
        let bookmarks = this.getAll();
        
        // Apply search
        if (searchInput && searchInput.value) {
            bookmarks = this.search(searchInput.value);
        }
        
        // Apply sort
        if (sortSelect) {
            bookmarks = this.sort(bookmarks, sortSelect.value);
        }
        
        this.renderBookmarks(bookmarks);
    }
};

/**
 * Toggle bookmark from detail page - GUNAKAN ONCLICK
 */
function toggleBookmark() {
    console.log('toggleBookmark called!'); // Debug
    
    const bookmarkBtn = document.getElementById('bookmarkBtn');
    const bookmarkIcon = document.getElementById('bookmarkIcon');
    const bookmarkText = document.getElementById('bookmarkText');
    
    console.log('Button:', bookmarkBtn); // Debug
    console.log('Window animeData:', window.animeData); // Debug
    
    if (!bookmarkBtn) {
        console.error('Bookmark button not found!');
        return;
    }
    
    // Get anime data from window.animeData (set in detail.html)
    const animeData = window.animeData;
    
    if (!animeData || !animeData.animeId) {
        console.error('Anime data not found or invalid:', animeData);
        showToast('Error: Anime data not found', 'error');
        return;
    }
    
    console.log('Processing bookmark for:', animeData.title);
    
    // Disable button
    bookmarkBtn.disabled = true;
    
    try {
        const result = window.DayystreamBookmarks.toggle(animeData);
        console.log('Toggle result:', result);
        
        if (result.success) {
            const isBookmarked = window.DayystreamBookmarks.isBookmarked(animeData.animeId);
            console.log('Is bookmarked:', isBookmarked);
            
            // Update button UI
            if (isBookmarked) {
                bookmarkBtn.classList.add('bookmarked');
                if (bookmarkIcon) {
                    bookmarkIcon.classList.remove('far');
                    bookmarkIcon.classList.add('fas');
                }
                if (bookmarkText) {
                    bookmarkText.textContent = 'Bookmarked';
                }
                showToast('Added to bookmarks!', 'success');
            } else {
                bookmarkBtn.classList.remove('bookmarked');
                if (bookmarkIcon) {
                    bookmarkIcon.classList.remove('fas');
                    bookmarkIcon.classList.add('far');
                }
                if (bookmarkText) {
                    bookmarkText.textContent = 'Bookmark';
                }
                showToast('Removed from bookmarks', 'success');
            }
        } else {
            console.error('Toggle failed:', result.message);
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error('Error toggling bookmark:', error);
        showToast('Error updating bookmark', 'error');
    } finally {
        bookmarkBtn.disabled = false;
    }
}

/**
 * Check bookmark status on detail page
 */
function checkBookmarkStatus() {
    console.log('Checking bookmark status...');
    
    const animeData = window.animeData;
    
    if (!animeData || !animeData.animeId) {
        console.log('No anime data found for bookmark check');
        return;
    }
    
    console.log('Checking for anime:', animeData.animeId);
    
    const bookmarkBtn = document.getElementById('bookmarkBtn');
    const bookmarkIcon = document.getElementById('bookmarkIcon');
    const bookmarkText = document.getElementById('bookmarkText');
    
    const isBookmarked = window.DayystreamBookmarks.isBookmarked(animeData.animeId);
    console.log('Current bookmark status:', isBookmarked);
    
    if (bookmarkBtn) {
        if (isBookmarked) {
            bookmarkBtn.classList.add('bookmarked');
            if (bookmarkIcon) {
                bookmarkIcon.classList.remove('far');
                bookmarkIcon.classList.add('fas');
            }
            if (bookmarkText) {
                bookmarkText.textContent = 'Bookmarked';
            }
        } else {
            bookmarkBtn.classList.remove('bookmarked');
            if (bookmarkIcon) {
                bookmarkIcon.classList.remove('fas');
                bookmarkIcon.classList.add('far');
            }
            if (bookmarkText) {
                bookmarkText.textContent = 'Bookmark';
            }
        }
    }
}

/**
 * Show confirmation dialog
 */
function showConfirmDialog(title, message, type = 'warning', onConfirm) {
    const existingDialog = document.querySelector('.confirm-dialog-overlay');
    if (existingDialog) existingDialog.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    
    const icons = {
        warning: 'fa-exclamation-triangle',
        danger: 'fa-times-circle',
        info: 'fa-info-circle'
    };
    
    const colors = {
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6'
    };
    
    overlay.innerHTML = `
        <div class="confirm-dialog">
            <div class="confirm-dialog-icon" style="color: ${colors[type]}">
                <i class="fas ${icons[type]}"></i>
            </div>
            <h3 class="confirm-dialog-title">${title}</h3>
            <p class="confirm-dialog-message">${message}</p>
            <div class="confirm-dialog-actions">
                <button class="confirm-btn-cancel" id="confirmCancel">
                    <i class="fas fa-times"></i>
                    Cancel
                </button>
                <button class="confirm-btn-confirm" id="confirmOk" style="background: ${colors[type]}">
                    <i class="fas fa-check"></i>
                    Confirm
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    setTimeout(() => overlay.classList.add('show'), 10);
    
    const closeDialog = () => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
    };
    
    overlay.querySelector('#confirmCancel').addEventListener('click', closeDialog);
    overlay.querySelector('#confirmOk').addEventListener('click', () => {
        closeDialog();
        if (onConfirm) onConfirm();
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDialog();
    });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 'info-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    const styles = {
        position: 'fixed',
        top: '100px',
        right: '20px',
        padding: '1rem 1.5rem',
        background: type === 'success' ? '#22c55e' : 
                   type === 'error' ? '#ef4444' : 
                   '#3b82f6',
        color: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontWeight: '600',
        fontSize: '0.95rem',
        zIndex: '10000',
        animation: 'slideInRight 0.3s ease',
        minWidth: '250px'
    };
    
    Object.assign(toast.style, styles);
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add CSS animations
if (!document.getElementById('bookmark-styles')) {
    const style = document.createElement('style');
    style.id = 'bookmark-styles';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
        
        .confirm-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.3s ease;
            padding: 1rem;
        }
        
        .confirm-dialog-overlay.show {
            opacity: 1;
        }
        
        .confirm-dialog-overlay.show .confirm-dialog {
            transform: scale(1);
            opacity: 1;
        }
        
        .confirm-dialog {
            background: var(--bg-card, #1a1a2e);
            border-radius: 20px;
            padding: 2rem;
            max-width: 450px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transform: scale(0.9);
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .confirm-dialog-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: rgba(245, 158, 11, 0.1);
            border: 3px solid currentColor;
        }
        
        .confirm-dialog-icon i {
            font-size: 2.5rem;
        }
        
        .confirm-dialog-title {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text-primary, #fff);
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .confirm-dialog-message {
            font-size: 1rem;
            color: var(--text-secondary, #aaa);
            text-align: center;
            line-height: 1.6;
            margin-bottom: 2rem;
        }
        
        .confirm-dialog-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        
        .confirm-btn-cancel,
        .confirm-btn-confirm {
            padding: 1rem 1.5rem;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        
        .confirm-btn-cancel {
            background: var(--bg-secondary, #16213e);
            color: var(--text-primary, #fff);
            border: 2px solid rgba(255, 255, 255, 0.1);
        }
        
        .confirm-btn-cancel:hover {
            border-color: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        
        .confirm-btn-confirm {
            color: white;
            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
        }
        
        .confirm-btn-confirm:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
        }
        
        /* Bookmark Item Wrapper */
        .bookmark-item {
            position: relative;
        }
        
        .bookmark-item .card-link {
            display: block;
        }
        
        .remove-bookmark-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.9);
            border: none;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0;
            transform: scale(0.8);
            transition: all 0.3s ease;
            z-index: 10;
            backdrop-filter: blur(10px);
        }
        
        .bookmark-item:hover .remove-bookmark-btn {
            opacity: 1;
            transform: scale(1);
        }
        
        .remove-bookmark-btn:hover {
            background: rgba(239, 68, 68, 1);
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
        }
        
        .remove-bookmark-btn:active {
            transform: scale(0.95);
        }
        
        .remove-bookmark-btn i {
            font-size: 14px;
        }
        
        @media (max-width: 768px) {
            /* Always show remove button on mobile */
            .remove-bookmark-btn {
                opacity: 1;
                transform: scale(1);
            }
        }
    `;
    document.head.appendChild(style);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Bookmark system initialized!');
    
    // Update sidebar count on all pages
    window.DayystreamBookmarks.updateCount();
    
    // Check if we're on bookmark page
    if (window.location.pathname === '/bookmarks') {
        console.log('On bookmarks page - initializing...');
        window.DayystreamBookmarks.initBookmarksPage();
    }
    
    // Check if we're on detail page
    if (window.animeData) {
        console.log('On detail page - checking bookmark status...');
        checkBookmarkStatus();
        
        // Add click event listener to bookmark button
        const bookmarkBtn = document.getElementById('bookmarkBtn');
        if (bookmarkBtn) {
            console.log('Adding click listener to bookmark button');
            bookmarkBtn.addEventListener('click', toggleBookmark);
        } else {
            console.error('Bookmark button not found!');
        }
    }
});