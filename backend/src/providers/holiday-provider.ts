export interface HolidayProviderItem {
  date: string; // YYYY-MM-DD (civil date)
  name: string;
}

export interface HolidayProvider {
  getNationalHolidays(year: number): Promise<HolidayProviderItem[]>;
}
