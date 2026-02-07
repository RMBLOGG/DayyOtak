/**
 * Share System for Anime Detail Page
 * Features: Social sharing, Share card generation, Copy link
 */

class AnimeShareSystem {
    constructor() {
        this.modal = null;
        this.shareCard = null;
        this.animeData = window.animeData || {};
        this.customShareText = null; // Store custom text if user edits
        this.init();
    }

    init() {
        this.createShareButton();
        this.createShareModal();
        this.attachEventListeners();
    }

    createShareButton() {
        // Find action buttons container
        const actionButtons = document.querySelector('.action-buttons');
        if (!actionButtons) return;

        // Check if button already exists
        if (document.getElementById('shareBtn')) return;

        // Create share button
        const shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-share';
        shareBtn.id = 'shareBtn';
        shareBtn.innerHTML = `
            <i class="fas fa-share-alt"></i>
            Share
        `;
        
        actionButtons.appendChild(shareBtn);
    }

    createShareModal() {
        // Check if modal already exists
        if (document.getElementById('shareModal')) return;

        const modalHTML = `
            <div id="shareModal" class="share-modal">
                <div class="share-modal-overlay"></div>
                <div class="share-modal-content">
                    <button class="share-modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                    
                    <div class="share-modal-header">
                        <div class="share-icon-wrapper">
                            <i class="fas fa-share-nodes"></i>
                        </div>
                        <h3>Share This Anime</h3>
                        <p>Spread the word about ${this.animeData.title || 'this anime'}</p>
                    </div>

                    <div class="share-options">
                        <button class="share-option" data-platform="twitter">
                            <div class="share-option-icon" style="background: linear-gradient(135deg, #1DA1F2, #0d8bd9);">
                                <i class="fab fa-twitter"></i>
                            </div>
                            <span>Twitter</span>
                        </button>

                        <button class="share-option" data-platform="facebook">
                            <div class="share-option-icon" style="background: linear-gradient(135deg, #1877F2, #0d5dba);">
                                <i class="fab fa-facebook-f"></i>
                            </div>
                            <span>Facebook</span>
                        </button>

                        <button class="share-option" data-platform="whatsapp">
                            <div class="share-option-icon" style="background: linear-gradient(135deg, #25D366, #1da851);">
                                <i class="fab fa-whatsapp"></i>
                            </div>
                            <span>WhatsApp</span>
                        </button>

                        <button class="share-option" data-platform="telegram">
                            <div class="share-option-icon" style="background: linear-gradient(135deg, #0088cc, #006699);">
                                <i class="fab fa-telegram-plane"></i>
                            </div>
                            <span>Telegram</span>
                        </button>

                        <button class="share-option" data-platform="copy">
                            <div class="share-option-icon" style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
                                <i class="fas fa-link"></i>
                            </div>
                            <span>Copy Link</span>
                        </button>

                        <button class="share-option" data-platform="image">
                            <div class="share-option-icon" style="background: linear-gradient(135deg, #ec4899, #db2777);">
                                <i class="fas fa-image"></i>
                            </div>
                            <span>Share Card</span>
                        </button>
                    </div>

                    <div class="share-link-box">
                        <input type="text" id="shareLinkInput" readonly value="${window.location.href}">
                        <button id="copyLinkBtn">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>

                    <!-- Share Text Preview -->
                    <div class="share-preview-box">
                        <div class="share-preview-header">
                            <h4><i class="fas fa-eye"></i> Preview Pesan Share</h4>
                            <button id="editTextBtn" class="btn-edit-text">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        </div>
                        <div id="sharePreviewContent" class="share-preview-content"></div>
                    </div>

                    <!-- Share Card Preview (Hidden by default) -->
                    <div id="shareCardContainer" class="share-card-container" style="display: none;">
                        <div class="share-card-header">
                            <h4>Your Share Card</h4>
                            <p>Right-click and save, or click download button</p>
                        </div>
                        <canvas id="shareCanvas"></canvas>
                        <button id="downloadCardBtn" class="btn-download-card">
                            <i class="fas fa-download"></i>
                            Download Share Card
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('shareModal');
    }

    attachEventListeners() {
        // Open modal
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.openModal());
        }

        // Close modal
        const closeBtn = this.modal.querySelector('.share-modal-close');
        const overlay = this.modal.querySelector('.share-modal-overlay');
        
        closeBtn.addEventListener('click', () => this.closeModal());
        overlay.addEventListener('click', () => this.closeModal());

        // Share options
        const shareOptions = this.modal.querySelectorAll('.share-option');
        shareOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const platform = e.currentTarget.dataset.platform;
                this.handleShare(platform);
            });
        });

        // Copy link button
        const copyLinkBtn = document.getElementById('copyLinkBtn');
        copyLinkBtn.addEventListener('click', () => this.copyLink());

        // Download card button
        const downloadCardBtn = document.getElementById('downloadCardBtn');
        if (downloadCardBtn) {
            downloadCardBtn.addEventListener('click', () => this.downloadShareCard());
        }

        // Edit text button
        const editTextBtn = document.getElementById('editTextBtn');
        if (editTextBtn) {
            editTextBtn.addEventListener('click', () => this.editShareText());
        }

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.closeModal();
            }
        });
    }

    openModal() {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Hide share card container when opening
        const cardContainer = document.getElementById('shareCardContainer');
        if (cardContainer) {
            cardContainer.style.display = 'none';
        }
        
        // Update share preview
        this.updateSharePreview();
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    handleShare(platform) {
        const url = window.location.href;
        const shareText = this.getShareTextForPlatform(platform);

        switch (platform) {
            case 'twitter':
                this.shareToTwitter(shareText, url);
                break;
            case 'facebook':
                this.shareToFacebook(url);
                break;
            case 'whatsapp':
                this.shareToWhatsApp(shareText);
                break;
            case 'telegram':
                this.shareToTelegram(shareText, url);
                break;
            case 'copy':
                this.copyLink();
                break;
            case 'image':
                this.generateShareCard();
                break;
        }
    }

    shareToTwitter(text, url) {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, '_blank', 'width=600,height=400');
    }

    shareToFacebook(url) {
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        window.open(facebookUrl, '_blank', 'width=600,height=400');
    }

    shareToWhatsApp(text) {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(whatsappUrl, '_blank');
    }

    shareToTelegram(text, url) {
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.open(telegramUrl, '_blank');
    }

    copyLink() {
        const input = document.getElementById('shareLinkInput');
        input.select();
        input.setSelectionRange(0, 99999); // For mobile devices

        try {
            document.execCommand('copy');
            this.showCopyFeedback();
        } catch (err) {
            // Fallback for modern browsers
            navigator.clipboard.writeText(input.value).then(() => {
                this.showCopyFeedback();
            }).catch(e => {
                console.error('Failed to copy:', e);
            });
        }
    }

    showCopyFeedback() {
        const copyBtn = document.getElementById('copyLinkBtn');
        const originalHTML = copyBtn.innerHTML;
        
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        copyBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.style.background = '';
        }, 2000);
    }

    async generateShareCard() {
        const cardContainer = document.getElementById('shareCardContainer');
        const canvas = document.getElementById('shareCanvas');
        const ctx = canvas.getContext('2d');

        // Show loading state
        cardContainer.style.display = 'block';
        cardContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Canvas dimensions (Instagram Story size - 1080x1920)
        const width = 1080;
        const height = 1920;
        canvas.width = width;
        canvas.height = height;

        // ========== FUTURISTIC BACKGROUND ==========
        // Dark base with gradient
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#0a0e27');
        bgGradient.addColorStop(0.3, '#1a1f3a');
        bgGradient.addColorStop(0.6, '#0f1729');
        bgGradient.addColorStop(1, '#050815');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Futuristic grid overlay
        this.drawFuturisticGrid(ctx, width, height);
        
        // Glowing orbs
        this.drawGlowingOrbs(ctx, width, height);
        
        // Cyber lines
        this.drawCyberLines(ctx, width, height);

        // ========== POSTER WITH FUTURISTIC FRAME ==========
        let posterLoaded = false;
        try {
            const posterImg = await this.loadImageWithFetch(this.animeData.poster);
            
            if (posterImg) {
                const posterWidth = 700;
                const posterHeight = 1050;
                const posterX = (width - posterWidth) / 2;
                const posterY = 150;
                
                // Futuristic frame background with glow
                ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
                ctx.shadowBlur = 50;
                
                // Outer glow frame
                const outerGlow = ctx.createLinearGradient(posterX, posterY, posterX + posterWidth, posterY + posterHeight);
                outerGlow.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
                outerGlow.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
                outerGlow.addColorStop(1, 'rgba(236, 72, 153, 0.3)');
                ctx.fillStyle = outerGlow;
                this.roundRect(ctx, posterX - 10, posterY - 10, posterWidth + 20, posterHeight + 20, 30);
                ctx.fill();
                
                // Main frame with gradient border
                const frameGradient = ctx.createLinearGradient(posterX, posterY, posterX + posterWidth, posterY + posterHeight);
                frameGradient.addColorStop(0, '#3b82f6');
                frameGradient.addColorStop(0.5, '#8b5cf6');
                frameGradient.addColorStop(1, '#ec4899');
                
                ctx.strokeStyle = frameGradient;
                ctx.lineWidth = 4;
                this.roundRect(ctx, posterX, posterY, posterWidth, posterHeight, 24);
                ctx.stroke();
                
                // Draw poster
                ctx.shadowBlur = 0;
                ctx.save();
                this.roundRect(ctx, posterX + 2, posterY + 2, posterWidth - 4, posterHeight - 4, 22);
                ctx.clip();
                ctx.drawImage(posterImg, posterX + 2, posterY + 2, posterWidth - 4, posterHeight - 4);
                ctx.restore();
                
                // Corner accents (cyber style)
                this.drawCornerAccents(ctx, posterX, posterY, posterWidth, posterHeight);
                
                posterLoaded = true;
                console.log('✓ Poster loaded successfully');
            }
        } catch (error) {
            console.warn('Failed to load poster:', error);
        }
        
        // Placeholder if poster failed
        if (!posterLoaded) {
            const posterWidth = 700;
            const posterHeight = 1050;
            const posterX = (width - posterWidth) / 2;
            const posterY = 150;
            
            ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
            this.roundRect(ctx, posterX, posterY, posterWidth, posterHeight, 24);
            ctx.fill();
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = 'bold 36px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('LOADING...', width / 2, posterY + posterHeight / 2);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // ========== TITLE WITH FUTURISTIC STYLE ==========
        const titleY = 1280;
        
        // Glowing title background
        const titleBg = ctx.createLinearGradient(0, titleY - 60, width, titleY + 60);
        titleBg.addColorStop(0, 'transparent');
        titleBg.addColorStop(0.5, 'rgba(59, 130, 246, 0.15)');
        titleBg.addColorStop(1, 'transparent');
        ctx.fillStyle = titleBg;
        ctx.fillRect(0, titleY - 60, width, 120);
        
        // Title with glow effect
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 68px system-ui';
        ctx.textAlign = 'center';
        this.wrapText(ctx, this.animeData.title || 'Anime Title', width / 2, titleY, width - 120, 80);
        
        ctx.shadowBlur = 0;

        // ========== INFO CARDS WITH HOLOGRAPHIC STYLE ==========
        const infoY = titleY + 140;
        this.drawHolographicInfoCards(ctx, width, infoY);

        // ========== FUTURISTIC BRANDING ==========
        this.drawFuturisticBranding(ctx, width, height);

        // ========== DECORATIVE ELEMENTS ==========
        this.drawFloatingParticles(ctx, width, height);
        
        ctx.textAlign = 'left';
        console.log('🎨 Futuristic share card generated!');
    }

    drawFuturisticGrid(ctx, width, height) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.lineWidth = 1;
        
        // Perspective grid
        const gridSize = 60;
        const centerY = height / 2;
        
        for (let i = 0; i < width; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }
        
        for (let i = 0; i < height; i += gridSize) {
            const alpha = Math.abs(i - centerY) / centerY;
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.08 * (1 - alpha * 0.5)})`;
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    drawGlowingOrbs(ctx, width, height) {
        ctx.save();
        
        // Orb 1 - Blue
        const orb1 = ctx.createRadialGradient(width * 0.85, height * 0.15, 0, width * 0.85, height * 0.15, 450);
        orb1.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
        orb1.addColorStop(0.5, 'rgba(59, 130, 246, 0.1)');
        orb1.addColorStop(1, 'transparent');
        ctx.fillStyle = orb1;
        ctx.fillRect(0, 0, width, height);
        
        // Orb 2 - Purple
        const orb2 = ctx.createRadialGradient(width * 0.15, height * 0.85, 0, width * 0.15, height * 0.85, 400);
        orb2.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
        orb2.addColorStop(0.5, 'rgba(139, 92, 246, 0.08)');
        orb2.addColorStop(1, 'transparent');
        ctx.fillStyle = orb2;
        ctx.fillRect(0, 0, width, height);
        
        // Orb 3 - Pink
        const orb3 = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, 350);
        orb3.addColorStop(0, 'rgba(236, 72, 153, 0.15)');
        orb3.addColorStop(0.5, 'rgba(236, 72, 153, 0.05)');
        orb3.addColorStop(1, 'transparent');
        ctx.fillStyle = orb3;
        ctx.fillRect(0, 0, width, height);
        
        ctx.restore();
    }

    drawCyberLines(ctx, width, height) {
        ctx.save();
        
        // Diagonal cyber lines
        const lineGradient = ctx.createLinearGradient(0, 0, width, height);
        lineGradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
        lineGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.15)');
        lineGradient.addColorStop(1, 'rgba(236, 72, 153, 0.15)');
        
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 2;
        
        // Top right to bottom left
        ctx.beginPath();
        ctx.moveTo(width, 100);
        ctx.lineTo(width - 300, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(width, 200);
        ctx.lineTo(width - 400, 0);
        ctx.stroke();
        
        // Bottom left to top right
        ctx.beginPath();
        ctx.moveTo(0, height - 100);
        ctx.lineTo(300, height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, height - 200);
        ctx.lineTo(400, height);
        ctx.stroke();
        
        ctx.restore();
    }

    drawCornerAccents(ctx, x, y, w, h) {
        ctx.save();
        
        const accentSize = 40;
        const accentThickness = 4;
        
        const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
        gradient.addColorStop(0, '#60a5fa');
        gradient.addColorStop(0.5, '#a78bfa');
        gradient.addColorStop(1, '#f472b6');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = accentThickness;
        ctx.lineCap = 'round';
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x + accentSize, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + accentSize);
        ctx.stroke();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + w - accentSize, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + accentSize);
        ctx.stroke();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x, y + h - accentSize);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + accentSize, y + h);
        ctx.stroke();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + w - accentSize, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - accentSize);
        ctx.stroke();
        
        ctx.restore();
    }

    drawHolographicInfoCards(ctx, width, infoY) {
        const cardWidth = 340;
        const cardHeight = 140;
        const cardGap = 25;
        const totalWidth = (cardWidth * 2) + cardGap;
        const startX = (width - totalWidth) / 2;
        
        // Score card
        if (this.animeData.score) {
            ctx.save();
            
            // Holographic background
            const scoreGradient = ctx.createLinearGradient(
                startX, infoY,
                startX + cardWidth, infoY + cardHeight
            );
            scoreGradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
            scoreGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.25)');
            scoreGradient.addColorStop(1, 'rgba(59, 130, 246, 0.2)');
            
            ctx.fillStyle = scoreGradient;
            this.roundRect(ctx, startX, infoY, cardWidth, cardHeight, 20);
            ctx.fill();
            
            // Glowing border
            ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)';
            ctx.lineWidth = 3;
            this.roundRect(ctx, startX, infoY, cardWidth, cardHeight, 20);
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            
            // Score text with glow
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 25;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 64px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('⭐', startX + cardWidth / 2, infoY + 60);
            
            ctx.shadowColor = '#60a5fa';
            ctx.shadowBlur = 20;
            ctx.font = 'bold 56px system-ui';
            ctx.fillText(this.animeData.score, startX + cardWidth / 2, infoY + 120);
            
            ctx.restore();
        }
        
        // Type/Status card
        if (this.animeData.type || this.animeData.status) {
            const cardX = startX + cardWidth + cardGap;
            
            ctx.save();
            
            // Holographic background
            const typeGradient = ctx.createLinearGradient(
                cardX, infoY,
                cardX + cardWidth, infoY + cardHeight
            );
            typeGradient.addColorStop(0, 'rgba(236, 72, 153, 0.2)');
            typeGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.25)');
            typeGradient.addColorStop(1, 'rgba(236, 72, 153, 0.2)');
            
            ctx.fillStyle = typeGradient;
            this.roundRect(ctx, cardX, infoY, cardWidth, cardHeight, 20);
            ctx.fill();
            
            // Glowing border
            ctx.shadowColor = 'rgba(236, 72, 153, 0.6)';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = 'rgba(244, 114, 182, 0.8)';
            ctx.lineWidth = 3;
            this.roundRect(ctx, cardX, infoY, cardWidth, cardHeight, 20);
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            
            // Type/Status text
            ctx.shadowColor = '#ec4899';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px system-ui';
            ctx.textAlign = 'center';
            
            if (this.animeData.type) {
                ctx.fillText('📺 ' + this.animeData.type, cardX + cardWidth / 2, infoY + 60);
            }
            if (this.animeData.status) {
                ctx.font = 'bold 32px system-ui';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillText(this.animeData.status, cardX + cardWidth / 2, infoY + 108);
            }
            
            ctx.restore();
        }
    }

    drawFuturisticBranding(ctx, width, height) {
        const brandY = height - 200;
        
        ctx.save();
        
        // Holographic platform background
        const platformGradient = ctx.createLinearGradient(0, brandY - 50, width, brandY + 100);
        platformGradient.addColorStop(0, 'transparent');
        platformGradient.addColorStop(0.3, 'rgba(59, 130, 246, 0.1)');
        platformGradient.addColorStop(0.7, 'rgba(139, 92, 246, 0.1)');
        platformGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = platformGradient;
        ctx.fillRect(0, brandY - 50, width, 150);
        
        // Glowing logo circle
        const logoGradient = ctx.createLinearGradient(
            width / 2 - 85, brandY - 85,
            width / 2 + 85, brandY + 85
        );
        logoGradient.addColorStop(0, '#3b82f6');
        logoGradient.addColorStop(0.5, '#8b5cf6');
        logoGradient.addColorStop(1, '#ec4899');
        
        ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
        ctx.shadowBlur = 40;
        ctx.fillStyle = logoGradient;
        ctx.beginPath();
        ctx.arc(width / 2, brandY - 20, 85, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner glow
        const innerGlow = ctx.createRadialGradient(width / 2, brandY - 20, 0, width / 2, brandY - 20, 75);
        innerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        innerGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = innerGlow;
        ctx.beginPath();
        ctx.arc(width / 2, brandY - 20, 75, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Play icon
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px system-ui';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText('▶', width / 2, brandY - 8);
        
        ctx.shadowBlur = 0;
        
        // Brand name with futuristic glow
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 64px system-ui';
        ctx.fillText('DAYYdesu', width / 2, brandY + 95);
        
        // Subtitle
        ctx.shadowBlur = 15;
        ctx.font = '36px system-ui';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('Watch Anime Online', width / 2, brandY + 145);
        
        // Decorative line
        const lineGradient = ctx.createLinearGradient(width / 2 - 200, brandY + 170, width / 2 + 200, brandY + 170);
        lineGradient.addColorStop(0, 'transparent');
        lineGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.6)');
        lineGradient.addColorStop(1, 'transparent');
        
        ctx.shadowBlur = 0;
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 200, brandY + 170);
        ctx.lineTo(width / 2 + 200, brandY + 170);
        ctx.stroke();
        
        ctx.restore();
    }

    drawFloatingParticles(ctx, width, height) {
        ctx.save();
        
        // Small glowing particles
        const particles = [
            { x: width * 0.1, y: height * 0.2, size: 4 },
            { x: width * 0.9, y: height * 0.3, size: 3 },
            { x: width * 0.15, y: height * 0.6, size: 5 },
            { x: width * 0.85, y: height * 0.7, size: 4 },
            { x: width * 0.3, y: height * 0.15, size: 3 },
            { x: width * 0.7, y: height * 0.85, size: 4 },
            { x: width * 0.5, y: height * 0.1, size: 3 },
            { x: width * 0.2, y: height * 0.9, size: 5 },
        ];
        
        particles.forEach(particle => {
            const particleGradient = ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.size * 3
            );
            particleGradient.addColorStop(0, 'rgba(96, 165, 250, 0.8)');
            particleGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.4)');
            particleGradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = particleGradient;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }

    drawDecorativeElements(ctx, width, height) {
        ctx.save();
        
        // Gradient orbs
        const orb1 = ctx.createRadialGradient(width * 0.8, height * 0.2, 0, width * 0.8, height * 0.2, 400);
        orb1.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
        orb1.addColorStop(1, 'transparent');
        ctx.fillStyle = orb1;
        ctx.fillRect(0, 0, width, height);
        
        const orb2 = ctx.createRadialGradient(width * 0.2, height * 0.8, 0, width * 0.2, height * 0.8, 350);
        orb2.addColorStop(0, 'rgba(139, 92, 246, 0.12)');
        orb2.addColorStop(1, 'transparent');
        ctx.fillStyle = orb2;
        ctx.fillRect(0, 0, width, height);
        
        // Subtle grid pattern
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 50;
        
        for (let i = 0; i < width; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }
        for (let i = 0; i < height; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        const lines = [];

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        // Draw all lines centered
        lines.forEach((line, index) => {
            ctx.fillText(line.trim(), x, currentY + (index * lineHeight));
        });
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            // Try multiple methods to load the image
            const loadMethods = [
                // Method 1: Direct load with crossOrigin
                () => {
                    img.crossOrigin = 'anonymous';
                    img.src = src;
                },
                // Method 2: Use CORS proxy
                () => {
                    img.crossOrigin = 'anonymous';
                    img.src = `https://corsproxy.io/?${encodeURIComponent(src)}`;
                },
                // Method 3: Try without crossOrigin (for same-origin)
                () => {
                    img.removeAttribute('crossOrigin');
                    img.src = src;
                },
                // Method 4: Use alternative CORS proxy
                () => {
                    img.crossOrigin = 'anonymous';
                    img.src = `https://api.allorigins.win/raw?url=${encodeURIComponent(src)}`;
                }
            ];
            
            let currentMethod = 0;
            
            img.onload = () => {
                console.log('Image loaded successfully from:', src, 'using method', currentMethod + 1);
                resolve(img);
            };
            
            img.onerror = (error) => {
                console.warn(`Failed to load image using method ${currentMethod + 1}:`, error);
                currentMethod++;
                
                if (currentMethod < loadMethods.length) {
                    console.log(`Trying method ${currentMethod + 1}...`);
                    loadMethods[currentMethod]();
                } else {
                    console.error('All image loading methods failed for:', src);
                    reject(error);
                }
            };
            
            // Start with first method
            loadMethods[currentMethod]();
        });
    }

    async loadImageWithFetch(src) {
        try {
            // GUNAKAN BACKEND PROXY - ZERO API CALLS untuk cached images!
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
            console.log('Loading image via backend proxy:', proxyUrl);
            
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Check if from cache
            const cacheStatus = response.headers.get('X-Cache-Status');
            if (cacheStatus === 'HIT') {
                console.log('✓ Image served from cache (no API call)');
            } else {
                console.log('⚠ Image fetched and cached (1 API call, cached for 30 days)');
            }
            
            const blob = await response.blob();
            const objectURL = URL.createObjectURL(blob);
            
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(objectURL);
                    resolve(img);
                };
                img.onerror = reject;
                img.src = objectURL;
            });
        } catch (error) {
            console.error('Backend proxy failed, trying fallback methods:', error);
            
            // Fallback ke Image loading method jika backend proxy gagal
            try {
                return await this.loadImage(src);
            } catch (fallbackError) {
                console.error('All loading methods failed:', fallbackError);
                throw fallbackError;
            }
        }
    }

    downloadShareCard() {
        const canvas = document.getElementById('shareCanvas');
        const link = document.createElement('a');
        const fileName = `${this.animeData.title || 'anime'}-share-card.png`
            .replace(/[^a-z0-9]/gi, '-')
            .toLowerCase();
        
        link.download = fileName;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Show success feedback
        const downloadBtn = document.getElementById('downloadCardBtn');
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded!';
        downloadBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        
        setTimeout(() => {
            downloadBtn.innerHTML = originalText;
            downloadBtn.style.background = '';
        }, 2500);
    }

    updateSharePreview() {
        const previewContent = document.getElementById('sharePreviewContent');
        if (!previewContent) return;

        const title = this.animeData.title || 'Anime Title';
        const score = this.animeData.score ? `⭐ ${this.animeData.score}/10` : '';
        const type = this.animeData.type ? `📺 ${this.animeData.type}` : '';
        const status = this.animeData.status ? `📡 ${this.animeData.status}` : '';
        const url = window.location.href;

        // Use custom text if available, otherwise generate default
        let previewText = this.customShareText;
        
        if (!previewText) {
            previewText = `🎌 *${title}*\n\n${score ? score + '\n' : ''}${type ? type + '\n' : ''}${status ? status + '\n' : ''}\n🎬 Nonton sekarang di DAYYdesu!\n👉 ${url}`;
        }

        // Convert to HTML with proper formatting
        const htmlText = previewText
            .replace(/\*([^*]+)\*/g, '<strong>$1</strong>') // Bold text
            .replace(/\n/g, '<br>'); // Line breaks

        previewContent.innerHTML = htmlText;
    }

    editShareText() {
        const previewContent = document.getElementById('sharePreviewContent');
        const currentText = this.customShareText || this.getDefaultShareText();
        
        // Create editable textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'share-text-editor';
        textarea.value = currentText;
        textarea.rows = 8;
        
        // Replace preview content with textarea
        previewContent.innerHTML = '';
        previewContent.appendChild(textarea);
        
        // Add save and cancel buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'share-edit-buttons';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-save-text';
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Simpan';
        saveBtn.onclick = () => {
            this.customShareText = textarea.value;
            this.updateSharePreview();
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel-text';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Batal';
        cancelBtn.onclick = () => {
            this.updateSharePreview();
        };
        
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn-reset-text';
        resetBtn.innerHTML = '<i class="fas fa-undo"></i> Reset';
        resetBtn.onclick = () => {
            this.customShareText = null;
            this.updateSharePreview();
        };
        
        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(resetBtn);
        previewContent.appendChild(buttonContainer);
        
        textarea.focus();
    }

    getDefaultShareText() {
        const title = this.animeData.title || 'Anime Title';
        const score = this.animeData.score ? `⭐ ${this.animeData.score}/10` : '';
        const type = this.animeData.type ? `📺 ${this.animeData.type}` : '';
        const status = this.animeData.status ? `📡 ${this.animeData.status}` : '';
        const url = window.location.href;
        
        return `🎌 *${title}*\n\n${score ? score + '\n' : ''}${type ? type + '\n' : ''}${status ? status + '\n' : ''}\n🎬 Nonton sekarang di DAYYdesu!\n👉 ${url}`;
    }

    getShareTextForPlatform(platform) {
        const url = window.location.href;
        const title = this.animeData.title || 'Check out this anime';
        const score = this.animeData.score ? `⭐ ${this.animeData.score}/10` : '';
        const type = this.animeData.type ? `📺 ${this.animeData.type}` : '';
        const status = this.animeData.status ? `📡 ${this.animeData.status}` : '';
        
        // If user has custom text, use it
        if (this.customShareText) {
            return this.customShareText;
        }
        
        // Platform-specific formatting
        switch (platform) {
            case 'twitter':
                return `🔥 ${title}\n\n${score}${type ? ' • ' + type : ''}${status ? ' • ' + status : ''}\n\n🎬 Watch now on DAYYdesu! 👇`;
            
            case 'whatsapp':
            case 'telegram':
                return `🎌 *${title}*\n\n${score ? score + '\n' : ''}${type ? type + '\n' : ''}${status ? status + '\n' : ''}\n🎬 Nonton sekarang di DAYYdesu!\n👉 ${url}`;
            
            default:
                return `${title} - Watch on DAYYdesu\n${url}`;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof window.animeData !== 'undefined') {
            window.shareSystem = new AnimeShareSystem();
        } else {
            console.warn('window.animeData not found. Share system not initialized.');
        }
    });
} else {
    // DOM already loaded
    if (typeof window.animeData !== 'undefined') {
        window.shareSystem = new AnimeShareSystem();
    } else {
        console.warn('window.animeData not found. Share system not initialized.');
    }
}
