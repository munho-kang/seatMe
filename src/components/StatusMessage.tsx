import type { ReactNode } from 'react'
import './StatusMessage.css'

type StatusMessageProps = {
  icon: string
  title: string
  description: string
  children: ReactNode
}

function StatusMessage({ icon, title, description, children }: StatusMessageProps) {
  return (
    <div className="status-message">
      <span className="status-message-badge">
        <img src={icon} alt="" width={40} height={40} />
      </span>
      <div className="status-message-text">
        <p className="status-message-title">{title}</p>
        <p>{description}</p>
      </div>
      <div className="status-message-actions">{children}</div>
    </div>
  )
}

export default StatusMessage
