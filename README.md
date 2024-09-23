# Podcast Generator

Welcome to the Podcast Generator! This project allows you to convert text articles into engaging podcast episodes using OpenAI's GPT-4 and ElevenLabs' text-to-speech (TTS) technology.

## Features

- **Engaging Conversations**: Generates a fun and witty conversation between two speakers, Vincent and Marina, based on your text article.
- **High-Quality Speech Synthesis**: Uses ElevenLabs' latest turbo v2.5 model for natural and expressive speech.
- **Customizable**: Easily update the speakers' voices and system prompt to suit your needs.
- **Automatic File Management**: Stores each podcast generation in a separate folder named by date and hour.

## Getting Started

### Prerequisites

- **Replit Account**: Sign up for a free account at [Replit](https://replit.com/).
- **ElevenLabs API Key**: Sign up at [ElevenLabs](https://elevenlabs.io/) and obtain your API key.
- **OpenAI API Key**: Sign up at [OpenAI](https://openai.com/) and obtain your API key.

### Deployment

1. **Fork the Repository**:
   - Go to [nextpodcast](https://github.com/vincentsider/nextpodcast) and fork the repository to your GitHub account.

2. **Create a Replit Project**:
   - Go to [Replit](https://replit.com/) and create a new Repl.
   - Choose "Import from GitHub" and enter the URL of your forked repository.

3. **Add Secret Keys**:
   - In your Replit project, go to the "Secrets" tab.
   - Add your `ELEVENLABS_API_KEY` and `OPENAI_API_KEY`.

4. **Update Voice IDs**:
   - Clone your voice in ElevenLabs and obtain the voice IDs.
   - Update the `pages/api/generate.js` file with your voice IDs:
     ```javascript
     const speakerVoiceMap = {
       Vincent: 'your_vincent_voice_id', // Replace with Vincent's voice ID
       Marina: 'your_marina_voice_id', // Replace with Marina's voice ID
     };
     ```

5. **Run the Project**:
   - Click the "Run" button in Replit to start the project.

### Customization

#### System Prompt

You can customize the system prompt to change the behavior of the podcast generation. Update the `systemPrompt` variable in `pages/api/generate.js`:

