type MeterProps = {
  label: string
  /**
   * How full it is, between nothing and everything.
   */
  fraction: number
  /**
   * What the number actually is, in words a person reads.
   *
   * Kept separate from the fraction because "3.4 GB of 48 GB" and "0.07" are
   * the same fact told to different audiences.
   */
  value: string
  className?: string
}

export type { MeterProps }
