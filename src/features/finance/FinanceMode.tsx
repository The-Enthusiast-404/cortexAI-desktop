import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ALPHA_VANTAGE_API_KEY = process.env.REACT_APP_ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

interface StockData {
  date: string;
  close: number;
}

interface NewsItem {
  title: string;
  url: string;
  summary: string;
  source: string;
  timePublished: string;
}

export const FinanceMode: React.FC = () => {
  const [symbol, setSymbol] = useState<string>('');
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchStockData = async (stockSymbol: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${stockSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
      );
      const data = await response.json();
      
      if (data['Time Series (Daily)']) {
        const formattedData = Object.entries(data['Time Series (Daily)'])
          .map(([date, values]: [string, any]) => ({
            date,
            close: parseFloat(values['4. close'])
          }))
          .reverse()
          .slice(0, 30); // Last 30 days
        
        setStockData(formattedData);
        setError('');
      } else {
        setError('No data available for this symbol');
      }
    } catch (err) {
      setError('Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  };

  const fetchNews = async (stockSymbol: string) => {
    try {
      const response = await fetch(
        `${BASE_URL}?function=NEWS_SENTIMENT&tickers=${stockSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
      );
      const data = await response.json();
      
      if (data.feed) {
        const formattedNews = data.feed.slice(0, 5).map((item: any) => ({
          title: item.title,
          url: item.url,
          summary: item.summary,
          source: item.source,
          timePublished: item.time_published
        }));
        setNews(formattedNews);
      }
    } catch (err) {
      console.error('Failed to fetch news', err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbol) {
      fetchStockData(symbol);
      fetchNews(symbol);
    }
  };

  return (
    <div className="p-4">
      <form onSubmit={handleSearch} className="mb-4">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Enter stock symbol (e.g., AAPL)"
          className="p-2 border rounded mr-2"
        />
        <button 
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {stockData.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Stock Price Chart</h2>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="close" 
                  stroke="#8884d8" 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {news.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Latest News</h2>
          <div className="space-y-4">
            {news.map((item, index) => (
              <div key={index} className="border p-4 rounded">
                <h3 className="font-bold">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {item.title}
                  </a>
                </h3>
                <p className="text-sm text-gray-600 mt-1">{item.summary}</p>
                <div className="text-xs text-gray-500 mt-2">
                  {item.source} - {new Date(item.timePublished).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceMode;
