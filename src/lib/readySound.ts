// 🔔 Singleton audio per notifica "ordine pronto" — usato SOLO in Sala TV.
// Non tocca ordini, Firestore, stampa, pagamento o beeper.

let audio: HTMLAudioElement | null = null;
let unlocked = false;

const ensureAudio = (): HTMLAudioElement => {
  if (!audio) {
    audio = new Audio("/sounds/ready.mp3");
    audio.volume = 1;
    audio.preload = "auto";
  }
  return audio;
};

/** Sblocca l'audio dopo la prima interazione utente (autoplay policy). */
export const unlockReadySound = async (): Promise<boolean> => {
  const a = ensureAudio();
  try {
    a.muted = true;
    await a.play();
    a.pause();
    a.currentTime = 0;
    a.muted = false;
    unlocked = true;
    return true;
  } catch {
    unlocked = false;
    return false;
  }
};

export const isReadySoundUnlocked = () => unlocked;

export const playReadySound = (): void => {
  const a = ensureAudio();
  try {
    a.currentTime = 0;
  } catch {}
  a.play().catch(() => {});
};
