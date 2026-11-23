// ==========================================================================
// CHEIRON AUDIO MANAGER
// Sound effects engine for round winning and round losing feedback
// ==========================================================================

class SoundManager {
    private winAudio: HTMLAudioElement | null = null;
    private lossAudio: HTMLAudioElement | null = null;
    private volume: number = 0.75;
    private isMuted: boolean = false;
    private isUnlocked: boolean = false;

    constructor() {
        if (typeof window !== "undefined") {
            try {
                const savedVol = localStorage.getItem("cheiron_sfx_volume");
                if (savedVol !== null) {
                    const parsed = parseFloat(savedVol);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
                        this.volume = parsed;
                    }
                }
                const savedMute = localStorage.getItem("cheiron_sfx_muted");
                if (savedMute !== null) {
                    this.isMuted = savedMute === "true";
                }
            } catch {
                // Storage access fallback
            }

            this.initAudio();
            this.setupUnlockListeners();
        }
    }

    private initAudio() {
        try {
            this.winAudio = new Audio("/sounds/round-win.wav");
            this.winAudio.preload = "auto";

            this.lossAudio = new Audio("/sounds/round-loss.wav");
            this.lossAudio.preload = "auto";

            this.applyVolume();
        } catch (error) {
            console.warn("Audio initialization warning:", error);
        }
    }

    private setupUnlockListeners() {
        // Unlock HTML5 audio on first user gesture
        const unlock = () => {
            if (this.isUnlocked) return;
            this.isUnlocked = true;

            [this.winAudio, this.lossAudio].forEach((audio) => {
                if (audio) {
                    const originalVol = audio.volume;
                    audio.volume = 0;
                    audio
                        .play()
                        .then(() => {
                            audio.pause();
                            audio.currentTime = 0;
                            audio.volume = originalVol;
                        })
                        .catch(() => {});
                }
            });

            window.removeEventListener("click", unlock);
            window.removeEventListener("keydown", unlock);
            window.removeEventListener("touchstart", unlock);
        };

        window.addEventListener("click", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        window.addEventListener("touchstart", unlock, { once: true });
    }

    private applyVolume() {
        const effectiveVol = this.isMuted ? 0 : this.volume;
        if (this.winAudio) this.winAudio.volume = effectiveVol;
        if (this.lossAudio) this.lossAudio.volume = effectiveVol;
    }

    public playRoundWin() {
        if (this.isMuted || this.volume === 0) return;
        try {
            if (!this.winAudio) this.initAudio();
            if (this.winAudio) {
                this.winAudio.currentTime = 0;
                this.applyVolume();
                this.winAudio.play().catch((err) => {
                    console.debug("Audio play blocked by browser policy:", err);
                });
            }
        } catch {}
    }

    public playRoundLoss() {
        if (this.isMuted || this.volume === 0) return;
        try {
            if (!this.lossAudio) this.initAudio();
            if (this.lossAudio) {
                this.lossAudio.currentTime = 0;
                this.applyVolume();
                this.lossAudio.play().catch((err) => {
                    console.debug("Audio play blocked by browser policy:", err);
                });
            }
        } catch {}
    }

    public setVolume(val: number) {
        this.volume = Math.max(0, Math.min(1, val));
        try {
            localStorage.setItem("cheiron_sfx_volume", this.volume.toString());
        } catch {}
        this.applyVolume();
    }

    public getVolume(): number {
        return this.volume;
    }

    public toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        try {
            localStorage.setItem("cheiron_sfx_muted", this.isMuted.toString());
        } catch {}
        this.applyVolume();
        return this.isMuted;
    }

    public getIsMuted(): boolean {
        return this.isMuted;
    }
}

export const soundManager = new SoundManager();
