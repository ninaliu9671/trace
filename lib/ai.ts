import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
})

export async function callAI(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
  temperature = 0.7
): Promise<string> {
  const response = await client.chat.completions.create({
    model: process.env.AI_MODEL ?? 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    temperature,
  })

  return response.choices[0].message.content ?? ''
}

export async function callAIStream(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
) {
  return client.chat.completions.create({
    model: process.env.AI_MODEL ?? 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
  })
}
