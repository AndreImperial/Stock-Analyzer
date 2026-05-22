export type VitalSignsData = {
  /**
   * Price-to-earnings ratio.
   * Example: 24.6 means investors are paying about 24.6x annual earnings.
   */
  peRatio: number | null;

  /**
   * Total market value of the company.
   * Usually available for stocks, but not for forex pairs.
   */
  marketCap: number | null;

  /**
   * Dividend yield as a decimal ratio.
   * Example: 0.018 means 1.8%.
   */
  dividendYield: number | null;

  /**
   * One-year price growth as a decimal ratio.
   * Example: 0.142 means +14.2%.
   */
  oneYearGrowth: number | null;

  /**
   * Optional currency code used when displaying market cap.
   * Examples: USD, PHP.
   */
  currency?: string;
};
