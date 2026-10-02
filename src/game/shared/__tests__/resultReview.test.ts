import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { recordResult, __resetForTests } from '../personalBestsStore'
import { summarizeRounds } from '../summarizeRounds'
import { makeCityRound, makeOutcome, makePointReveal } from './factories'
beforeEach(() => {localStorage.clear(); __resetForTests()})
afterEach(() => vi.restoreAllMocks())
it('excludes skip sentinel distances and counts actual records', () => {
 const round = makeCityRound()
 const summary = summarizeRounds([
  {round,input:{kind:'skip'},outcome:makeOutcome(makePointReveal({distanceKm:20015,clickedPoint:null}))},
  {round,input:{kind:'point',lngLat:[0,0]},outcome:makeOutcome(makePointReveal({distanceKm:400}))},
 ])
 expect(summary).toMatchObject({answered:1,skipped:1,averageDistance:400})
 expect(summarizeRounds([])).toMatchObject({answered:0,accuracy:null,averageDistance:null})
})
it('keeps an immutable first-result receipt and exposes failed persistence', () => {
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw new Error('quota')})
 const receipt = recordResult('city-guessing',25,0)
 expect(receipt).toMatchObject({firstResult:true,saved:false,newBest:false,previous:{gamesPlayed:0}})
 recordResult('city-guessing',100,0)
 expect(receipt.current.bestScore).toBe(25)
 expect(receipt.current.gamesPlayed).toBe(1)
})
