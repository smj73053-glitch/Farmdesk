import type { AreaUnit, Season } from '@/types/models';

export const APP_NAME = 'FarmDesk';
export const APP_TAGLINE = 'Your Farm. Your Data. Smarter Decisions.';

export const EXPENSE_CATEGORIES = [
  { value: 'seeds', label: 'Seeds', icon: 'Sprout' },
  { value: 'fertilizers', label: 'Fertilizers', icon: 'Leaf' },
  { value: 'pesticides', label: 'Pesticides', icon: 'SprayCan' },
  { value: 'labour', label: 'Labour', icon: 'Users' },
  { value: 'machinery', label: 'Machinery', icon: 'Tractor' },
  { value: 'irrigation', label: 'Irrigation', icon: 'Droplets' },
  { value: 'electricity', label: 'Electricity', icon: 'Zap' },
  { value: 'transportation', label: 'Transportation', icon: 'Truck' },
  { value: 'fuel', label: 'Fuel', icon: 'Fuel' },
  { value: 'land_preparation', label: 'Land preparation', icon: 'Shovel' },
  { value: 'equipment', label: 'Equipment', icon: 'Wrench' },
  { value: 'other', label: 'Other', icon: 'CircleEllipsis' },
] as const;

export const INCOME_CATEGORIES = [
  { value: 'crop_sale', label: 'Crop sale' },
  { value: 'product_sale', label: 'Product sale' },
  { value: 'subsidy', label: 'Subsidy' },
  { value: 'insurance', label: 'Insurance claim' },
  { value: 'other', label: 'Other income' },
] as const;

export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Bank transfer',
  'Cheque',
  'Credit (pending)',
  'Other',
] as const;

export const ACTIVITY_TYPES = [
  { value: 'sowing', label: 'Sowing' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'pesticide', label: 'Spraying' },
  { value: 'weeding', label: 'Weeding' },
  { value: 'pruning', label: 'Pruning' },
  { value: 'harvesting', label: 'Harvesting' },
  { value: 'observation', label: 'Observation' },
  { value: 'other', label: 'Other' },
] as const;

export const CROP_STAGES = [
  { value: 'land_preparation', label: 'Land preparation', short: 'Prep' },
  { value: 'sowing', label: 'Sowing', short: 'Sow' },
  { value: 'germination', label: 'Germination', short: 'Germ.' },
  { value: 'vegetative', label: 'Vegetative growth', short: 'Veg.' },
  { value: 'flowering', label: 'Flowering', short: 'Flower' },
  { value: 'fruiting', label: 'Fruiting', short: 'Fruit' },
  { value: 'harvesting', label: 'Harvesting', short: 'Harvest' },
  { value: 'completed', label: 'Completed', short: 'Done' },
] as const;

export const SEASONS: { value: Season; label: string; months: string }[] = [
  { value: 'kharif', label: 'Kharif (monsoon)', months: 'Jun – Oct' },
  { value: 'rabi', label: 'Rabi (winter)', months: 'Oct – Mar' },
  { value: 'zaid', label: 'Zaid (summer)', months: 'Feb – Jun' },
  { value: 'annual', label: 'Annual / perennial', months: 'Year-round' },
];

export const SOIL_TYPES = [
  'Black cotton',
  'Clay',
  'Clay loam',
  'Loam',
  'Sandy loam',
  'Sandy',
  'Red',
  'Laterite',
  'Alluvial',
  'Rocky / shallow',
  'Other',
] as const;

export const WATER_SOURCES = [
  'Canal',
  'Borewell',
  'Open well',
  'Farm pond',
  'River / stream',
  'Rain-fed only',
  'Community lift irrigation',
  'Other',
] as const;

export const LAND_SLOPES = ['Level', 'Gentle', 'Moderate', 'Steep'] as const;

export const AREA_UNITS: { value: AreaUnit; label: string; acres: number }[] = [
  { value: 'acres', label: 'Acres', acres: 1 },
  { value: 'hectares', label: 'Hectares', acres: 2.47105 },
  { value: 'guntha', label: 'Guntha', acres: 0.025 },
];

export const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh',
  'Lakshadweep','Puducherry',
] as const;

export const MAHARASHTRA_DISTRICTS = [
  'Ahmednagar','Akola','Amravati','Aurangabad (Chhatrapati Sambhajinagar)','Beed','Bhandara',
  'Buldhana','Chandrapur','Dhule','Gadchiroli','Gondia','Hingoli','Jalgaon','Jalna',
  'Kolhapur','Latur','Mumbai City','Mumbai Suburban','Nagpur','Nanded','Nandurbar',
  'Nashik','Osmanabad (Dharashiv)','Palghar','Parbhani','Pune','Raigad','Ratnagiri',
  'Sangli','Satara','Sindhudurg','Solapur','Thane','Wardha','Washim','Yavatmal',
] as const;

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'mr', label: 'Marathi', native: 'मराठी' },
  { value: 'hi', label: 'Hindi', native: 'हिंदी' },
] as const;

export const CURRENCIES = [{ value: 'INR', label: 'Indian Rupee (₹)' }] as const;

export const APP_DISCLAIMER =
  'FarmDesk provides planning support using the data shown on screen. It does not guarantee yield, price or weather. Verify important decisions with your local agriculture officer, KVK or official advisories.';

export const AI_DISCLAIMER =
  'AI answers use the data available in your FarmDesk account and the cited sources at the time shown. They can be incomplete or wrong and never guarantee yield, profit or weather. No financial or destructive action is performed automatically. Check with a local agricultural expert before acting.';

export const DEFAULT_DASHBOARD_LAYOUT = [
  'weather',
  'rainfall',
  'finance',
  'recommendations',
  'crops',
  'tasks',
  'market',
  'alerts',
] as const;

export const PAGE_SIZE = 20;

export const MARKET_STALE_MINUTES = 120;
export const WEATHER_STALE_MINUTES = 90;
