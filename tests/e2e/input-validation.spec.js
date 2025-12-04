/**
 * Test Case: TT-16
 * Verify input validation handles edge cases
 * Verifies: TT-6 (User input is validated before backend processing)
 */

describe('TT-16: Verify input validation handles edge cases', () => {
  beforeEach(async () => {
    // Clear any previous input
    const nameInput = await $('input[type="text"], input#greet-input, input[placeholder*="name" i]');
    await nameInput.clearValue();
  });

  it('should handle empty input gracefully', async () => {
    // Step 1: Submit form with empty input
    const nameInput = await $('input[type="text"], input#greet-input, input[placeholder*="name" i]');
    const greetButton = await $('button[type="submit"]');

    await nameInput.setValue('');
    await greetButton.click();

    // Application should handle gracefully, no crash
    // Check app is still responsive
    await expect(nameInput).toBeDisplayed();

    await browser.saveScreenshot('./test-results/evidence/TT-16-empty-input.png');
  });

  it('should handle special characters without script execution', async () => {
    // Step 2: Clear and enter special characters
    const nameInput = await $('input[type="text"], input#greet-input, input[placeholder*="name" i]');
    const greetButton = await $('button[type="submit"]');

    const xssPayload = "<script>alert('xss')</script>";
    await nameInput.setValue(xssPayload);
    await greetButton.click();

    // Wait for response
    await browser.pause(1000);

    // Check that the app didn't execute script (still responsive)
    await expect(nameInput).toBeDisplayed();

    // If greeting appears, it should show literal text, not execute
    const greeting = await $('p');
    if (await greeting.isDisplayed()) {
      const text = await greeting.getText();
      // Should not have executed - if it did, we'd see alert or crash
      expect(text).not.toContain('undefined');
    }

    await browser.saveScreenshot('./test-results/evidence/TT-16-special-chars.png');
  });

  it('should handle very long input appropriately', async () => {
    // Step 3: Clear and enter very long input
    const nameInput = await $('input[type="text"], input#greet-input, input[placeholder*="name" i]');
    const greetButton = await $('button[type="submit"]');

    const longInput = 'A'.repeat(1000);
    await nameInput.setValue(longInput);
    await greetButton.click();

    // Application should handle without crash
    await browser.pause(1000);
    await expect(nameInput).toBeDisplayed();

    await browser.saveScreenshot('./test-results/evidence/TT-16-long-input.png');
  });

  it('should handle unicode characters correctly', async () => {
    // Step 4 & 5: Clear and enter unicode characters, verify greeting
    const nameInput = await $('input[type="text"], input#greet-input, input[placeholder*="name" i]');
    const greetButton = await $('button[type="submit"]');

    const unicodeInput = 'José María 日本語';
    await nameInput.setValue(unicodeInput);
    await greetButton.click();

    // Wait for greeting response (paragraph after form contains the greeting)
    const greetingMessage = await $('form + p');
    await browser.waitUntil(
      async () => {
        const text = await greetingMessage.getText();
        return text.includes('Hello');
      },
      { timeout: 5000, timeoutMsg: 'Greeting message did not appear' }
    );

    // Verify greeting displays unicode characters properly
    const messageText = await greetingMessage.getText();
    expect(messageText).toContain('José María 日本語');

    await browser.saveScreenshot('./test-results/evidence/TT-16-unicode.png');
  });
});
