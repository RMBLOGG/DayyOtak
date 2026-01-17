/**
 * Bookmark Helper Functions
 * Add this script to anime detail pages to enable bookmark functionality
 */

/**
 * Toggle bookmark for current anime
 * Usage: Add this button to your detail page:
 * <button class="bookmark-btn" id="bookmarkBtn" onclick="toggleBookmark()">
 *     <i class="fas fa-bookmark"></i>
 *     <span id="bookmarkText">Add to Bookmarks</span>
 * </button>
 */
async function toggleBookmark() {
    const bookmarkBtn = document.getElementById('bookmarkBtn');
    const bookmarkText = document.getElementById('bookmarkText');
    
    if (!bookmarkBtn) return;
    
    // Get anime data from page (adjust selectors based on your HTML)
    const animeId = getAnimeId();
    const animeData = getAnimeData();
    
    if (!animeId) {
        showToast('Error: Anime ID not found', 'error');
        return;
    }
    
    // Disable button during request
    bookmarkBtn.disabled = true;
    
    try {
        const response = await fetch('/api/bookmarks/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                anime_id: animeId,
                title: animeData.title,
                poster: animeData.poster,
                status: animeData.status,
                rating: animeData.rating,
                total_episode: animeData.total_episode
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            const isAdded = result.action === 'added';
            
            // Update button UI
            updateBookmarkButton(bookmarkBtn, isAdded);
            
            // Update text
            if (bookmarkText) {
                bookmarkText.textContent = isAdded ? 'Remove from Bookmarks' : 'Add to Bookmarks';
            }
            
            // Show toast notification
            showToast(
                isAdded ? 'Added to bookmarks!' : 'Removed from bookmarks',
                'success'
            );
            
            // Update sidebar count
            updateBookmarkCount();
        } else {
            showToast('Failed to update bookmark', 'error');
        }
    } catch (error) {
        console.error('Error toggling bookmark:', error);
        showToast('Error updating bookmark', 'error');
    } finally {
        bookmarkBtn.disabled = false;
    }
}

/**
 * Check if current anime is bookmarked
 */
async function checkBookmarkStatus() {
    const animeId = getAnimeId();
    if (!animeId) return;
    
    try {
        const response = await fetch(`/api/bookmarks/check/${animeId}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            const bookmarkBtn = document.getElementById('bookmarkBtn');
            const bookmarkText = document.getElementById('bookmarkText');
            
            if (bookmarkBtn) {
                updateBookmarkButton(bookmarkBtn, result.data.is_bookmarked);
            }
            
            if (bookmarkText) {
                bookmarkText.textContent = result.data.is_bookmarked 
                    ? 'Remove from Bookmarks' 
                    : 'Add to Bookmarks';
            }
        }
    } catch (error) {
        console.error('Error checking bookmark status:', error);
    }
}

/**
 * Update bookmark button appearance
 */
function updateBookmarkButton(button, isBookmarked) {
    if (isBookmarked) {
        button.classList.add('bookmarked');
    } else {
        button.classList.remove('bookmarked');
    }
    
    // Update icon
    const icon = button.querySelector('i');
    if (icon) {
        if (isBookmarked) {
            icon.classList.remove('far');
            icon.classList.add('fas');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
        }
    }
}

/**
 * Get anime ID from current page
 * Adjust this based on your page structure
 */
function getAnimeId() {
    // Try to get from URL
    const pathParts = window.location.pathname.split('/');
    const animeIndex = pathParts.indexOf('anime');
    
    if (animeIndex !== -1 && pathParts[animeIndex + 1]) {
        return pathParts[animeIndex + 1];
    }
    
    // Try to get from data attribute
    const detailContainer = document.querySelector('[data-anime-id]');
    if (detailContainer) {
        return detailContainer.getAttribute('data-anime-id');
    }
    
    return null;
}

/**
 * Get anime data from current page
 * Disesuaikan dengan struktur detail.html
 */
function getAnimeData() {
    return {
        title: getTextContent('.anime-title') || getTextContent('.detail-title') || document.title,
        poster: getImageSrc('.anime-poster') || getImageSrc('.detail-poster img') || null,
        status: getTextContent('.anime-status') || null,
        rating: getTextContent('.anime-rating') || null,
        total_episode: getTextContent('.anime-episodes') || null
    };
}

/**
 * Helper: Get text content from selector
 */
function getTextContent(selector) {
    const element = document.querySelector(selector);
    return element ? element.textContent.trim() : null;
}

/**
 * Helper: Get image src from selector
 */
function getImageSrc(selector) {
    const element = document.querySelector(selector);
    return element ? element.src : null;
}

/**
 * Update bookmark count in sidebar
 */
async function updateBookmarkCount() {
    try {
        const response = await fetch('/api/bookmarks');
        const result = await response.json();
        
        if (result.status === 'success') {
            const count = result.data.count;
            const badge = document.getElementById('sidebarBookmarkCount');
            
            if (badge) {
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error updating bookmark count:', error);
    }
}

/**
 * Show custom confirmation dialog
 */
function showConfirmDialog(title, message, type = 'warning', onConfirm) {
    // Remove existing dialogs
    const existingDialog = document.querySelector('.confirm-dialog-overlay');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    
    // Icon based on type
    const icons = {
        warning: 'fa-exclamation-triangle',
        danger: 'fa-times-circle',
        info: 'fa-info-circle',
        question: 'fa-question-circle'
    };
    
    const colors = {
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        question: '#8b5cf6'
    };
    
    overlay.innerHTML = `
        <div class="confirm-dialog">
            <div class="confirm-dialog-icon" style="color: ${colors[type] || colors.warning}">
                <i class="fas ${icons[type] || icons.warning}"></i>
            </div>
            <h3 class="confirm-dialog-title">${title}</h3>
            <p class="confirm-dialog-message">${message}</p>
            <div class="confirm-dialog-actions">
                <button class="confirm-btn-cancel" id="confirmCancel">
                    <i class="fas fa-times"></i>
                    Cancel
                </button>
                <button class="confirm-btn-confirm" id="confirmOk" style="background: ${colors[type] || colors.warning}">
                    <i class="fas fa-check"></i>
                    Confirm
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Add show animation
    setTimeout(() => {
        overlay.classList.add('show');
    }, 10);
    
    // Event listeners
    const cancelBtn = overlay.querySelector('#confirmCancel');
    const confirmBtn = overlay.querySelector('#confirmOk');
    
    const closeDialog = () => {
        overlay.classList.remove('show');
        setTimeout(() => {
            overlay.remove();
        }, 300);
    };
    
    cancelBtn.addEventListener('click', closeDialog);
    
    confirmBtn.addEventListener('click', () => {
        closeDialog();
        if (onConfirm) {
            onConfirm();
        }
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeDialog();
        }
    });
    
    // Close on ESC key
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(toast => toast.remove());
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 'info-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    // Add styles
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
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Add CSS animations
if (!document.getElementById('bookmark-animations')) {
    const style = document.createElement('style');
    style.id = 'bookmark-animations';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
        
        .bookmark-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .bookmark-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: var(--primary-color);
            transform: translateY(-2px);
        }
        
        .bookmark-btn.bookmarked {
            background: var(--primary-color);
            border-color: var(--primary-color);
        }
        
        .bookmark-btn.bookmarked:hover {
            background: var(--primary-hover);
        }
        
        .bookmark-btn i {
            font-size: 1.1rem;
        }
        
        .bookmark-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .nav-badge {
            display: none;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            background: var(--primary-color);
            color: white;
            border-radius: 10px;
            font-size: 0.7rem;
            font-weight: 700;
            margin-left: auto;
        }
        
        /* Confirmation Dialog Styles */
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
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        
        .confirm-dialog {
            background: var(--bg-card);
            border-radius: 20px;
            padding: 2rem;
            max-width: 450px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border: 1px solid var(--border-color);
            transform: scale(0.9) translateY(20px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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
            animation: iconPulse 2s ease infinite;
        }
        
        @keyframes iconPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        .confirm-dialog-title {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text-primary);
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .confirm-dialog-message {
            font-size: 1rem;
            color: var(--text-secondary);
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
            background: var(--bg-secondary);
            color: var(--text-primary);
            border: 2px solid var(--border-color);
        }
        
        .confirm-btn-cancel:hover {
            background: var(--hover-bg);
            border-color: var(--text-secondary);
            transform: translateY(-2px);
        }
        
        .confirm-btn-confirm {
            background: #f59e0b;
            color: white;
            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
        }
        
        .confirm-btn-confirm:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
        }
        
        .confirm-btn-confirm:active,
        .confirm-btn-cancel:active {
            transform: translateY(0);
        }
        
        @media (max-width: 480px) {
            .confirm-dialog {
                padding: 1.5rem;
            }
            
            .confirm-dialog-icon {
                width: 60px;
                height: 60px;
            }
            
            .confirm-dialog-icon i {
                font-size: 2rem;
            }
            
            .confirm-dialog-title {
                font-size: 1.4rem;
            }
            
            .confirm-dialog-message {
                font-size: 0.9rem;
            }
            
            .confirm-dialog-actions {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(style);
}

// Auto-check bookmark status on page load
document.addEventListener('DOMContentLoaded', function() {
    checkBookmarkStatus();
});