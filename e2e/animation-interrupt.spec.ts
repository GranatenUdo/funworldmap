import { test, expect, type Page } from '@playwright/test'
import { gotoAndWaitForMap, waitForGameTestHook, getSession, submitAndWait } from './helpers'

async function start(page:Page) {
  await page.emulateMedia({reducedMotion:'no-preference'})
  await gotoAndWaitForMap(page,'/#game/country-pinning')
  await waitForGameTestHook(page)
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status','playing')
  const help=page.getByTestId('game-tutorial')
  if(await help.isVisible()) await help.getByRole('button',{name:'Got it'}).click()
  await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
  await expect(page.getByTestId('game-prompt-name')).toHaveText('France')
}

test('Next cleanly cancels an ordinary-motion reveal',async ({page}) => {
  await start(page)
  await submitAndWait(page,'DEU')
  await page.getByTestId('round-next').click()
  await expect.poll(async () => (await getSession(page)).status).toBe('playing')
  await expect(page.getByTestId('round-result')).not.toBeAttached()
})

for(const guess of ['FRA','DEU']) {
  test(`Escape during ${guess === 'FRA' ? 'correct' : 'wrong'} reveal requests exit without advancing`,async ({page}) => {
    await start(page)
    await submitAndWait(page,guess)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('end-game-confirm')).toBeVisible()
    await page.getByTestId('end-keep-playing').click()
    expect((await getSession(page)).status).toBe('round-ended')
    expect((await getSession(page)).roundIndex).toBe(0)
    await page.getByTestId('round-next').click()
    await expect.poll(async () => (await getSession(page)).status).toBe('playing')
  })
}
