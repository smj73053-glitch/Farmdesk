// Market types for FarmDesk
// Used by marketService

export interface MarketPriceQuery {
  commodity?: string;
  state?: string;
  district?: string;
  market?: string;
  limit?: number;
  offset?: number;
}

export interface MarketPrice {
  commodity: string;
  state: string;
  district: string;
  market: string;
  variety: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  arrivalDate: string;
  source: string;
  fetchedAt: string;
}

export interface PriceTrend {
  date: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  commodity: string;
  market: string;
}

export interface MarketPriceApiRecord {
  commodity: string;
  state: string;
  district: string;
  market: string;
  variety: string;
  min_price: string;
  max_price: string;
  modal_price: string;
  arrival_date: string;
}

export interface MarketPriceApiResponse {
  status: string;
  message: string;
  total: number;
  count: number;
  records: MarketPriceApiRecord[];
}
