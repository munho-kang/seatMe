import type { ReactNode } from 'react'
import closeIcon from '../assets/icon-close.svg'
import './Sheet.css'

type SheetProps = {
  title: string
  className?: string
  onClose: () => void
  children: ReactNode
}

function Sheet({ title, className, onClose, children }: SheetProps) {
  return (
    <section role="dialog" aria-label={title} className={['sheet', className].filter(Boolean).join(' ')}>
      <header className="sheet-header">
        <h2 className="sheet-title">{title}</h2>
        <button type="button" className="sheet-close" aria-label="닫기" onClick={onClose}>
          <img src={closeIcon} alt="" width={24} height={24} />
        </button>
      </header>
      {children}
    </section>
  )
}

export default Sheet
