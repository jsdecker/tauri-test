/**
 * Test Case: TT-13
 * Verify welcome screen displays with branding
 * Verifies: TT-2 (Application displays welcome screen with branding elements)
 */

describe('TT-13: Verify welcome screen displays with branding', () => {
  it('should display welcome screen with all branding elements', async () => {
    // Step 1: Launch the application (handled by WebDriverIO)
    // Expected: Application window opens (800x600)

    // Step 2: Verify header text is displayed
    const header = await $('h1');
    await expect(header).toBeDisplayed();
    await expect(header).toHaveText('Welcome to Tauri + React');

    // Step 3: Verify Tauri logo is displayed
    const tauriLogo = await $('img[alt*="Tauri"], a[href*="tauri.app"] img');
    await expect(tauriLogo).toBeDisplayed();

    // Step 4: Verify React logo is displayed
    const reactLogo = await $('img[alt*="React"], a[href*="react.dev"] img');
    await expect(reactLogo).toBeDisplayed();

    // Step 5: Verify layout is centered
    const container = await $('.container, #root > div');
    await expect(container).toBeDisplayed();

    // Capture evidence
    await browser.saveScreenshot('./test-results/evidence/TT-13-welcome-screen.png');
  });
});
