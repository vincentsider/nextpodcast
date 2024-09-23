'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PodcastGenerator() {
  const [article, setArticle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  console.log('isLoading value:', isLoading); // Add this line

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log('isLoading set to true');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ article }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate podcast');
      }

      const data = await response.json();
      console.log('Response data:', data);
      console.log('data.audioUrl:', data.audioUrl);
      console.log('Type of data.audioUrl:', typeof data.audioUrl);

      if (!data.audioUrl) {
        throw new Error('Audio URL is missing from the response');
      }

      if (typeof data.audioUrl !== 'string') {
        throw new Error(`Expected data.audioUrl to be a string, but got ${typeof data.audioUrl}`);
      }

      const audioUrl = encodeURIComponent(data.audioUrl);
      const destination = `/success?audioUrl=${audioUrl}`;
      console.log('Navigating to:', destination);
      console.log('Type of destination:', typeof destination);

      router.push(destination);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate podcast. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={article}
        onChange={(e) => setArticle(e.target.value)}
        placeholder="Enter your article here..."
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate Podcast'}
      </button>
      {isLoading && <LoadingSpinner />}
    </form>
  );
}

function LoadingSpinner() {
  console.log('LoadingSpinner rendered');
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>Generating podcast, please wait...</p>
    </div>
  );
}