/**
 * Test Case: TT-15
 * Verify external documentation links
 * Verifies: TT-5 (Logo links open documentation in default browser)
 */

describe('TT-15: Verify external documentation links', () => {
  it('should have correct external links for documentation', async () => {
    // Step 1: Locate the Tauri logo link
    const tauriLink = await $('a[href*="tauri.app"]');
    await expect(tauriLink).toBeDisplayed();
    await expect(tauriLink).toBeClickable();

    // Step 2: Verify Tauri logo has correct href
    const tauriHref = await tauriLink.getAttribute('href');
    expect(tauriHref).toContain('https://tauri.app');

    // Step 3: Locate the React logo link
    const reactLink = await $('a[href*="react.dev"]');
    await expect(reactLink).toBeDisplayed();
    await expect(reactLink).toBeClickable();

    // Step 4: Verify React logo has correct href
    const reactHref = await reactLink.getAttribute('href');
    expect(reactHref).toContain('https://react.dev');

    // Step 5: Verify links have security attributes
    const tauriTarget = await tauriLink.getAttribute('target');
    const reactTarget = await reactLink.getAttribute('target');
    expect(tauriTarget).toBe('_blank');
    expect(reactTarget).toBe('_blank');

    // Note: Actually clicking external links would open browser
    // which is tested manually or via integration tests

    // Step 6: Verify application remains responsive
    const header = await $('h1');
    await expect(header).toBeDisplayed();

    // Capture evidence
    await browser.saveScreenshot('./test-results/evidence/TT-15-external-links.png');
  });
});
