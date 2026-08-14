type AdminMessageOverlayProps = {
  /**
   * Stopped blocks the whole stage and only offers a way out: the stream is
   * gone. Paused is a lighter banner, because the picture is still there and
   * a viewer can simply press play again. A message is lighter still — it
   * says something and changes nothing, so it sits over a film that is still
   * playing.
   */
  kind: 'stopped' | 'paused' | 'message';
  /**
   * What the admin said: why the stream stopped, why it paused, or the note
   * itself.
   */
  text: string;
  onDismiss: () => void;
};

export type { AdminMessageOverlayProps };
