/**
 * Test Case: TT-14
 * Verify complete greeting workflow
 * Verifies: TT-1 (User can enter name and receive personalized greeting)
 *           TT-3 (Submit button triggers Rust backend command via IPC)
 *           TT-4 (Application displays greeting response to user)
 */

describe('TT-14: Verify complete greeting workflow', () => {
  it('should complete the greeting workflow end-to-end', async () => {
    // Step 1: Locate the name input field
    const nameInput = await $('input[type="text"], input#greet-input, input[placeholder*="name" i]');
    await expect(nameInput).toBeDisplayed();
    await expect(nameInput).toBeEnabled();

    // Step 2: Enter a name in the input field
    const testName = 'TestUser';
    await nameInput.setValue(testName);
    await expect(nameInput).toHaveValue(testName);

    // Step 3: Click the Greet button
    const greetButton = await $('button[type="submit"]');
    await expect(greetButton).toBeDisplayed();
    await greetButton.click();

    // Step 4: Wait for greeting response (paragraph after form contains the greeting)
    const greetingMessage = await $('form + p');
    await browser.waitUntil(
      async () => {
        const text = await greetingMessage.getText();
        return text.includes('Hello');
      },
      { timeout: 5000, timeoutMsg: 'Greeting message did not appear' }
    );

    // Step 5: Verify greeting message content
    const messageText = await greetingMessage.getText();
    expect(messageText).toContain('Hello, TestUser!');
    expect(messageText).toContain("You've been greeted from Rust!");

    // Step 6: Capture screenshot evidence
    await browser.saveScreenshot('./test-results/evidence/TT-14-greeting-workflow.png');
  });
});
