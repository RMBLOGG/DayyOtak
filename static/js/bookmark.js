/**
 * DAYYdesu Bookmark System
 * Terintegrasi dengan Google Login + Supabase
 * Fallback ke localStorage jika belum login
 */

window.DayystreamBookmarks = {

    // ── Cek apakah user sudah login ──
    async isLoggedIn() {
        try {
            const res  = await fetch('/api/me');
            const data = await res.json();
            return data.status === 'success';
        } catch(e) {
            return false;
        }
    },

    // ══════════════════════════════════════════
    // API (Supabase) — dipakai jika sudah login
    // ══════════════════════════════════════════

    async apiGetAll() {
        const res  = await fetch('/api/bookmarks');
        const data = await res.json();
        if (data.status === 'success') {
            // Normalkan field agar sama dengan format localStorage
            return (data.data || []).map(b => ({
                animeId : b.anime_id,
                title   : b.anime_title,
                poster  : b.poster,
                score   : b.score   || '',
                type    : b.type    || '',
                status  : b.status  || '',
                addedAt : b.added_at || b.addedAt || new Date().toISOString()
            }));
        }
        return [];
    },

    async apiAdd(animeData) {
        const res  = await fetch('/api/bookmarks/add', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
                anime_id   : animeData.animeId,
                anime_title: animeData.title,
                poster     : animeData.poster,
                score      : animeData.score  || '',
                type       : animeData.type   || '',
                status     : animeData.status || ''
            })
        });
        const data = await res.json();
        return data.status === 'success'
            ? { success: true,  message: 'Added to bookmarks' }
            : { success: false, message: data.message || 'Failed to add' };
    },

    async apiRemove(animeId) {
        const res  = await fetch('/api/bookmarks/remove', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ anime_id: animeId })
        });
        const data = await res.json();
        return data.status === 'success'
            ? { success: true,  message: 'Removed from bookmarks' }
            : { success: false, message: data.message || 'Failed to remove' };
    },

    async apiIsBookmarked(animeId) {
        const all = await this.apiGetAll();
        return all.some(b => b.animeId === animeId);
    },

    // ══════════════════════════════════════════
    // localStorage — fallback jika belum login
    // ══════════════════════════════════════════

    STORAGE_KEY: 'animestream_bookmarks',

    localGetAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch(e) { return []; }
    },

    localSaveAll(bookmarks) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookmarks));
            return true;
        } catch(e) { return false; }
    },

    localAdd(animeData) {
        const bookmarks = this.localGetAll();
        if (bookmarks.some(b => b.animeId === animeData.animeId)) {
            return { success: false, message: 'Already bookmarked' };
        }
        animeData.addedAt = new Date().toISOString();
        bookmarks.push(animeData);
        return this.localSaveAll(bookmarks)
            ? { success: true,  message: 'Added to bookmarks' }
            : { success: false, message: 'Failed to save' };
    },

    localRemove(animeId) {
        const filtered = this.localGetAll().filter(b => b.animeId !== animeId);
        return this.localSaveAll(filtered)
            ? { success: true,  message: 'Removed from bookmarks' }
            : { success: false, message: 'Failed to remove' };
    },

    // ══════════════════════════════════════════
    // Public API — otomatis pilih Supabase/local
    // ══════════════════════════════════════════

    async getAll() {
        if (await this.isLoggedIn()) return await this.apiGetAll();
        return this.localGetAll();
    },

    async add(animeData) {
        if (await this.isLoggedIn()) {
            const result = await this.apiAdd(animeData);
            if (result.success) await this.updateCount();
            return result;
        }
        const result = this.localAdd(animeData);
        if (result.success) await this.updateCount();
        return result;
    },

    async remove(animeId) {
        if (await this.isLoggedIn()) {
            const result = await this.apiRemove(animeId);
            if (result.success) await this.updateCount();
            return result;
        }
        const result = this.localRemove(animeId);
        if (result.success) await this.updateCount();
        return result;
    },

    async toggle(animeData) {
        const bookmarked = await this.isBookmarked(animeData.animeId);
        return bookmarked
            ? await this.remove(animeData.animeId)
            : await this.add(animeData);
    },

    async isBookmarked(animeId) {
        if (await this.isLoggedIn()) return await this.apiIsBookmarked(animeId);
        return this.localGetAll().some(b => b.animeId === animeId);
    },

    async clearAll() {
        showConfirmDialog(
            'Hapus Semua Bookmark?',
            'Semua anime yang disimpan akan dihapus. Tindakan ini tidak dapat dibatalkan.',
            'danger',
            async () => {
                const loggedIn = await this.isLoggedIn();
                if (loggedIn) {
                    // Hapus semua via API satu per satu
                    const all = await this.apiGetAll();
                    await Promise.all(all.map(b => this.apiRemove(b.animeId)));
                } else {
                    this.localSaveAll([]);
                }
                await this.updateCount();
                window.location.reload();
                showToast('Semua bookmark dihapus', 'success');
            }
        );
    },

    async updateCount() {
        const bookmarks = await this.getAll();
        const count     = bookmarks.length;
        const badge     = document.getElementById('sidebarBookmarkCount');
        const countEl   = document.getElementById('bookmarkCount');
        if (badge) {
            badge.textContent    = count > 99 ? '99+' : count;
            badge.style.display  = count > 0 ? 'flex' : 'none';
        }
        if (countEl) countEl.textContent = count;
    },

    search(bookmarks, keyword) {
        if (!keyword) return bookmarks;
        const kw = keyword.toLowerCase();
        return bookmarks.filter(a =>
            a.title?.toLowerCase().includes(kw) ||
            a.status?.toLowerCase().includes(kw) ||
            a.type?.toLowerCase().includes(kw)
        );
    },

    sort(bookmarks, sortBy) {
        const sorted = [...bookmarks];
        switch(sortBy) {
            case 'newest'    : return sorted.sort((a,b) => new Date(b.addedAt) - new Date(a.addedAt));
            case 'oldest'    : return sorted.sort((a,b) => new Date(a.addedAt) - new Date(b.addedAt));
            case 'title'     : return sorted.sort((a,b) => a.title.localeCompare(b.title));
            case 'title-desc': return sorted.sort((a,b) => b.title.localeCompare(a.title));
            default          : return sorted;
        }
    },

    renderBookmarks(bookmarks) {
        const grid       = document.getElementById('bookmarkGrid');
        const emptyState = document.getElementById('emptyState');
        const noResults  = document.getElementById('noResults');
        if (!grid) return;
        if (emptyState) emptyState.style.display = 'none';
        if (noResults)  noResults.style.display  = 'none';
        if (bookmarks.length === 0) {
            grid.innerHTML = '';
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
                                ${anime.score ? `<span class="meta-item"><i class="fas fa-star"></i>${anime.score}</span>` : ''}
                                ${anime.type  ? `<span class="meta-item"><i class="fas fa-tv"></i>${anime.type}</span>`   : ''}
                            </div>
                        </div>
                    </div>
                </a>
                <button class="remove-bookmark-btn"
                    onclick="window.DayystreamBookmarks.removeWithConfirm('${anime.animeId}', '${(anime.title||'').replace(/'/g,"\\'")}')"
                    title="Hapus bookmark">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    },

    async removeWithConfirm(animeId, animeTitle) {
        showConfirmDialog(
            'Hapus Bookmark?',
            `Hapus "${animeTitle}" dari bookmark kamu?`,
            'warning',
            async () => {
                const result = await this.remove(animeId);
                if (result.success) {
                    showToast('Bookmark dihapus', 'success');
                    await this.renderBookmarksPage();
                } else {
                    showToast('Gagal menghapus bookmark', 'error');
                }
            }
        );
    },

    async initBookmarksPage() {
        const searchInput = document.getElementById('searchBookmark');
        const sortSelect  = document.getElementById('sortBookmark');
        await this.renderBookmarksPage();
        if (searchInput) searchInput.addEventListener('input', () => this.renderBookmarksPage());
        if (sortSelect)  sortSelect.addEventListener('change', () => this.renderBookmarksPage());
        await this.updateCount();
    },

    async renderBookmarksPage() {
        const searchInput = document.getElementById('searchBookmark');
        const sortSelect  = document.getElementById('sortBookmark');
        let bookmarks = await this.getAll();
        if (searchInput && searchInput.value) bookmarks = this.search(bookmarks, searchInput.value);
        if (sortSelect) bookmarks = this.sort(bookmarks, sortSelect.value);
        this.renderBookmarks(bookmarks);
    }
};

// ══════════════════════════════════════════
// Toggle bookmark dari detail page
// ══════════════════════════════════════════
async function toggleBookmark() {
    const bookmarkBtn  = document.getElementById('bookmarkBtn');
    const bookmarkIcon = document.getElementById('bookmarkIcon');
    const bookmarkText = document.getElementById('bookmarkText');
    const animeData    = window.animeData;

    if (!animeData || !animeData.animeId) {
        showToast('Error: data anime tidak ditemukan', 'error');
        return;
    }

    // Cek login dulu
    const loggedIn = await window.DayystreamBookmarks.isLoggedIn();
    if (!loggedIn) {
        showConfirmDialog(
            'Login Diperlukan',
            'Login dengan Google agar bookmark tersimpan di semua perangkat.',
            'info',
            () => { window.location.href = '/login'; }
        );
        return;
    }

    if (bookmarkBtn) bookmarkBtn.disabled = true;

    try {
        const result = await window.DayystreamBookmarks.toggle(animeData);
        if (result.success) {
            const isBookmarked = await window.DayystreamBookmarks.isBookmarked(animeData.animeId);
            if (isBookmarked) {
                bookmarkBtn?.classList.add('bookmarked');
                if (bookmarkIcon) { bookmarkIcon.classList.remove('far'); bookmarkIcon.classList.add('fas'); }
                if (bookmarkText) bookmarkText.textContent = 'Bookmarked';
                showToast('Ditambahkan ke bookmark!', 'success');
            } else {
                bookmarkBtn?.classList.remove('bookmarked');
                if (bookmarkIcon) { bookmarkIcon.classList.remove('fas'); bookmarkIcon.classList.add('far'); }
                if (bookmarkText) bookmarkText.textContent = 'Bookmark';
                showToast('Dihapus dari bookmark', 'success');
            }
        } else {
            showToast(result.message || 'Gagal update bookmark', 'error');
        }
    } catch(e) {
        showToast('Error: ' + e.message, 'error');
    } finally {
        if (bookmarkBtn) bookmarkBtn.disabled = false;
    }
}

// ══════════════════════════════════════════
// Cek status bookmark di detail page
// ══════════════════════════════════════════
async function checkBookmarkStatus() {
    const animeData = window.animeData;
    if (!animeData || !animeData.animeId) return;

    const bookmarkBtn  = document.getElementById('bookmarkBtn');
    const bookmarkIcon = document.getElementById('bookmarkIcon');
    const bookmarkText = document.getElementById('bookmarkText');

    const isBookmarked = await window.DayystreamBookmarks.isBookmarked(animeData.animeId);
    if (bookmarkBtn) {
        if (isBookmarked) {
            bookmarkBtn.classList.add('bookmarked');
            if (bookmarkIcon) { bookmarkIcon.classList.remove('far'); bookmarkIcon.classList.add('fas'); }
            if (bookmarkText) bookmarkText.textContent = 'Bookmarked';
        } else {
            bookmarkBtn.classList.remove('bookmarked');
            if (bookmarkIcon) { bookmarkIcon.classList.remove('fas'); bookmarkIcon.classList.add('far'); }
            if (bookmarkText) bookmarkText.textContent = 'Bookmark';
        }
    }
}

// ══════════════════════════════════════════
// Confirm Dialog
// ══════════════════════════════════════════
function showConfirmDialog(title, message, type = 'warning', onConfirm) {
    const existing = document.querySelector('.confirm-dialog-overlay');
    if (existing) existing.remove();

    const icons  = { warning: 'fa-exclamation-triangle', danger: 'fa-times-circle', info: 'fa-info-circle' };
    const colors = { warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6' };

    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.innerHTML = `
        <div class="confirm-dialog">
            <div class="confirm-dialog-icon" style="color:${colors[type]}">
                <i class="fas ${icons[type]}"></i>
            </div>
            <h3 class="confirm-dialog-title">${title}</h3>
            <p class="confirm-dialog-message">${message}</p>
            <div class="confirm-dialog-actions">
                <button class="confirm-btn-cancel" id="confirmCancel"><i class="fas fa-times"></i> Cancel</button>
                <button class="confirm-btn-confirm" id="confirmOk" style="background:${colors[type]}"><i class="fas fa-check"></i> Confirm</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('show'), 10);

    const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 300); };
    overlay.querySelector('#confirmCancel').addEventListener('click', close);
    overlay.querySelector('#confirmOk').addEventListener('click', () => { close(); if (onConfirm) onConfirm(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

// ══════════════════════════════════════════
// Toast Notification
// ══════════════════════════════════════════
function showToast(message, type = 'info') {
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());
    const colors = {
        success: { bg: 'rgba(45,212,160,0.15)',  border: 'rgba(45,212,160,0.6)',  icon: '#2dd4a0' },
        error:   { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.6)',   icon: '#ef4444' },
        info:    { bg: 'rgba(64,200,255,0.15)',  border: 'rgba(64,200,255,0.6)',  icon: '#40c8ff' }
    };
    const c    = colors[type] || colors.info;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${icon}" style="color:${c.icon};font-size:14px;flex-shrink:0"></i><span>${message}</span>`;
    Object.assign(toast.style, {
        position: 'fixed', top: '76px', right: '12px',
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px', background: 'rgba(6,11,22,0.92)',
        border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.icon}`,
        borderRadius: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        color: '#d8eeff', fontFamily: "'Rajdhani', sans-serif",
        fontWeight: '600', fontSize: '13px', letterSpacing: '0.3px',
        whiteSpace: 'nowrap', zIndex: '99999',
        backdropFilter: 'blur(10px)', animation: 'toastIn 0.25s ease',
        maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis'
    });
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 260);
    }, 2800);
}

// ══════════════════════════════════════════
// CSS Styles
// ══════════════════════════════════════════
if (!document.getElementById('bookmark-styles')) {
    const style = document.createElement('style');
    style.id = 'bookmark-styles';
    style.textContent = `
        @keyframes toastIn { from { transform:translateX(60px); opacity:0; } to { transform:translateX(0); opacity:1; } }
        .confirm-dialog-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:10001; opacity:0; transition:opacity 0.25s ease; padding:1rem; }
        .confirm-dialog-overlay.show { opacity:1; }
        .confirm-dialog-overlay.show .confirm-dialog { transform:scale(1); opacity:1; }
        .confirm-dialog { background:#0a1020; border:1px solid rgba(64,200,255,0.22); border-radius:6px; padding:1.5rem 1.25rem; max-width:320px; width:100%; box-shadow:0 8px 40px rgba(0,0,0,0.6); transform:scale(0.93); opacity:0; transition:all 0.25s ease; position:relative; }
        .confirm-dialog::before { content:''; position:absolute; top:8px; left:8px; width:12px; height:12px; border-top:1.5px solid #40c8ff; border-left:1.5px solid #40c8ff; }
        .confirm-dialog::after  { content:''; position:absolute; bottom:8px; right:8px; width:12px; height:12px; border-bottom:1.5px solid #40c8ff; border-right:1.5px solid #40c8ff; }
        .confirm-dialog-icon { width:48px; height:48px; margin:0 auto 1rem; display:flex; align-items:center; justify-content:center; border-radius:4px; background:rgba(64,200,255,0.07); border:1px solid currentColor; }
        .confirm-dialog-icon i { font-size:1.4rem; }
        .confirm-dialog-title { font-family:'Rajdhani',sans-serif; font-size:1.1rem; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#d8eeff; text-align:center; margin-bottom:0.6rem; }
        .confirm-dialog-message { font-family:'Exo 2',sans-serif; font-size:0.82rem; color:rgba(160,200,230,0.6); text-align:center; line-height:1.55; margin-bottom:1.25rem; }
        .confirm-dialog-actions { display:grid; grid-template-columns:1fr 1fr; gap:0.625rem; }
        .confirm-btn-cancel, .confirm-btn-confirm { padding:0.65rem 1rem; border:none; border-radius:3px; font-family:'Rajdhani',sans-serif; font-weight:700; font-size:0.78rem; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; transition:all 0.25s ease; display:flex; align-items:center; justify-content:center; gap:0.4rem; }
        .confirm-btn-cancel { background:transparent; color:rgba(160,200,230,0.7); border:1px solid rgba(64,200,255,0.2); }
        .confirm-btn-cancel:hover { border-color:rgba(64,200,255,0.5); color:#d8eeff; }
        .confirm-btn-confirm { color:#060b16; font-weight:800; }
        .confirm-btn-confirm:hover { filter:brightness(1.15); }
        .bookmark-item { position:relative; }
        .bookmark-item .card-link { display:block; }
        .remove-bookmark-btn { position:absolute; top:8px; right:8px; width:32px; height:32px; border-radius:50%; background:rgba(239,68,68,0.9); border:none; color:white; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transform:scale(0.8); transition:all 0.3s ease; z-index:10; }
        .bookmark-item:hover .remove-bookmark-btn { opacity:1; transform:scale(1); }
        .remove-bookmark-btn:hover { background:rgba(239,68,68,1); transform:scale(1.1); box-shadow:0 4px 12px rgba(239,68,68,0.5); }
        @media (max-width:768px) { .remove-bookmark-btn { opacity:1; transform:scale(1); } }
    `;
    document.head.appendChild(style);
}

// ══════════════════════════════════════════
// Init
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async function() {
    await window.DayystreamBookmarks.updateCount();

    if (window.location.pathname === '/bookmarks') {
        await window.DayystreamBookmarks.initBookmarksPage();
    }

    if (window.animeData) {
        await checkBookmarkStatus();
        const bookmarkBtn = document.getElementById('bookmarkBtn');
        if (bookmarkBtn) bookmarkBtn.addEventListener('click', toggleBookmark);
    }
});
