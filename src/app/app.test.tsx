import { render, screen } from '@testing-library/preact'
import { App } from '../app'

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByText('الراسي · A-Rrasi')).toBeDefined()
  })
})
