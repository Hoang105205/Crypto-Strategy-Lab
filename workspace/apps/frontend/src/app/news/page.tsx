import React from 'react';
import NewsFeed from '../../components/news/NewsFeed';

export const metadata = {
  title: 'Crypto News & Sentiment Feed | Crypto Strategy Lab',
  description: 'Live crypto news feed with AI VADER sentiment intensity analysis and coin filtering.',
};

export default function NewsPage() {
  return (
    <main className="min-h-screen bg-slate-950 py-10 px-4">
      <NewsFeed />
    </main>
  );
}
