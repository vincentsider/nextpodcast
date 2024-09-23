import axios from 'axios';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

// Load environment variables
const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

// Set up OpenAI configuration
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// System prompt
const systemPrompt = `you are an experienced podcast host...

- based on text like an article you can create an engaging , fun and witty conversation between two people. 
- make the conversation at least 30000 characters long with a lot of emotions!
- in the response for me to identify use Vincent and Marina.
- Vincent is writing the articles and Marina is the second speaker that is asking all the good questions.
- The podcast is called SimplyAI, voice and vision.
- Short sentences that can be easily used with speech synthesis.
- excitement during the conversation.
- do not mention last names.
- Vincent and Marina are doing this podcast together. Avoid sentences like: "Thanks for having me, Marina!"
- Include filler words like äh or repeat words to make the conversation muchmore natural.
`;

// Map speakers to specific voice IDs
const speakerVoiceMap = {
  Vincent: '7hI1gJ0eEcjxMNxBGItz', // Replace with Vincent's voice ID
  Marina: '9BWtsMINqrJLrRacOk9x', // Replace with Marina's voice ID
};

// Function to generate the conversation using OpenAI
async function generateConversation(article) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: article }
    ],
    max_tokens: 2048,
    temperature: 1,
    top_p: 0.95,
    n: 1,
  });

  const conversationText = response.choices[0].message.content.trim();
  const conversation = [];

  for (const line of conversationText.split('\n')) {
    if (line.startsWith('Vincent:')) {
      conversation.push({ speaker: 'Vincent', text: line.slice('Vincent:'.length).trim() });
    } else if (line.startsWith('Marina:')) {
      conversation.push({ speaker: 'Marina', text: line.slice('Marina:'.length).trim() });
    }
  }
  return conversation;
}

// Function to synthesize speech using ElevenLabs
async function synthesizeSpeech(text, speaker, filePath) {
  const voiceId = speakerVoiceMap[speaker];
  const data = {
    text: text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  };

  const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, data, {
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenlabsApiKey,
    },
    responseType: 'arraybuffer',
  });

  fs.writeFileSync(filePath, response.data);
  console.log(`Audio content written to file "${filePath}"`);
}

// Function to merge audio files by concatenating buffers
async function mergeAudios(audioFiles, outputFile) {
  const outputStream = fs.createWriteStream(outputFile);

  for (const filePath of audioFiles) {
    const buffer = fs.readFileSync(filePath);
    // Optionally remove ID3 tags
    const trimmedBuffer = removeID3Tags(buffer);
    outputStream.write(trimmedBuffer);
  }

  outputStream.end();
  console.log(`Merged audio saved as ${outputFile}`);
}

// Function to remove ID3 tags from MP3 file buffer (optional)
function removeID3Tags(buffer) {
  let start = 0;
  let end = buffer.length;

  // Remove ID3v2 header if present
  if (buffer.slice(0, 3).toString() === 'ID3') {
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    start = 10 + size;
  }

  // Remove ID3v1 footer if present
  if (buffer.slice(-128).slice(0, 3).toString() === 'TAG') {
    end -= 128;
  }

  return buffer.slice(start, end);
}

// Function to generate the podcast audio
async function generateAudio(conversation, directoryPath, dateHour) {
  // Ensure the directory exists
  fs.mkdirSync(directoryPath, { recursive: true });

  // For storing the filenames
  const audioSegmentFiles = [];

  for (const [index, part] of conversation.entries()) {
    const { speaker, text } = part;
    const filename = `${index}_${speaker}.mp3`;
    const filePath = path.join(directoryPath, filename);
    await synthesizeSpeech(text, speaker, filePath);
    audioSegmentFiles.push(filePath);
  }

  // Name the output MP3 file
  const outputFileName = `podcast${dateHour}.mp3`;
  const outputFilePath = path.join(directoryPath, outputFileName);

  await mergeAudios(audioSegmentFiles, outputFilePath);
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { article } = req.body;

    try {
      // Generate the conversation using OpenAI
      const conversation = await generateConversation(article);

      // Generate the date-hour format string (YYMMDDHH)
      const date = new Date();
      const dateHour = date
        .toISOString()
        .replace(/[-:T]/g, '')
        .slice(2, 10);

      // Define the directory path for this generation
      const directoryPath = path.join(process.cwd(), 'public', 'podcasts', dateHour);

      // Create the directory if it doesn't exist
      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }

      // Generate the podcast audio and save files in the directory
      await generateAudio(conversation, directoryPath, dateHour);

      // Construct the audio URL
      const outputFileName = `podcast${dateHour}.mp3`;
      const audioUrl = `/podcasts/${dateHour}/${outputFileName}`;

      res.status(200).json({ message: 'Podcast generated successfully', audioUrl });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to generate podcast' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}