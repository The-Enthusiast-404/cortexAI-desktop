import { StockData, NewsItem, CompanyOverview } from './types';

const ALPHA_VANTAGE_API_KEY = process.env.REACT_APP_ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

export class FinanceService {
  private static async fetchFromAlphaVantage(params: Record<string, string>) {
    const queryString = new URLSearchParams({
      ...params,
      apikey: ALPHA_VANTAGE_API_KEY || '',
    }).toString();

    const response = await fetch(`${BASE_URL}?${queryString}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  static async getStockData(symbol: string): Promise<StockData[]> {
    const data = await this.fetchFromAlphaVantage({
      function: 'TIME_SERIES_DAILY',
      symbol,
      outputsize: 'compact',
    });

    if (!data['Time Series (Daily)']) {
      throw new Error('No stock data available');
    }

    return Object.entries(data['Time Series (Daily)'])
      .map(([date, values]: [string, any]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['5. volume']),
      }))
      .reverse()
      .slice(0, 30);
  }

  static async getCompanyNews(symbol: string): Promise<NewsItem[]> {
    const data = await this.fetchFromAlphaVantage({
      function: 'NEWS_SENTIMENT',
      tickers: symbol,
    });

    if (!data.feed) {
      throw new Error('No news data available');
    }

    return data.feed.slice(0, 5).map((item: any) => ({
      title: item.title,
      url: item.url,
      summary: item.summary,
      source: item.source,
      timePublished: item.time_published,
      sentiment: item.overall_sentiment_label,
      relevanceScore: parseFloat(item.relevance_score),
    }));
  }

  static async getCompanyOverview(symbol: string): Promise<CompanyOverview> {
    const data = await this.fetchFromAlphaVantage({
      function: 'OVERVIEW',
      symbol,
    });

    if (!data.Symbol) {
      throw new Error('No company overview available');
    }

    return data as CompanyOverview;
  }
}
