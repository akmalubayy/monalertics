// Test Discord payload serialization - mimics what the code does
const axios = require('axios');

// Test webhook URL from config
const webhookUrl = 'https://discord.com/api/webhooks/1554749315384352862/UwIN1OFwCI706WNlUOERWr0cTBYV9i7gBvqLHTbqC07cRjqYQ0HYw8Zx3Tpfbor3nKnq';

// Simulate buildAlertDiscord output
const embeds = [
  {
    title: 'Monalertics Alert: Test Monitor is DOWN',
    color: 0xdc2626,
    fields: [
      { name: 'Monitor', value: 'Test Monitor', inline: true },
      { name: 'Target', value: 'https://example.com', inline: true },
      { name: 'Status', value: 'DOWN', inline: true },
      { name: 'Message', value: 'Ini adalah pesan uji coba dari Monalertics.' },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Monalertics — Website, Domain & SSL Monitoring' },
  },
];

// Test 1: Send only embeds (as code currently does)
async function test1() {
  console.log('Test 1: Send embeds only (current code pattern)');
  try {
    const response = await axios.post(
      webhookUrl,
      { embeds },
      { timeout: 10000 }
    );
    console.log('SUCCESS:', response.status);
  } catch (err) {
    console.log('FAILED:', err.response?.status, err.response?.data || err.message);
  }
}

// Test 2: Send embeds + content: ''
async function test2() {
  console.log('Test 2: Send embeds + content: ""');
  try {
    const response = await axios.post(
      webhookUrl,
      { content: '', embeds },
      { timeout: 10000 }
    );
    console.log('SUCCESS:', response.status);
  } catch (err) {
    console.log('FAILED:', err.response?.status, err.response?.data || err.message);
  }
}

// Test 3: Send embeds + content: undefined (what happens currently)
async function test3() {
  console.log('Test 3: Send embeds + content: undefined');
  try {
    const response = await axios.post(
      webhookUrl,
      { content: undefined, embeds },
      { timeout: 10000 }
    );
    console.log('SUCCESS:', response.status);
  } catch (err) {
    console.log('FAILED:', err.response?.status, err.response?.data || err.message);
  }
}

test1().then(test2).then(test3);