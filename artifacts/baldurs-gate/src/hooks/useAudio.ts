import { useEffect, useRef } from 'react';

/**
 * Простая система управления звуками для игры.
 * Использует стандартный Web Audio API или HTML5 Audio.
 */

const SOUNDS = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  hit: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  miss: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
  magic: 'https://assets.mixkit.co/active_storage/sfx/2580/2580-preview.mp3',
  levelUp: 'https://assets.mixkit.co/active_storage/sfx/2582/2582-preview.mp3',
  menuMusic: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c3e6629705.mp3', // Melancholic Fantasy Strings
  exploreMusic: 'https://cdn.pixabay.com/audio/2023/05/15/audio_4078512f45.mp3', // Mystical Adventure
  combatMusic: 'https://cdn.pixabay.com/audio/2022/02/22/audio_d0b677a42b.mp3', // Epic War Drums & Brass
};

type SoundName = keyof typeof SOUNDS;

class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private currentMusic: HTMLAudioElement | null = null;
  private masterVolume: number = 0.5;

  private constructor() {
    if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
  }

  static getInstance() {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async playSFX(name: SoundName) {
    if (!this.audioContext) return;
    await this.resume();

    try {
      const url = SOUNDS[name];
      let buffer = this.buffers.get(url);

      if (!buffer) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        buffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.buffers.set(url, buffer);
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = this.masterVolume;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      source.start(0);
    } catch (e) {
      console.warn(`Failed to play sound: ${name}`, e);
    }
  }

  async playMusic(name: SoundName) {
    await this.resume();
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic = null;
    }

    const audio = new Audio(SOUNDS[name]);
    audio.loop = true;
    audio.volume = this.masterVolume * 0.5;
    audio.play().catch(e => console.warn("Music autoplay blocked", e));
    this.currentMusic = audio;
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic = null;
    }
  }

  setVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.currentMusic) {
      this.currentMusic.volume = this.masterVolume * 0.5;
    }
  }
}

export const audioManager = AudioManager.getInstance();

export const useAudio = () => {
  return {
    playSFX: (name: SoundName) => audioManager.playSFX(name),
    playMusic: (name: SoundName) => audioManager.playMusic(name),
    stopMusic: () => audioManager.stopMusic(),
    setVolume: (val: number) => audioManager.setVolume(val),
    resume: () => audioManager.resume(),
  };
};
