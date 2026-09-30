import type { ReactNode } from 'react'
import './SelectableCard.css'

type SelectableCardProps = {
  isSelected: boolean
  onSelect: () => void
  className?: string
  children: ReactNode
}

function SelectableCard({ isSelected, onSelect, className, children }: SelectableCardProps) {
  const classes = ['selectable-card', isSelected && 'selectable-card--selected', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={classes} aria-pressed={isSelected} onClick={onSelect}>
      {children}
    </button>
  )
}

export default SelectableCard
