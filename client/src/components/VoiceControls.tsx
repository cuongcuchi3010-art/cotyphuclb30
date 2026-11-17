import { useEffect } from 'react';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { joinVoice, leaveVoice, toggleMute, useVoice } from '../voice';
import { Btn } from './ui';

/** Nút voice chat: bật/tắt voice, tắt/bật mic */
export function VoiceControls() {
  const me = useStore((s) => s.me);
  const { on, muted, connecting, error } = useVoice();
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (error) {
      toast(error, 'error');
      useVoice.setState({ error: null });
    }
  }, [error, toast]);
  if (!me) return null;
  if (!on)
    return (
      <Btn
        variant="secondary"
        title={S.voice.hint}
        disabled={connecting}
        onClick={() => void joinVoice()}
      >
        🎙️ {connecting ? S.voice.connecting : S.voice.join}
      </Btn>
    );
  return (
    <>
      <Btn
        variant={muted ? 'danger' : 'secondary'}
        title={muted ? S.voice.unmute : S.voice.mute}
        onClick={toggleMute}
      >
        {muted ? '🔇' : '🎙️'}
      </Btn>
      <Btn variant="ghost" onClick={leaveVoice}>
        {S.voice.leave}
      </Btn>
    </>
  );
}
