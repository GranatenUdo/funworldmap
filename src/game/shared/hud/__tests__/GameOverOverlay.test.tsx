import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { GameOverOverlay } from '../GameOverOverlay'
import { makeSession, makeCountryRound, makeOutcome, makeCountryReveal } from '../../__tests__/factories'
import type { ResultReceipt } from '../../personalBestsStore'
afterEach(cleanup)
const best = { bestScore: 100, bestStreak: 1, gamesPlayed: 2 }
const receipt: ResultReceipt = {previous:{...best,bestScore:50},current:best,firstResult:false,newBest:true,saved:true}
const record = {round:makeCountryRound(),input:{kind:'country' as const,cca3:'FRA',name:'France',centroid:[0,0] as [number,number]},outcome:makeOutcome(makeCountryReveal({correct:true,distanceKm:0}),true)}
const session = makeSession({status:'game-over',score:100,bestStreak:1,completedRounds:[record]})
const props = {session, personalBest:best,beatPersonalBest:false,receipt,onPlayAgain:vi.fn(),onBackToMap:vi.fn()}
describe('results and review', () => {
 it('shows meaningful country statistics and a stable result receipt', () => {
  const {rerender} = render(<GameOverOverlay {...props} />)
  expect(screen.getByText('100%')).toBeTruthy()
  expect(screen.getByText('1 · 1 correct')).toBeTruthy()
  expect(screen.getByTestId('game-over-pb').textContent).toContain('New personal best!')
  rerender(<GameOverOverlay {...props} personalBest={{...best,bestScore:200}} />)
  expect(screen.getByTestId('game-over-pb').textContent).toContain('New personal best!')
 })
 it('contains keyboard focus and initially focuses replay', () => {
  render(<GameOverOverlay {...props} />)
  const replay = screen.getByRole('button',{name:'Play again'})
  const back = screen.getByRole('button',{name:'Explore the map'})
  expect(document.activeElement).toBe(replay)
  back.focus(); fireEvent.keyDown(back,{key:'Tab'})
  expect(document.activeElement).toBe(replay)
  fireEvent.keyDown(replay,{key:'Tab',shiftKey:true})
  expect(document.activeElement).toBe(back)
 })
 it('uses a nonmodal map-accessible review and does not record or alter the session', () => {
  const onReview = vi.fn()
  render(<GameOverOverlay {...props} reviewIndex={0} onReview={onReview} />)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('region',{name:'Review your answers'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Back to results'}))
  expect(onReview).toHaveBeenCalledWith(null)
  expect(session.status).toBe('game-over')
  expect(session.score).toBe(100)
 })
 it('shows first-result and storage-failure copy without claiming a saved best', () => {
  render(<GameOverOverlay {...props} receipt={{...receipt,firstResult:true,newBest:false,saved:false}} />)
  expect(screen.getByTestId('game-over-pb').textContent).toContain('Your first result!')
  expect(screen.getByTestId('game-over-pb').textContent).toContain('Could not save')
 })
 it('handles empty runs without NaN or a review affordance', () => {
  render(<GameOverOverlay {...props} session={makeSession({status:'game-over',endedEarly:true})} onReview={vi.fn()} />)
  expect(screen.getByText('No guesses made')).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Review answers on the map'})).toBeNull()
  expect(screen.getByText('Game ended early.')).toBeTruthy()
 })
 it('activates replay and exploration separately', () => {
  render(<GameOverOverlay {...props} />)
  fireEvent.click(screen.getByRole('button',{name:'Play again'}))
  expect(props.onPlayAgain).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button',{name:'Explore the map'}))
  expect(props.onBackToMap).toHaveBeenCalledTimes(1)
 })
})

it('prefers the replay action even when Review appears earlier in DOM order', () => {
  render(<GameOverOverlay {...props} onReview={vi.fn()} />)
  expect(document.activeElement).toBe(screen.getByRole('button',{name:'Play again'}))
})
