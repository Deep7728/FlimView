// Custom Video Player Controller for FlimView
class CustomPlayer {
  constructor(wrapperId, videoId) {
    this.wrapper = document.getElementById(wrapperId);
    this.video = document.getElementById(videoId);

    if (!this.wrapper || !this.video) return;

    // Control Elements
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.playIcon = document.getElementById('playIcon');
    this.pauseIcon = document.getElementById('pauseIcon');
    this.skipBackBtn = document.getElementById('skipBackBtn');
    this.skipForwardBtn = document.getElementById('skipForwardBtn');

    this.progressContainer = document.getElementById('progressContainer');
    this.progressBarBuffer = document.getElementById('progressBarBuffer');
    this.progressBarFill = document.getElementById('progressBarFill');
    this.progressScrubber = document.getElementById('progressScrubber');
    this.progressTooltip = document.getElementById('progressTooltip');

    this.timeDisplay = document.getElementById('timeDisplay');
    this.volumeBtn = document.getElementById('volumeBtn');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.volumeHighIcon = document.getElementById('volumeHighIcon');
    this.volumeMuteIcon = document.getElementById('volumeMuteIcon');

    this.speedBtn = document.getElementById('speedBtn');
    this.speedLabel = document.getElementById('speedLabel');
    this.speedMenu = document.getElementById('speedMenu');

    this.pipBtn = document.getElementById('pipBtn');
    this.theaterBtn = document.getElementById('theaterBtn');
    this.fullscreenBtn = document.getElementById('fullscreenBtn');
    this.fullscreenIcon = document.getElementById('fullscreenIcon');
    this.exitFullscreenIcon = document.getElementById('exitFullscreenIcon');

    this.spinner = document.getElementById('playerSpinner');
    this.quickFeedback = document.getElementById('quickFeedback');
    this.quickFeedbackIcon = document.getElementById('quickFeedbackIcon');
    this.quickFeedbackText = document.getElementById('quickFeedbackText');

    this.isScrubbing = false;
    this.wasPlayingBeforeScrub = false;
    this.hideControlsTimeout = null;
    this.quickFeedbackTimeout = null;
    this.lastClickTime = 0;
    this.clickTimer = null;

    // Restore saved volume or default to 1.0
    const savedVol = localStorage.getItem('flimview_volume');
    this.lastVolume = savedVol !== null ? parseFloat(savedVol) : 1;
    this.video.volume = this.lastVolume;
    if (this.volumeSlider) this.volumeSlider.value = this.lastVolume;
    this.updateVolumeIcons();

    // Restore saved theater mode
    if (localStorage.getItem('flimview_theater') === 'true') {
      const container = document.querySelector('.watch-container');
      if (container) container.classList.add('theater-mode');
    }

    this.bindEvents();
  }

  bindEvents() {
    // Play / Pause toggles
    if (this.playPauseBtn) {
      this.playPauseBtn.addEventListener('click', () => this.togglePlay(true));
    }

    // Video Click / Double-Click handling (Left = -10s, Right = +10s, Center = Play/Pause)
    this.video.addEventListener('click', (e) => {
      const now = Date.now();
      const rect = this.video.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;

      if (now - this.lastClickTime < 300) {
        // Double Click detected!
        clearTimeout(this.clickTimer);
        this.lastClickTime = 0;
        if (clickX < width * 0.35) {
          this.seekBy(-10);
        } else if (clickX > width * 0.65) {
          this.seekBy(10);
        } else {
          this.toggleFullscreen();
        }
      } else {
        this.lastClickTime = now;
        this.clickTimer = setTimeout(() => {
          this.togglePlay(true);
        }, 220);
      }
    });

    this.video.addEventListener('play', () => {
      if (this.playIcon) this.playIcon.style.display = 'none';
      if (this.pauseIcon) this.pauseIcon.style.display = 'block';
      this.wrapper.classList.remove('paused');
      this.hideSpinner();
      this.startHideControlsTimer();
    });

    this.video.addEventListener('pause', () => {
      if (this.playIcon) this.playIcon.style.display = 'block';
      if (this.pauseIcon) this.pauseIcon.style.display = 'none';
      this.wrapper.classList.add('paused');
      this.hideSpinner();
      this.showControls();
    });

    // Buffering / Loading states for smooth playback indicators
    this.video.addEventListener('waiting', () => this.showSpinner());
    this.video.addEventListener('stalled', () => this.showSpinner());
    this.video.addEventListener('seeking', () => this.showSpinner());
    this.video.addEventListener('playing', () => this.hideSpinner());
    this.video.addEventListener('canplay', () => this.hideSpinner());
    this.video.addEventListener('seeked', () => this.hideSpinner());

    // Skips
    if (this.skipBackBtn) this.skipBackBtn.addEventListener('click', () => this.seekBy(-10));
    if (this.skipForwardBtn) this.skipForwardBtn.addEventListener('click', () => this.seekBy(10));

    // Time Update & Buffer
    this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.video.addEventListener('progress', () => this.onBufferProgress());
    this.video.addEventListener('loadedmetadata', () => {
      this.updateTimeDisplay();
      this.onBufferProgress();
    });

    // Scrubbing & Seeking (Mouse)
    if (this.progressContainer) {
      this.progressContainer.addEventListener('mousedown', (e) => this.startScrubbing(e));
      window.addEventListener('mousemove', (e) => this.scrub(e));
      window.addEventListener('mouseup', () => this.stopScrubbing());

      // Touch Scrubbing for Mobile & Tablets
      this.progressContainer.addEventListener('touchstart', (e) => this.startScrubbing(e), { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (this.isScrubbing) {
          this.scrub(e);
        }
      }, { passive: true });
      window.addEventListener('touchend', () => this.stopScrubbing());

      // Hover tooltip
      this.progressContainer.addEventListener('mousemove', (e) => this.updateTooltip(e));
      this.progressContainer.addEventListener('mouseleave', () => {
        if (this.progressTooltip) this.progressTooltip.style.display = 'none';
      });
    }

    // Volume
    if (this.volumeSlider) {
      this.volumeSlider.addEventListener('input', (e) => this.setVolume(parseFloat(e.target.value)));
    }
    if (this.volumeBtn) {
      this.volumeBtn.addEventListener('click', () => this.toggleMute());
    }

    // Speed Menu
    if (this.speedBtn && this.speedMenu) {
      this.speedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.speedMenu.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!this.speedMenu.contains(e.target) && e.target !== this.speedBtn) {
          this.speedMenu.classList.remove('show');
        }
      });

      this.speedMenu.querySelectorAll('.speed-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const speed = parseFloat(btn.dataset.speed);
          this.video.playbackRate = speed;
          if (this.speedLabel) this.speedLabel.textContent = speed + 'x';
          this.speedMenu.querySelectorAll('.speed-option').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.speedMenu.classList.remove('show');
          this.triggerFeedback(`${speed}x Speed`);
        });
      });
    }

    // Picture-in-Picture
    if ('pictureInPictureEnabled' in document && this.pipBtn) {
      this.pipBtn.addEventListener('click', async () => {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else {
            await this.video.requestPictureInPicture();
          }
        } catch (err) {
          console.error(err);
        }
      });
    } else if (this.pipBtn) {
      this.pipBtn.style.display = 'none';
    }

    // Theater Mode
    if (this.theaterBtn) {
      this.theaterBtn.addEventListener('click', () => this.toggleTheaterMode());
    }

    // Fullscreen
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        if (this.fullscreenIcon) this.fullscreenIcon.style.display = 'none';
        if (this.exitFullscreenIcon) this.exitFullscreenIcon.style.display = 'block';
      } else {
        if (this.fullscreenIcon) this.fullscreenIcon.style.display = 'block';
        if (this.exitFullscreenIcon) this.exitFullscreenIcon.style.display = 'none';
      }
    });

    // Auto-hide controls
    this.wrapper.addEventListener('mousemove', () => {
      this.showControls();
      if (!this.video.paused) {
        this.startHideControlsTimer();
      }
    });

    this.wrapper.addEventListener('mouseleave', () => {
      if (!this.video.paused) {
        this.hideControls();
      }
    });

    // Mobile touch controls
    this.wrapper.addEventListener('touchstart', (e) => {
      if (e.target.closest('#playerControls')) return;
      if (this.wrapper.classList.contains('user-active') && !this.video.paused) {
        this.hideControls();
      } else {
        this.showControls();
        if (!this.video.paused) {
          this.startHideControlsTimer();
        }
      }
    }, { passive: true });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          this.togglePlay(true);
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          this.seekBy(-10);
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          this.seekBy(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.setVolume(Math.min(1, (this.video.volume || 0) + 0.05));
          this.triggerFeedback(`${Math.round(this.video.volume * 100)}% Vol`);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.setVolume(Math.max(0, (this.video.volume || 0) - 0.05));
          this.triggerFeedback(`${Math.round(this.video.volume * 100)}% Vol`);
          break;
        case 'KeyM':
          e.preventDefault();
          this.toggleMute(true);
          break;
        case 'KeyT':
          e.preventDefault();
          this.toggleTheaterMode();
          break;
        case 'KeyF':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        default:
          // Numeric keys 0-9 to jump to percentage
          if (e.code.startsWith('Digit')) {
            const digit = parseInt(e.code.replace('Digit', ''), 10);
            if (!isNaN(digit) && this.video.duration) {
              e.preventDefault();
              this.video.currentTime = (digit / 10) * this.video.duration;
              this.triggerFeedback(`${digit * 10}%`);
            }
          }
          break;
      }
    });
  }

  showSpinner() {
    if (this.wrapper) this.wrapper.classList.add('buffering');
  }

  hideSpinner() {
    if (this.wrapper) this.wrapper.classList.remove('buffering');
  }

  triggerFeedback(text, iconHtml = '') {
    if (!this.quickFeedback) return;
    clearTimeout(this.quickFeedbackTimeout);
    if (this.quickFeedbackIcon) this.quickFeedbackIcon.innerHTML = iconHtml;
    if (this.quickFeedbackText) this.quickFeedbackText.textContent = text;
    this.quickFeedback.classList.add('active');
    this.quickFeedbackTimeout = setTimeout(() => {
      this.quickFeedback.classList.remove('active');
    }, 550);
  }

  togglePlay(withFeedback = false) {
    if (this.video.paused) {
      this.video.play();
      if (withFeedback) this.triggerFeedback('Play', '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>');
    } else {
      this.video.pause();
      if (withFeedback) this.triggerFeedback('Pause', '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>');
    }
  }

  seekBy(deltaSeconds) {
    if (!this.video.duration) return;
    this.video.currentTime = Math.max(0, Math.min(this.video.duration, this.video.currentTime + deltaSeconds));
    const prefix = deltaSeconds > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`;
    this.triggerFeedback(prefix);
  }

  toggleTheaterMode() {
    const container = document.querySelector('.watch-container');
    if (!container) return;
    const isTheater = container.classList.toggle('theater-mode');
    localStorage.setItem('flimview_theater', isTheater ? 'true' : 'false');
    this.triggerFeedback(isTheater ? 'Theater On' : 'Theater Off');
  }

  onTimeUpdate() {
    if (!this.isScrubbing && this.video.duration) {
      const progress = (this.video.currentTime / this.video.duration) * 100;
      if (this.progressBarFill) this.progressBarFill.style.width = progress + '%';
      if (this.progressScrubber) this.progressScrubber.style.left = progress + '%';
      this.updateTimeDisplay();
    }
  }

  onBufferProgress() {
    if (this.video.duration && this.video.buffered.length > 0) {
      const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
      const bufferPercent = (bufferedEnd / this.video.duration) * 100;
      if (this.progressBarBuffer) this.progressBarBuffer.style.width = bufferPercent + '%';
    }
  }

  updateTimeDisplay() {
    if (!this.timeDisplay) return;
    const cur = this.formatTime(this.video.currentTime || 0);
    const dur = this.formatTime(this.video.duration || 0);
    this.timeDisplay.textContent = `${cur} / ${dur}`;
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getClientX(e) {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return e.clientX;
  }

  startScrubbing(e) {
    if (!this.video.duration) return;
    this.isScrubbing = true;
    this.wasPlayingBeforeScrub = !this.video.paused;
    this.scrub(e);
  }

  scrub(e) {
    if (!this.isScrubbing || !this.video.duration) return;
    const rect = this.progressContainer.getBoundingClientRect();
    const clientX = this.getClientX(e);
    if (clientX === undefined) return;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (this.progressBarFill) this.progressBarFill.style.width = (pos * 100) + '%';
    if (this.progressScrubber) this.progressScrubber.style.left = (pos * 100) + '%';
    this.video.currentTime = pos * this.video.duration;
    this.updateTimeDisplay();
  }

  stopScrubbing() {
    if (!this.isScrubbing) return;
    this.isScrubbing = false;
    if (this.wasPlayingBeforeScrub) {
      this.video.play().catch(() => {});
    }
  }

  updateTooltip(e) {
    if (!this.video.duration || !this.progressTooltip) return;
    const rect = this.progressContainer.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * this.video.duration;

    this.progressTooltip.textContent = this.formatTime(targetTime);
    this.progressTooltip.style.left = `${pos * 100}%`;
    this.progressTooltip.style.display = 'block';
  }

  setVolume(val) {
    const clamped = Math.max(0, Math.min(1, val));
    this.video.volume = clamped;
    this.video.muted = clamped === 0;
    if (this.volumeSlider) this.volumeSlider.value = clamped;
    if (clamped > 0) {
      this.lastVolume = clamped;
      localStorage.setItem('flimview_volume', clamped);
    }
    this.updateVolumeIcons();
  }

  toggleMute(withFeedback = false) {
    if (this.video.muted || this.video.volume === 0) {
      this.video.muted = false;
      const target = this.lastVolume > 0 ? this.lastVolume : 1;
      this.video.volume = target;
      if (this.volumeSlider) this.volumeSlider.value = target;
      if (withFeedback) this.triggerFeedback(`${Math.round(target * 100)}% Vol`);
    } else {
      this.lastVolume = this.video.volume;
      this.video.muted = true;
      this.video.volume = 0;
      if (this.volumeSlider) this.volumeSlider.value = 0;
      if (withFeedback) this.triggerFeedback('Muted');
    }
    this.updateVolumeIcons();
  }

  updateVolumeIcons() {
    const isMuted = this.video.muted || this.video.volume === 0;
    if (this.volumeHighIcon) this.volumeHighIcon.style.display = isMuted ? 'none' : 'block';
    if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = isMuted ? 'block' : 'none';
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.wrapper.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen().catch(err => console.error(err));
    }
  }

  showControls() {
    if (this.wrapper) this.wrapper.classList.add('user-active');
  }

  hideControls() {
    if (this.wrapper) this.wrapper.classList.remove('user-active');
  }

  startHideControlsTimer() {
    clearTimeout(this.hideControlsTimeout);
    this.hideControlsTimeout = setTimeout(() => {
      if (!this.video.paused) {
        this.hideControls();
      }
    }, 2500);
  }

  loadSource(src) {
    this.showSpinner();
    this.video.src = src;
    this.video.load();
  }
}
