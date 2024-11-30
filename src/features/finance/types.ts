export interface StockData {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface NewsItem {
  title: string;
  url: string;
  summary: string;
  source: string;
  timePublished: string;
  sentiment?: string;
  relevanceScore?: number;
}

export interface CompanyOverview {
  Symbol: string;
  Name: string;
  Description: string;
  Exchange: string;
  Currency: string;
  Country: string;
  Sector: string;
  Industry: string;
  MarketCapitalization: string;
  PERatio: string;
  DividendYield: string;
  52WeekHigh: string;
  52WeekLow: string;
}

export interface FinanceError {
  message: string;
  code?: string;
}
