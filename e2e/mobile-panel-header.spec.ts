import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForAnimationIdle } from './helpers'

for(const width of [360,375,414]) {
  test(`mobile details keep name, facts and actions usable at ${width}px`,async ({page}) => {
    await page.setViewportSize({width,height:667})
    await gotoAndWaitForMap(page,'/#FRA')
    const panel=page.getByTestId('country-panel')
    await waitForAnimationIdle(panel)
    const title=panel.getByRole('heading',{name:'France',exact:true})
    expect(await title.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false)
    await expect(page.getByRole('button',{name:'Compare with another country'})).toBeVisible()
    await expect(page.getByRole('button',{name:'Copy link to this country'})).toBeVisible()
    await page.getByRole('button',{name:'View map',exact:true}).click()
    await expect(panel).toBeHidden()
    await page.getByRole('button',{name:'View details',exact:true}).click()
    await expect(panel.getByText('Currencies',{exact:true})).toBeVisible()
    await page.getByTestId('panel-close').click()
    await expect(panel).not.toBeAttached()
  })
}

test('mobile comparison keeps explicit map access',async ({page}) => {
  await page.setViewportSize({width:390,height:844})
  await gotoAndWaitForMap(page,'/#FRA,DEU')
  await expect(page.getByRole('complementary',{name:'Country comparison'})).toBeVisible()
  await page.getByRole('button',{name:'View map',exact:true}).click()
  await expect(page.getByTestId('country-panel')).toBeHidden()
  await page.getByRole('button',{name:'View details',exact:true}).click()
  await expect(page.getByTestId('country-panel')).toBeVisible()
  await expect(page).toHaveURL(/#FRA,DEU$/)
})
