type AdminMessageOverlayProps = {
  /**
   * Stopped blocks the whole stage and only offers a way out: the stream is
   * gone. Paused is a lighter banner, because the picture is still there and
   * a viewer can simply press play again.
   */
  kind: 'stopped' | 'paused'
  reason: string
  onDismiss: () => void
}

export type { AdminMessageOverlayProps }
