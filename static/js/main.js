// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadSavedTheme();
    initSidebar();
    setActiveNavItem();
    initThemeToggle();
    initNotificationDropdown();
    
    // Load notifications
    loadNotifications();
    
    // Auto-refresh notifications every 2 minutes (lebih aman)
    setInterval(loadNotifications, 120000);
    
    const firstTab = document.querySelector('.quality-tab');
    if (firstTab) {
        firstTab.click();
        firstTab.classList.add('active');
    }
    
    if ('IntersectionObserver' in window) {
        lazyLoadImages();
    }
});

/**
 * Load notifications from server
 */
async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications?limit=20');
        const result = await response.json();
        
        if (result.status === 'success') {
            const notifications = result.data.notifications;
            const unreadCount = result.data.unread_count;
            
            // Update notification list
            updateNotificationList(notifications);
            
            // Update badge
            updateNotificationBadge(unreadCount);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

/**
 * Update notification list UI
 */
function updateNotificationList(notifications) {
    const notificationList = document.querySelector('.notification-list');
    if (!notificationList) return;
    
    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <i class="fas fa-bell-slash" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No notifications</p>
            </div>
        `;
        return;
    }
    
    notificationList.innerHTML = notifications.map(notif => {
        const icon = getNotificationIcon(notif.type);
        const timeAgo = getTimeAgo(notif.created_at);
        const unreadClass = notif.is_read ? '' : 'unread';
        
        return `
            <div class="notification-item ${unreadClass}" data-id="${notif.id}" onclick="handleNotificationClick(${notif.id}, '${notif.link || ''}')">
                <div class="notification-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-text">${notif.message}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update notification badge
 */
function updateNotificationBadge(count) {
    const badge = document.querySelector('.notification-btn .badge');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Get icon based on notification type
 */
function getNotificationIcon(type) {
    const icons = {
        'new_episode': 'fas fa-plus-circle',
        'schedule': 'fas fa-calendar',
        'popular': 'fas fa-star',
        'recommendation': 'fas fa-heart'
    };
    return icons[type] || 'fas fa-bell';
}

/**
 * Calculate time ago
 */
function getTimeAgo(timestamp) {
    const now = new Date();
    const created = new Date(timestamp);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return created.toLocaleDateString();
}

/**
 * Handle notification click
 */
async function handleNotificationClick(notifId, link) {
    // Mark as read
    try {
        await fetch(`/api/notifications/${notifId}/read`, {
            method: 'POST'
        });
        
        // Reload notifications
        await loadNotifications();
        
        // Navigate if link exists
        if (link) {
            window.location.href = link;
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

/**
 * Load saved theme from localStorage
 */
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    const body = document.body;
    
    if (savedTheme === 'light') {
        body.classList.add('light-theme');
    } else {
        body.classList.remove('light-theme');
    }
}

/**
 * Initialize theme toggle functionality
 */
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    
    if (!themeToggle) return;
    
    updateThemeToggleUI();
    
    themeToggle.addEventListener('click', function() {
        const body = document.body;
        const isLightMode = body.classList.contains('light-theme');
        
        if (isLightMode) {
            body.classList.remove('light-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            body.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
        }
        
        updateThemeToggleUI();
        
        themeToggle.style.transform = 'scale(0.95)';
        setTimeout(() => {
            themeToggle.style.transform = 'scale(1)';
        }, 150);
    });
}

/**
 * Update theme toggle button UI
 */
function updateThemeToggleUI() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const icon = themeToggle.querySelector('.theme-toggle-content i');
    const text = themeToggle.querySelector('.theme-toggle-content span');
    const body = document.body;
    const isLightMode = body.classList.contains('light-theme');
    
    if (isLightMode) {
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
        if (text) {
            text.textContent = 'Light Mode';
        }
    } else {
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
        if (text) {
            text.textContent = 'Dark Mode';
        }
    }
}

/**
 * Initialize notification dropdown functionality
 */
function initNotificationDropdown() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationClose = document.getElementById('notificationClose');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    if (!notificationBtn || !notificationDropdown) return;
    
    notificationBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isActive = notificationDropdown.classList.contains('active');
        
        if (isActive) {
            notificationDropdown.classList.remove('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('active');
            }
        } else {
            notificationDropdown.classList.add('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.add('active');
            }
            
            // Reload notifications saat dibuka
            loadNotifications();
        }
    });
    
    if (notificationClose) {
        notificationClose.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationDropdown.classList.remove('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('active');
            }
        });
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            notificationDropdown.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    }
    
    document.addEventListener('click', function(e) {
        if (!notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
            notificationDropdown.classList.remove('active');
        }
    });
    
    // Clear all notifications
    const clearBtn = notificationDropdown.querySelector('.notification-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            try {
                await fetch('/api/notifications/clear', {
                    method: 'POST'
                });
                
                // Reload notifications
                await loadNotifications();
            } catch (error) {
                console.error('Error clearing notifications:', error);
            }
        });
    }
}

/**
 * Initialize sidebar functionality
 */
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
        }
        document.body.style.overflow = '';
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.toggle('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('active');
            }
            document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
        });
    }
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.remove('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('active');
            }
            document.body.style.overflow = '';
        });
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.remove('active');
                }
                document.body.style.overflow = '';
            }
        });
    });
    
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('active');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.remove('active');
                }
                document.body.style.overflow = '';
            }
        }, 250);
    });
}

/**
 * Set active navigation item based on current page
 */
function setActiveNavItem() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        
        if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
            item.classList.add('active');
        } else if (href === '/' && currentPath === '/') {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * Show server list for selected quality
 */
function showServers(quality) {
    document.querySelectorAll('[id^="servers-"]').forEach(el => {
        el.style.display = 'none';
    });
    
    document.querySelectorAll('.quality-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const serverList = document.getElementById('servers-' + quality);
    if (serverList) {
        serverList.style.display = 'grid';
    }
    
    event.target.classList.add('active');
}

/**
 * Change video server
 */
async function changeServer(serverId, serverName) {
    const videoPlayer = document.getElementById('videoPlayer');
    
    videoPlayer.innerHTML = `
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: var(--text-secondary);">
            <div style="font-size: 2.5rem; margin-bottom: 1rem;">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <div style="font-size: 1.1rem;">Loading ${serverName}...</div>
        </div>
    `;
    
    try {
        const response = await fetch('/api/server/' + serverId);
        const data = await response.json();
        
        if (data.status === 'success' && data.data.url) {
            videoPlayer.innerHTML = `
                <iframe src="${data.data.url}" 
                        allowfullscreen 
                        scrolling="no">
                </iframe>
            `;
        } else {
            videoPlayer.innerHTML = `
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #ef4444;">
                    <div style="font-size: 2.5rem; margin-bottom: 1rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div style="font-size: 1.1rem;">Error loading server</div>
                    <div style="font-size: 0.9rem; margin-top: 0.5rem; opacity: 0.8;">Please try another server</div>
                </div>
            `;
        }
    } catch (error) {
        videoPlayer.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #ef4444;">
                <div style="font-size: 2.5rem; margin-bottom: 1rem;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div style="font-size: 1.1rem;">Network Error</div>
                <div style="font-size: 0.9rem; margin-top: 0.5rem; opacity: 0.8;">${error.message}</div>
            </div>
        `;
    }
}

function goToAnime(animeId) {
    window.location.href = '/anime/' + animeId;
}

function goToEpisode(episodeId) {
    window.location.href = '/episode/' + episodeId;
}

function goToGenre(genreId) {
    window.location.href = '/genre/' + genreId;
}

function searchAnime(event) {
    event.preventDefault();
    const keyword = document.querySelector('.search-input').value;
    if (keyword.trim()) {
        window.location.href = '/search?q=' + encodeURIComponent(keyword);
    }
}

function lazyLoadImages() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src || img.src;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px'
    });
    
    images.forEach(img => imageObserver.observe(img));
}

window.addEventListener('scroll', function() {
    const scrollButton = document.getElementById('scrollToTop');
    if (scrollButton) {
        if (window.pageYOffset > 300) {
            scrollButton.classList.add('show');
        } else {
            scrollButton.classList.remove('show');
        }
    }
});

const animateOnScroll = () => {
    const elements = document.querySelectorAll('.anime-card, .section-title');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1
    });
    
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.5s ease-out';
        observer.observe(el);
    });
};

if ('IntersectionObserver' in window) {
    document.addEventListener('DOMContentLoaded', animateOnScroll);
}