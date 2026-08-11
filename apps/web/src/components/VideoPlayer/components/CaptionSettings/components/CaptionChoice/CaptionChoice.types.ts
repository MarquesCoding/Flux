type CaptionChoiceOption = {
  id: string
  label: string
}

type CaptionChoiceProps = {
  label: string
  options: readonly CaptionChoiceOption[]
  selectedId: string
  onSelect: (id: string) => void
}

export type { CaptionChoiceOption, CaptionChoiceProps }
