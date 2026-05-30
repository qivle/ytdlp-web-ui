document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            views.forEach(view => {
                if(view.id === targetId) {
                    view.classList.remove('hidden');
                } else {
                    view.classList.add('hidden');
                }
            });

            if(targetId === 'history-view') {
                loadHistory();
            }
        });
    });

    // Elements
    const urlInput = document.getElementById('url-input');
    const parseBtn = document.getElementById('parse-btn');
    const parseLoading = document.getElementById('parse-loading');
    const previewCard = document.getElementById('preview-card');
    const duplicateWarning = document.getElementById('duplicate-warning');
    const warnDate = document.getElementById('warn-date');
    const parseLogContainer = document.getElementById('parse-log-container');
    const parseLog = document.getElementById('parse-log');
    
    // Preview Elements
    const videoThumbnail = document.getElementById('video-thumbnail');
    const videoTitle = document.getElementById('video-title');
    const videoChannel = document.getElementById('video-channel');
    const videoDuration = document.getElementById('video-duration');
    const formatSelect = document.getElementById('format-select');
    const downloadBtn = document.getElementById('download-btn');
    
    // Progress Elements
    const progressContainer = document.getElementById('progress-container');
    const progressStatus = document.getElementById('progress-status');
    const progressPercent = document.getElementById('progress-percent');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressSpeed = document.getElementById('progress-speed');
    const progressEta = document.getElementById('progress-eta');

    let currentVideoData = null;
    let isDownloading = false;

    // Parse Logic
    parseBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if(!url) return showToast('Please enter a valid URL', 'error');

        previewCard.classList.add('hidden');
        progressContainer.classList.add('hidden');
        parseLogContainer.classList.add('hidden');
        parseLog.textContent = '';
        parseLoading.classList.remove('hidden');
        parseBtn.disabled = true;
        
        const cookieBrowser = localStorage.getItem('ytdlp_cookie_browser') || 'auto';
        
        try {
            const res = await fetch('/api/parse', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({url, cookie_browser: cookieBrowser})
            });
            const data = await res.json();
            
            if (data.logs && data.logs.length > 0) {
                parseLogContainer.classList.remove('hidden');
                parseLog.innerHTML = data.logs.map(msg => {
                    let colorClass = '';
                    if (msg.includes('ERROR:')) colorClass = 'log-error';
                    else if (msg.includes('WARNING:')) colorClass = 'log-warning';
                    else if (msg.includes('[download]') || msg.includes('[Merger]') || msg.includes('Extracting') || msg.includes('Downloading')) colorClass = 'log-info';
                    
                    return colorClass ? `<span class="${colorClass}">${msg}</span>` : `<span>${msg}</span>`;
                }).join('\n') + '\n';
                parseLog.scrollTop = parseLog.scrollHeight;
            }
            
            if(data.success) {
                currentVideoData = data;
                currentVideoData.originalUrl = url;
                renderPreview(data);
            } else {
                showToast(`Parse Error: ${data.error}`, 'error');
            }
        } catch(err) {
            showToast(`Network Error: ${err.message}`, 'error');
        } finally {
            parseLoading.classList.add('hidden');
            parseBtn.disabled = false;
        }
    });

    urlInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') {
            parseBtn.click();
        }
    });

    function renderPreview(data) {
        if(data.already_downloaded) {
            warnDate.textContent = new Date(data.already_downloaded).toLocaleString();
            duplicateWarning.classList.remove('hidden');
        } else {
            duplicateWarning.classList.add('hidden');
        }

        videoThumbnail.src = data.thumbnail || '';
        videoTitle.textContent = data.title || 'Unknown Title';
        videoTitle.title = data.title;
        videoChannel.textContent = data.channel || 'Unknown Channel';
        videoDuration.textContent = formatDuration(data.duration);
        
        formatSelect.innerHTML = '';
        if(data.formats && data.formats.length > 0) {
            data.formats.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.format_id;
                const codecLabel = f.vcodec ? `[${f.vcodec}] ` : '';
                const sizeLabel = f.size_str ? `${f.size_str} ` : '';
                opt.textContent = `${f.resolution} - ${f.ext} ${codecLabel}${sizeLabel}${f.note ? '('+f.note+')' : ''}`;
                formatSelect.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.value = 'best';
            opt.textContent = 'Auto / Best Quality';
            formatSelect.appendChild(opt);
        }

        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Start Download`;

        previewCard.classList.remove('hidden');
    }

    // Download Logic
    downloadBtn.addEventListener('click', async () => {
        if(!currentVideoData || isDownloading) return;
        
        const formatId = formatSelect.value;
        const selectedOption = formatSelect.options[formatSelect.selectedIndex];
        
        let ext = 'mp4';
        if(selectedOption && selectedOption.textContent.includes('webm')) ext = 'webm';
        else if(selectedOption && selectedOption.textContent.includes('m4a')) ext = 'm4a';

        const cookieBrowser = localStorage.getItem('ytdlp_cookie_browser') || 'auto';

        const payload = {
            url: currentVideoData.originalUrl,
            format_id: formatId,
            video_id: currentVideoData.id || `unknown-${Date.now()}`,
            title: currentVideoData.title || 'Unknown Title',
            thumbnail: currentVideoData.thumbnail || '',
            channel: currentVideoData.channel || '',
            duration: currentVideoData.duration?.toString() || '',
            ext: ext,
            cookie_browser: cookieBrowser
        };

        isDownloading = true;
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Downloading...';
        progressContainer.classList.remove('hidden');
        
        progressBarFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressStatus.textContent = 'Starting processing...';
        progressSpeed.textContent = '0 KiB/s';
        progressEta.textContent = 'ETA: --:--';
        parseLogContainer.classList.remove('hidden');
        parseLog.textContent = 'Starting download process...\n';

        try {
            const res = await fetch('/api/download', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if(data.task_id) {
                connectWebSocket(data.task_id);
            } else {
                showToast('Failed to start download', 'error');
            }
        } catch (err) {
            showToast('Connection error', 'error');
            resetDownloadUI();
        }
    });

    function connectWebSocket(taskId) {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/progress/${taskId}`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if(data.status === 'log') {
                parseLogContainer.classList.remove('hidden');
                
                let msg = data.message;
                let colorClass = '';
                if (msg.includes('ERROR:')) {
                    colorClass = 'log-error';
                } else if (msg.includes('WARNING:')) {
                    colorClass = 'log-warning';
                } else if (msg.includes('[download]') || msg.includes('[Merger]') || msg.includes('Extracting') || msg.includes('Downloading')) {
                    colorClass = 'log-info';
                }
                
                if (colorClass) {
                    parseLog.innerHTML += `<span class="${colorClass}">${msg}</span>\n`;
                } else {
                    parseLog.innerHTML += `<span>${msg}</span>\n`;
                }
                parseLog.scrollTop = parseLog.scrollHeight;
            } else if(data.status === 'downloading') {
                progressStatus.textContent = 'Downloading...';
                if (data.percent) {
                    progressPercent.textContent = data.percent;
                    progressBarFill.style.width = data.percent;
                }
                if (data.speed) {
                    let text = data.speed;
                    if (data.total && data.total !== 'Unknown size') {
                        text += `  |  Size: ${data.total}`;
                    }
                    progressSpeed.textContent = text;
                }
                if (data.eta) progressEta.textContent = `ETA: ${data.eta}`;
            } else if (data.status === 'stream_finished') {
                progressStatus.textContent = 'Merging audio/video... (This might take a while)';
            } else if(data.status === 'finished' || data.status === 'completed') {
                progressStatus.textContent = 'Downloaded Successfully!';
                progressBarFill.style.width = '100%';
                progressPercent.textContent = '100%';
                setTimeout(() => resetDownloadUI(true), 2500);
                showToast('Video downloaded successfully!', 'success');
                ws.close();
            } else if(data.status === 'error') {
                progressStatus.textContent = 'Error occurred';
                showToast(`Download Error`, 'error');
                resetDownloadUI();
                ws.close();
            }
        };

        ws.onerror = () => {
            showToast('WebSocket connection error. Download may still be processing in background.', 'error');
            resetDownloadUI();
        };
    }

    function resetDownloadUI(success = false) {
        isDownloading = false;
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download Again`;
        if(success) {
            setTimeout(() => {
                progressContainer.classList.add('fade-out');
                setTimeout(() => {
                    progressContainer.classList.add('hidden');
                    progressContainer.classList.remove('fade-out');
                }, 300);
            }, 3000);
        } else {
            progressContainer.classList.add('hidden');
        }
    }

    // History Logic
    const refreshHistoryBtn = document.getElementById('refresh-history-btn');
    const historyGrid = document.getElementById('history-grid');
    const historyLoading = document.getElementById('history-loading');
    const historyEmpty = document.getElementById('history-empty');

    refreshHistoryBtn.addEventListener('click', loadHistory);

    async function loadHistory() {
        historyGrid.innerHTML = '';
        historyLoading.classList.remove('hidden');
        historyEmpty.classList.add('hidden');

        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            
            historyLoading.classList.add('hidden');

            if(!data || data.length === 0) {
                historyEmpty.classList.remove('hidden');
                return;
            }

            data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'history-card slide-up';
                card.innerHTML = `
                    <div style="position: relative;">
                        <img class="history-thumb" src="${item.thumbnail}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100%\\' height=\\'100%\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23333\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'white\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\'>No Thumb</text></svg>'"/>
                        <span class="duration-badge">${formatDuration(item.duration)}</span>
                    </div>
                    <div class="history-info">
                        <div class="history-title" title="${item.title}">${item.title}</div>
                        <div class="history-meta">${item.channel || 'Unknown Channel'}</div>
                        <div class="history-meta" style="color: var(--accent-blue);">${new Date(item.download_date).toLocaleDateString()} &middot; ${item.ext || 'mp4'} Format</div>
                    </div>
                `;
                historyGrid.appendChild(card);
            });
        } catch(err) {
            historyLoading.classList.add('hidden');
            showToast('Failed to load history', 'error');
        }
    }

    // Settings Logic
    const updateYtdlpBtn = document.getElementById('update-ytdlp-btn');
    const updateLogContainer = document.getElementById('update-log-container');
    const updateLog = document.getElementById('update-log');
    const cookieBrowserSelect = document.getElementById('cookie-browser-select');

    // Load saved cookie browser setting
    const savedCookieBrowser = localStorage.getItem('ytdlp_cookie_browser');
    if (savedCookieBrowser) {
        cookieBrowserSelect.value = savedCookieBrowser;
    }

    cookieBrowserSelect.addEventListener('change', (e) => {
        localStorage.setItem('ytdlp_cookie_browser', e.target.value);
        showToast('Cookie setting saved', 'success');
    });

    updateYtdlpBtn.addEventListener('click', async () => {
        updateYtdlpBtn.disabled = true;
        updateYtdlpBtn.textContent = 'Updating...';
        updateLogContainer.classList.remove('hidden');
        updateLog.textContent = 'Running package update via pip...\n[Please wait] This might take a few moments...\n\n';

        try {
            const res = await fetch('/api/update', {method: 'POST'});
            const data = await res.json();
            
            if(data.success) {
                updateLog.textContent += data.output;
                showToast('yt-dlp updated successfully', 'success');
            } else {
                updateLog.textContent += 'ERROR:\n' + data.error;
                showToast('Failed to update yt-dlp', 'error');
            }
        } catch(err) {
            updateLog.textContent += 'NETWORK ERROR:\n' + err.message;
            showToast('Network error during update', 'error');
        } finally {
            updateYtdlpBtn.disabled = false;
            updateYtdlpBtn.textContent = 'Update yt-dlp';
        }
    });

    // Utilities
    function formatDuration(duration) {
        if(!duration) return '--:--';
        if(typeof duration === 'string' && duration.includes(':')) return duration;
        const totalSeconds = parseInt(duration, 10);
        if(isNaN(totalSeconds)) return '--:--';
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if(hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '';
        if(type === 'success') {
            icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        } else if(type === 'error') {
            icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        }

        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
});
