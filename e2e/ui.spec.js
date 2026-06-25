// @ts-check
const { test, expect } = require('@playwright/test')

async function enterName(page, name) {
  await page.getByLabel('Your name').fill(name)
  await page.getByRole('button', { name: 'Enter Room' }).click()
}

test('lobby → create room → name entry → vote → reveal, synced across two participants', async ({ browser }) => {
  const aliceContext = await browser.newContext()
  const alice = await aliceContext.newPage()

  await alice.goto('/')
  await alice.getByRole('button', { name: 'Create Room' }).click()
  await enterName(alice, 'Alice')

  await expect(alice.getByText('Connecting…')).toHaveCount(0, { timeout: 10000 })
  const roomUrl = alice.url()

  const bobContext = await browser.newContext()
  const bob = await bobContext.newPage()
  await bob.goto(roomUrl)
  await enterName(bob, 'Bob')
  await expect(bob.getByRole('heading', { name: 'Participants' })).toBeVisible({ timeout: 10000 })
  await expect(bob.getByText('Alice')).toBeVisible({ timeout: 10000 })

  // Alice sees Bob join.
  await expect(alice.getByText('Bob')).toBeVisible({ timeout: 10000 })

  // Bob casts a vote.
  await bob.getByRole('button', { name: 'Vote 5' }).click()

  // Alice (moderator) sees Bob's voted indicator and reveals.
  await expect(alice.getByTitle('Vote submitted')).toBeVisible({ timeout: 10000 })
  await alice.getByRole('button', { name: /reveal cards/i }).click()

  // Both should see the revealed value.
  await expect(alice.getByText('5', { exact: true }).first()).toBeVisible({ timeout: 10000 })
  await expect(bob.getByText(/consensus/i)).toBeVisible({ timeout: 10000 })

  // Bob is not the moderator and should not see Reveal/Reset controls.
  await expect(bob.getByRole('button', { name: /reveal/i })).toHaveCount(0)

  await aliceContext.close()
  await bobContext.close()
})

// Regression test for #14 (reconnect/rejoin): force-close the real
// WebSocket connection via page.routeWebSocket (transparent passthrough
// until we deliberately sever it) — context.setOffline() was tried first
// but doesn't reliably/quickly kill an already-open WebSocket, since
// there's no aggressive keepalive to detect the drop. This exercises the
// actual useWebSocketRoom hook's reconnect-with-backoff against the real
// deployed backend, not a mock, and confirms the UI recovers without a
// manual reload.
test('recovers from a dropped connection without a manual reload', async ({ page }) => {
  let clientSideRoute
  await page.routeWebSocket(/execute-api/, ws => {
    clientSideRoute = ws
    ws.connectToServer() // transparent passthrough until we close it below
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Create Room' }).click()
  await enterName(page, 'Alice')
  // Voting cards render with the default deck regardless of whether
  // ROOM_STATE has actually arrived, so they're not proof of a completed
  // join — wait for the participant list (only populated by ROOM_STATE)
  // to confirm the connection is fully established before severing it.
  await expect(page.getByText('Alice (you)')).toBeVisible({ timeout: 10000 })

  await clientSideRoute.close({ code: 1006 })
  await expect(page.getByText('Connecting…')).toBeVisible({ timeout: 10000 })

  // Reconnect-with-backoff should bring it back on its own.
  await expect(page.getByText('Connecting…')).toHaveCount(0, { timeout: 15000 })
  // Room is usable again — voting cards still present, no full page reload needed.
  await expect(page.getByRole('button', { name: 'Vote 5' })).toBeVisible()
})
