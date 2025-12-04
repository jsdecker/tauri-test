/**
 * Sync test steps to Xray Test issues via GraphQL API.
 * Project: TT (tauri-test)
 * Version: v1.0.0
 *
 * Usage: XRAY_CLIENT_ID=xxx XRAY_CLIENT_SECRET=xxx node scripts/sync-test-steps.js
 */

const TEST_STEPS = {
  'TT-13': {
    name: 'Verify welcome screen displays with branding',
    steps: [
      { action: 'Launch the application', data: '', result: 'Application window opens (800x600)' },
      {
        action: 'Verify header text is displayed',
        data: '',
        result: '"Welcome to Tauri + React" text is visible',
      },
      { action: 'Verify Tauri logo is displayed', data: '', result: 'Tauri SVG logo is visible' },
      { action: 'Verify React logo is displayed', data: '', result: 'React SVG logo is visible' },
      {
        action: 'Verify layout is centered',
        data: '',
        result: 'Content is horizontally centered in window',
      },
    ],
  },
  'TT-14': {
    name: 'Verify complete greeting workflow',
    steps: [
      {
        action: 'Locate the name input field',
        data: '',
        result: 'Text input field is visible and enabled',
      },
      {
        action: 'Enter a name in the input field',
        data: 'TestUser',
        result: 'Input field displays "TestUser"',
      },
      { action: 'Click the Greet button', data: '', result: 'Button click is registered' },
      { action: 'Wait for greeting response', data: '', result: 'Response appears below the form' },
      {
        action: 'Verify greeting message content',
        data: '',
        result: 'Message displays "Hello, TestUser! You\'ve been greeted from Rust!"',
      },
      {
        action: 'Capture screenshot evidence',
        data: '',
        result: 'Screenshot saved showing successful greeting',
      },
    ],
  },
  'TT-15': {
    name: 'Verify external documentation links',
    steps: [
      {
        action: 'Locate the Tauri logo link',
        data: '',
        result: 'Tauri logo is visible and clickable',
      },
      {
        action: 'Verify Tauri logo has correct href',
        data: '',
        result: 'Link points to https://tauri.app',
      },
      {
        action: 'Locate the React logo link',
        data: '',
        result: 'React logo is visible and clickable',
      },
      {
        action: 'Verify React logo has correct href',
        data: '',
        result: 'Link points to https://react.dev',
      },
      { action: 'Click Tauri logo link', data: '', result: 'External browser opens tauri.app' },
      {
        action: 'Verify application remains open',
        data: '',
        result: 'Tauri application window still active',
      },
    ],
  },
  'TT-16': {
    name: 'Verify input validation handles edge cases',
    steps: [
      {
        action: 'Submit form with empty input',
        data: '"" (empty)',
        result: 'Application handles gracefully, no crash',
      },
      {
        action: 'Clear and enter special characters',
        data: "<script>alert('xss')</script>",
        result: 'Characters displayed literally, no script execution',
      },
      {
        action: 'Clear and enter very long input',
        data: '1000 character string',
        result: 'Application handles without crash',
      },
      {
        action: 'Clear and enter unicode characters',
        data: 'José María 日本語',
        result: 'Characters processed correctly in greeting',
      },
      {
        action: 'Verify greeting with unicode',
        data: '',
        result: 'Greeting displays unicode characters properly',
      },
    ],
  },
};

/**
 * Test Execution to Test Case mapping
 * Maps Test Execution keys to the Test Cases they should contain
 */
const TEST_EXECUTION_MAPPING = {
  'TT-17': ['TT-13'], // Welcome screen test
  'TT-18': ['TT-14'], // Greeting workflow test
  'TT-19': ['TT-15'], // External links test
  'TT-20': ['TT-16'], // Input validation test
};

async function main() {
  const clientId = process.env.XRAY_CLIENT_ID;
  const clientSecret = process.env.XRAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Missing XRAY_CLIENT_ID or XRAY_CLIENT_SECRET environment variables');
    console.error('   Usage: XRAY_CLIENT_ID=xxx XRAY_CLIENT_SECRET=xxx node scripts/sync-test-steps.js');
    process.exit(1);
  }

  console.log('🔐 Authenticating with Xray Cloud...');
  const token = await authenticate(clientId, clientSecret);
  console.log('✅ Authenticated\n');

  // Sync test steps for each test case
  for (const [testKey, testData] of Object.entries(TEST_STEPS)) {
    console.log(`📝 ${testKey}: ${testData.name}`);
    await updateTestSteps(token, testKey, testData.steps);
    console.log('');
  }

  // Add tests to test executions if configured
  if (Object.keys(TEST_EXECUTION_MAPPING).length > 0) {
    console.log('\n📋 Adding tests to test executions...\n');
    await addTestsToExecutions(token);
  }

  console.log('✅ All test steps synced successfully!');
}

async function authenticate(clientId, clientSecret) {
  const response = await fetch('https://xray.cloud.getxray.app/api/v2/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${await response.text()}`);
  }

  return (await response.text()).replace(/"/g, '');
}

async function updateTestSteps(token, testKey, steps) {
  // Get test's internal ID
  const getTestQuery = `
    query {
      getTests(jql: "key = ${testKey}", limit: 1) {
        results { issueId }
      }
    }
  `;

  const getTestResponse = await graphqlRequest(token, getTestQuery);

  if (!getTestResponse.data?.getTests?.results?.length) {
    console.log(`  ⚠️  Test ${testKey} not found in Xray`);
    return;
  }

  const testId = getTestResponse.data.getTests.results[0].issueId;
  console.log(`  📍 Found test ID: ${testId}`);

  // Remove existing steps
  const removeResult = await graphqlRequest(
    token,
    `mutation { removeAllTestSteps(issueId: "${testId}") }`
  );

  if (removeResult.errors) {
    console.log(`  ⚠️  Could not remove existing steps: ${JSON.stringify(removeResult.errors)}`);
  }

  // Add new steps
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const addStepQuery = `
      mutation {
        addTestStep(
          issueId: "${testId}",
          step: {
            action: "${escapeGraphQL(step.action)}",
            data: "${escapeGraphQL(step.data || '')}",
            result: "${escapeGraphQL(step.result)}"
          }
        ) { id }
      }
    `;

    const result = await graphqlRequest(token, addStepQuery);
    if (result.data?.addTestStep?.id) {
      console.log(`  ✓ Step ${i + 1}: ${step.action}`);
    } else {
      console.log(`  ⚠️  Failed step ${i + 1}: ${JSON.stringify(result.errors || result)}`);
    }
  }
}

async function addTestsToExecutions(token) {
  for (const [execKey, testKeys] of Object.entries(TEST_EXECUTION_MAPPING)) {
    console.log(`📋 ${execKey}: Adding ${testKeys.length} test(s)...`);

    // Get Test Execution internal ID
    const getExecQuery = `
      query {
        getTestExecutions(jql: "key = ${execKey}", limit: 1) {
          results { issueId }
        }
      }
    `;

    const execResponse = await graphqlRequest(token, getExecQuery);

    if (!execResponse.data?.getTestExecutions?.results?.length) {
      console.log(`  ⚠️  Test Execution ${execKey} not found`);
      continue;
    }

    const execId = execResponse.data.getTestExecutions.results[0].issueId;

    // Get internal IDs for all test cases
    const testIds = [];
    for (const testKey of testKeys) {
      const getTestQuery = `
        query {
          getTests(jql: "key = ${testKey}", limit: 1) {
            results { issueId }
          }
        }
      `;

      const testResponse = await graphqlRequest(token, getTestQuery);
      if (testResponse.data?.getTests?.results?.length) {
        testIds.push(testResponse.data.getTests.results[0].issueId);
      }
    }

    if (testIds.length === 0) {
      console.log(`  ⚠️  No valid test IDs found`);
      continue;
    }

    // Add tests to execution
    const mutation = `
      mutation {
        addTestsToTestExecution(
          issueId: "${execId}",
          testIssueIds: [${testIds.map((id) => `"${id}"`).join(', ')}]
        ) {
          addedTests
          warning
        }
      }
    `;

    const result = await graphqlRequest(token, mutation);

    if (result.data?.addTestsToTestExecution?.addedTests) {
      console.log(`  ✓ Added ${result.data.addTestsToTestExecution.addedTests.length} test(s)`);
    } else if (result.errors) {
      console.log(`  ⚠️  Error: ${JSON.stringify(result.errors)}`);
    }
  }
}

async function graphqlRequest(token, query) {
  const response = await fetch('https://xray.cloud.getxray.app/api/v2/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  return response.json();
}

function escapeGraphQL(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
