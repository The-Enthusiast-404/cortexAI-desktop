const API_KEY = '8VCYFHOAV7LWQQX0';
const BASE_URL = 'https://www.alphavantage.co/query';

export interface StockData {
  date: string;
  close: number;
  volume: number;
}

export interface NewsItem {
  title: string;
  url: string;
  summary: string;
  source: string;
  timePublished: string;
}

export const fetchStockData = async (symbol: string): Promise<StockData[]> => {
  const response = await fetch(
    `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`
  );
  const data = await response.json();
  
  if (data['Time Series (Daily)']) {
    return Object.entries(data['Time Series (Daily)'])
      .map(([date, values]: [string, any]) => ({
        date,
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['5. volume'])
      }))
      .reverse()
      .slice(0, 30); // Last 30 days
  }
  throw new Error('No data available');
};

export const fetchCompanyNews = async (symbol: string): Promise<NewsItem[]> => {
  const response = await fetch(
    `${BASE_URL}?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${API_KEY}`
  );
  const data = await response.json();
  
  if (data.feed) {
    return data.feed.slice(0, 5).map((item: any) => ({
      title: item.title,
      url: item.url,
      summary: item.summary,
      source: item.source,
      timePublished: item.time_published
    }));
  }
  throw new Error('No news available');
};

export const fetchCompanyOverview = async (symbol: string) => {
  const response = await fetch(
    `${BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`
  );
  return await response.json();
};
