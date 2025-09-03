import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriorityBadge } from '../TodoCard'

describe('PriorityBadge', () => {
  it('renders all priority variants', () => {
    const variants: any[] = ['low','normal','high','urgent']
    variants.forEach(p => {
      render(<PriorityBadge priority={p} />)
      expect(screen.getByText(p)).toBeInTheDocument()
    })
  })
})
