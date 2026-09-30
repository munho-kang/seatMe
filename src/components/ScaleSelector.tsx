import './ScaleSelector.css'

const SCALE_VALUES = [1, 2, 3, 4, 5]

type ScaleSelectorProps = {
  label: string
  value?: number
  onChange: (value: number) => void
}

function ScaleSelector({ label, value, onChange }: ScaleSelectorProps) {
  return (
    <div className="scale-selector" role="radiogroup" aria-label={label}>
      {SCALE_VALUES.map((scale) => (
        <button
          key={scale}
          type="button"
          role="radio"
          aria-checked={value === scale}
          className={`scale-chip${value === scale ? ' scale-chip--selected' : ''}`}
          onClick={() => onChange(scale)}
        >
          {scale}
        </button>
      ))}
    </div>
  )
}

export default ScaleSelector
