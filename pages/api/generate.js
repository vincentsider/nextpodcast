import axios from 'axios';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import axiosRetry from 'axios-retry';

// Configure axios to use axios-retry
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on rate limit or network errors
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response.status === 429
    );
  },
});

// Load environment variables
const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

// Check if environment variables are loaded
if (!elevenlabsApiKey || !openaiApiKey) {
  console.error("Environment variables ELEVENLABS_API_KEY or OPENAI_API_KEY are not set.");
  process.exit(1);
}

// Set up OpenAI configuration
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// System prompt
const systemPrompt = `You are an experienced podcast host.

Based on the provided text (like an article), create an engaging, fun, and witty conversation between two people: Vincent and Marina.

Instructions:

- The conversation should be at least 30,000 characters long with a lot of emotions.
- Use "Vincent:" and "Marina:" at the beginning of each line to indicate the speaker.
- Vincent is writing the articles, and Marina is the second speaker who asks all the good questions.
- The podcast is called SimplyAI - Voice and Vision.
- Use short sentences that can be easily used with speech synthesis.
- Include excitement during the conversation.
- Do not mention last names.
- Vincent and Marina are doing this podcast together. Avoid sentences like "Thanks for having me, Marina!"
- Include filler words like "uh" or repeated words to make the conversation more natural.
- Ensure each line starts with the speaker's name followed by a colon, e.g., "Vincent: This is an example."
- Do not include any lines that don't start with "Vincent:" or "Marina:".

Your response should only include the conversation lines and no additional text.
`;

// Map speakers to specific voice IDs
const speakerVoiceMap = {
  Vincent: 'bIHbv24MWmeRgasZH58o', // Replace with Vincent's voice ID
  Marina: 'Xb7hH8MSUJpSbSDYk0k2', // Replace with Marina's voice ID
};

// Updated function to generate the conversation using OpenAI
async function generateConversation(article) {
  console.log("Generating conversation...");
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: article },
      ],
      max_tokens: 3500, // Increased max_tokens to allow longer responses
      temperature: 1,
      top_p: 0.95,
      n: 1,
    });

    const conversationText = response.choices[0].message.content.trim();
    console.log("Received conversation text:", conversationText);

    // Ensure conversationText is not empty
    if (!conversationText) {
      throw new Error("Received empty conversation text from OpenAI.");
    }

    const conversation = [];

    // Split the response by lines, and filter out empty lines
    const lines = conversationText.split('\n').filter((line) => line.trim() !== '');

    for (const line of lines) {
      if (line.startsWith('Vincent:')) {
        conversation.push({ speaker: 'Vincent', text: line.slice('Vincent:'.length).trim() });
      } else if (line.startsWith('Marina:')) {
        conversation.push({ speaker: 'Marina', text: line.slice('Marina:'.length).trim() });
      } else {
        // Handle lines that don't start with expected prefixes
        console.warn(`Unexpected line format: "${line}"`);
      }
    }

    console.log("Parsed conversation:", conversation);

    if (conversation.length === 0) {
      throw new Error("Conversation is empty after parsing.");
    }

    return conversation;
  } catch (error) {
    console.error("Failed to generate conversation:", error);
    throw error; // Rethrow error to be caught in the handler
  }
}

// Updated synthesizeSpeech function
async function synthesizeSpeech(text, speaker, filePath) {
  const voiceId = speakerVoiceMap[speaker];

  // Adjust max chunk size if necessary
  const maxChunkSize = 250; // Lower chunk size to reduce API load
  const textChunks =
    text.length > maxChunkSize
      ? text.match(new RegExp(`.{1,${maxChunkSize}}`, 'g'))
      : [text];

  const audioBuffers = [];

  try {
    for (const [index, chunk] of textChunks.entries()) {
      console.log(`Synthesizing chunk ${index + 1}/${textChunks.length} for ${speaker}`);

      const data = {
        text: chunk,
        model_id: 'eleven_monolingual_v1', // Ensure model_id is correct
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      };

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        data,
        {
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': elevenlabsApiKey,
          },
          responseType: 'arraybuffer',
          timeout: 60000, // Set timeout to 60 seconds
        }
      );

      audioBuffers.push(Buffer.from(response.data));

      // Respect rate limits by adding a delay if necessary
      await new Promise((resolve) => setTimeout(resolve, 500)); // Delay of 500ms between requests
    }

    // Concatenate all audio buffers
    const combinedBuffer = Buffer.concat(audioBuffers);

    fs.writeFileSync(filePath, combinedBuffer);
    console.log(`Audio content written to file "${filePath}"`);
  } catch (error) {
    console.error(
      `Failed to synthesize speech for ${speaker}:`,
      error.response ? error.response.data : error.message
    );
    throw error;
  }
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
    console.log(`Synthesizing speech for ${speaker}, saving to ${filePath}`);
    await synthesizeSpeech(text, speaker, filePath);
    audioSegmentFiles.push(filePath);
  }

  // Name the output MP3 file
  const outputFileName = `podcast_${dateHour}_${Math.random().toString(36).substr(2, 9)}.mp3`;
  const outputFilePath = path.join(directoryPath, outputFileName);

  await mergeAudios(audioSegmentFiles, outputFilePath);

  return outputFileName;
}

// In the handler function, ensure errors are caught and logged
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { article } = req.body;

    try {
      // Validate input
      if (!article || typeof article !== 'string') {
        throw new Error("Invalid article content.");
      }

      // Generate the conversation using OpenAI
      const conversation = await generateConversation(article);

      // Check if the conversation is empty
      if (!conversation.length) {
        throw new Error("No conversation generated.");
      }

      // Generate unique folder name with date and time
      const date = new Date();
      const dateHourMinuteSecond = date
        .toISOString()
        .replace(/[-:T.Z]/g, '')
        .slice(2, 15);

      // Define the directory path for this generation
      const directoryPath = path.join(
        process.cwd(),
        'public',
        'podcasts',
        dateHourMinuteSecond
      );

      // Create the directory
      fs.mkdirSync(directoryPath, { recursive: true });

      // Generate the podcast audio and save files in the directory
      const outputFileName = await generateAudio(
        conversation,
        directoryPath,
        dateHourMinuteSecond
      );

      // Construct the audio URL
      const audioUrl = `/podcasts/${dateHourMinuteSecond}/${outputFileName}`;

      res.status(200).json({ message: 'Podcast generated successfully', audioUrl });
    } catch (error) {
      console.error("Error in handler:", error);

      // Include stack trace in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      res.status(500).json({
        error: 'Failed to generate podcast',
        details: error.message,
        stack: isDevelopment ? error.stack : undefined,
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}