import type { ButtonHTMLAttributes } from 'react'
import './Button.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'tonal'
  size?: 'lg' | 'md' | 'sm'
}

function Button({ variant = 'primary', size = 'lg', type = 'button', className, ...props }: ButtonProps) {
  const classes = ['button', `button--${variant}`, `button--${size}`, className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...props} />
}

export default Button
