import fs from 'fs';

async function run() {
  const url = 'https://api.elevenlabs.io/v1/convai/agents/create';
  let apiKey = '';
  try {
    const envFile = fs.readFileSync('.env', 'utf-8');
    const lines = envFile.split('\n');
    for (const line of lines) {
      if (line.startsWith('ELEVENLABS_API_KEY=')) {
        apiKey = line.split('=')[1].trim();
      }
    }
  } catch (e) {
    console.error("No .env file found");
    return;
  }

  const payload = {
    conversation_config: {
      agent: {
        prompt: {
          prompt: "test",
          llm: "custom",
          custom_llm: {
             url: "https://api.x.ai/v1/chat/completions",
             api_key: "dummy_key"
          }
        }
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
