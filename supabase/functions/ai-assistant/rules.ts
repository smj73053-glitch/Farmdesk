import type { FarmContext } from './tools.ts';
import { monthName, seasonNow } from './tools.ts';

type Lang = 'en' | 'mr' | 'hi';

const TEXT: Record<string, Record<Lang, string>> = {
  noFarm: {
    en: 'No farm profile is saved yet. Add your farm under Farm Management so I can use your real area, soil and location data.',
    mr: 'अजून शेताची माहिती जतन केलेली नाही. शेत व्यवस्थापनात शेत जोडा, म्हणजे मी तुमचा खरा क्षेत्र, माती आणि स्थान वापरू शकेन.',
    hi: 'अभी कोई खेत प्रोफ़ाइल सहेजी नहीं गई है। खेत प्रबंधन में अपना खेत जोड़ें ताकि मैं आपका वास्तविक क्षेत्र, मिट्टी और स्थान उपयोग कर सकूं।',
  },
  overview: { en: 'Farm overview', mr: 'शेताचा आढावा', hi: 'खेत का अवलोकन' },
  expenses: { en: 'Expenses', mr: 'खर्च', hi: 'खर्च' },
  income: { en: 'Income and net position', mr: 'उत्पन्न आणि निव्वळ स्थिती', hi: 'आय और शुद्ध स्थिति' },
  weather: { en: 'Weather', mr: 'हवामान', hi: 'मौसम' },
  market: { en: 'Market prices', mr: 'बाजार भाव', hi: 'बाजार भाव' },
  crops: { en: 'Active crops', mr: 'सक्रिय पिके', hi: 'सक्रिय फसलें' },
  tasks: { en: 'Pending tasks', mr: 'प्रलंबित कामे', hi: 'लंबित कार्य' },
  recommend: { en: 'Quick crop screen', mr: 'पिकांची झटपट तपासणी', hi: 'फसल की त्वरित जाँच' },
  soil: { en: 'Soil records', mr: 'माती नोंदी', hi: 'मिट्टी रिकॉर्ड' },
  totalExpenses: { en: 'Recorded expenses', mr: 'नोंदवलेला खर्च', hi: 'दर्ज खर्च' },
  totalIncome: { en: 'Recorded income', mr: 'नोंदवलेले उत्पन्न', hi: 'दर्ज आय' },
  netProfit: { en: 'Net (income − expenses)', mr: 'निव्वळ (उत्पन्न − खर्च)', hi: 'शुद्ध (आय − खर्च)' },
  noExpenses: { en: 'No expense records are saved for this farm yet.', mr: 'या शेतासाठी अजून खर्चाची नोंद नाही.', hi: 'इस खेत के लिए अभी कोई खर्च दर्ज नहीं है।' },
  noIncome: { en: 'No income records are saved for this farm yet.', mr: 'या शेतासाठी अजून उत्पन्नाची नोंद नाही.', hi: 'इस खेत के लिए अभी कोई आय दर्ज नहीं है।' },
  noWeather: { en: 'Live weather is unavailable: add farm coordinates and check the internet connection, or open the Weather page to retry.', mr: 'थेट हवामान उपलब्ध नाही: शेताचे स्थान जोडा आणि इंटरनेट तपासा, किंवा हवामान पानावर पुन्हा प्रयत्न करा.', hi: 'लाइव मौसम उपलब्ध नहीं है: खेत के निर्देशांक जोड़ें और इंटरनेट जाँचें, या मौसम पृष्ठ पर फिर कोशिश करें।' },
  noMarket: { en: 'No saved mandi observations match this farm yet. The live feed may be rate-limited; try Market Prices or import an official AGMARKNET CSV. I will not estimate a price.', mr: 'या शेताशी जुळणारी जतन केलेली मंडी नोंद नाही. थेट फीड मर्यादित असू शकते; बाजार भाव पान पहा किंवा अधिकृत AGMARKNET CSV आयात करा. मी भाव अंदाज करणार नाही.', hi: 'इस खेत से मेल खाता कोई सहेजा हुआ मंडी रिकॉर्ड नहीं है। लाइव फ़ीड सीमित हो सकती है; बाजार भाव देखें या आधिकारिक AGMARKNET CSV आयात करें। मैं अनुमानित भाव नहीं बताऊँगा।' },
  noCrops: { en: 'No active crop is recorded for this farm. Add one under Crop Lifecycle to get stage and task support.', mr: 'या शेतासाठी सक्रिय पीक नोंदवलेले नाही. टप्पा आणि कामांच्या मदतीसाठी पीक जीवनचक्रात पीक जोडा.', hi: 'इस खेत के लिए कोई सक्रिय फसल दर्ज नहीं है। चरण और कार्य सहायता के लिए फसल जीवनचक्र में फसल जोड़ें।' },
  noTasks: { en: 'No pending tasks are recorded.', mr: 'कोणतीही प्रलंबित कामे नोंदवलेली नाहीत.', hi: 'कोई लंबित कार्य दर्ज नहीं है।' },
  noSoil: { en: 'No soil test is recorded. Add a soil record to make pH and nutrient advice specific.', mr: 'माती परीक्षण नोंदवलेले नाही. pH आणि पोषण सल्ला अचूक करण्यासाठी माती नोंद जोडा.', hi: 'कोई मिट्टी परीक्षण दर्ज नहीं है। pH और पोषण सलाह सटीक बनाने के लिए मिट्टी रिकॉर्ड जोड़ें।' },
  missing: { en: 'Missing data', mr: 'अनुपलब्ध माहिती', hi: 'अनुपलब्ध जानकारी' },
  sources: { en: 'Sources', mr: 'स्रोत', hi: 'स्रोत' },
  note: {
    en: 'This is planning support from your saved data, not a guarantee. Verify important decisions with your KVK or agriculture officer.',
    mr: 'हे तुमच्या जतन केलेल्या माहितीवर आधारित नियोजन सहाय्य आहे, हमी नाही. महत्त्वाचे निर्णय KVK किंवा कृषी अधिकाऱ्यांशी तपासा.',
    hi: 'यह आपके सहेजे गए डेटा पर आधारित योजना सहायता है, गारंटी नहीं। महत्वपूर्ण निर्णय KVK या कृषि अधिकारी से जाँचें।',
  },
  active: { en: 'active', mr: 'सक्रिय', hi: 'सक्रिय' },
  records: { en: 'records', mr: 'नोंदी', hi: 'रिकॉर्ड' },
  latest: { en: 'latest observation', mr: 'अलीकडील निरीक्षण', hi: 'नवीनतम अवलोकन' },
  fullPage: {
    en: 'The Crop Intelligence page runs the full weighted model using the same farm, climate and market inputs.',
    mr: 'पीक बुद्धिमत्ता पान त्याच शेत, हवामान आणि बाजार माहितीवर संपूर्ण भारित मॉडेल चालवते.',
    hi: 'फसल बुद्धिमत्ता पृष्ठ उसी खेत, जलवायु और बाजार डेटा पर पूरा भारित मॉडल चलाता है।',
  },
};

function t(key: string, lang: Lang): string {
  return TEXT[key]?.[lang] ?? TEXT[key]?.en ?? key;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function normalise(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, ' ').trim();
}

function latestByCommodity(rows: Array<Record<string, unknown>>) {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = `${normalise(row.commodity)}|${normalise(row.market_name)}|${normalise(row.variety)}`;
    const prev = map.get(key);
    if (!prev || String(row.arrival_date) > String(prev.arrival_date)) map.set(key, row);
  }
  return [...map.values()];
}

function farmLabel(ctx: FarmContext): string {
  return String(ctx.farm?.name ?? 'your farm');
}

function areaText(ctx: FarmContext): string {
  const area = num(ctx.farm?.total_area);
  const unit = String(ctx.farm?.area_unit ?? 'acres');
  return area ? `${area.toLocaleString('en-IN')} ${unit}` : 'area not recorded';
}

function detectIntent(message: string): string {
  const m = normalise(message);
  const has = (...words: string[]) => words.some((w) => m.includes(normalise(w)));
  if (has('recommend', 'suitable', 'which crop', 'what crop', 'should i grow', 'grow this season', 'कोणते पीक', 'कोणती पिके', 'कौन सी फसल', 'कौनसी फसल')) return 'recommend';
  if (has('weather', 'rain', 'forecast', 'temperature', 'humidity', 'हवामान', 'पाऊस', 'मौसम', 'बारिश', 'तापमान')) return 'weather';
  if (has('market', 'mandi', 'price', 'rate', 'बाजार', 'भाव', 'दर', 'मंडी')) return 'market';
  if (has('expense', 'spent', 'spend', 'cost', 'खर्च', 'व्यय')) return 'expenses';
  if (has('income', 'earning', 'revenue', 'profit', 'net', 'उत्पन्न', 'नफा', 'लाभ', 'आय', 'मुनाफा')) return 'income';
  if (has('task', 'reminder', 'todo', 'काम', 'कार्य', 'कामे')) return 'tasks';
  if (has('soil', 'ph', 'माती', 'मिट्टी')) return 'soil';
  if (has('crop', 'stage', 'harvest', 'sowing', 'पीक', 'फसल', 'बुवाई', 'कटाई')) return 'crops';
  return 'overview';
}

function overview(ctx: FarmContext, lang: Lang): string {
  if (!ctx.farm) return t('noFarm', lang);
  const lines: string[] = [`**${t('overview', lang)} — ${farmLabel(ctx)}**`];
  lines.push(`• Area: ${areaText(ctx)}; soil: ${ctx.farm.soil_type ?? 'not recorded'}; pH: ${ctx.farm.soil_ph ?? 'not recorded'}.`);
  lines.push(`• Irrigation: ${ctx.farm.irrigation_available ? `yes (${ctx.farm.water_source ?? 'source not recorded'})` : 'no / rain-fed'}.`);
  lines.push(`• Active crops: ${ctx.activeCrops.length}. Pending tasks: ${ctx.tasks.length}.`);
  if (ctx.weather) {
    const days = ctx.weather.days as Array<Record<string, unknown>>;
    lines.push(`• 7-day rainfall forecast: ${ctx.weather.rain7d} mm (Open-Meteo).`);
    if (days?.length) {
      const max = Math.max(...days.map((d) => num(d.tempMax)));
      const min = Math.min(...days.map((d) => num(d.tempMin)));
      lines.push(`• Forecast temperature range: ${Math.round(min)}–${Math.round(max)}°C.`);
    }
  } else {
    lines.push(`• ${t('noWeather', lang)}`);
  }
  const totalExpenses = ctx.expenses.reduce((s, e) => s + num(e.amount), 0);
  const totalIncome = ctx.income.reduce((s, i) => s + num(i.amount), 0);
  lines.push(`• ${t('totalExpenses', lang)}: ${money(totalExpenses)}; ${t('totalIncome', lang)}: ${money(totalIncome)}.`);
  lines.push(`\n${t('note', lang)}`);
  return lines.join('\n');
}

function expenses(ctx: FarmContext, lang: Lang): string {
  if (!ctx.expenses.length) return `${t('expenses', lang)}: ${t('noExpenses', lang)}`;
  const total = ctx.expenses.reduce((s, e) => s + num(e.amount), 0);
  const byCategory = new Map<string, { amount: number; count: number }>();
  for (const e of ctx.expenses) {
    const key = String(e.category ?? 'other');
    const entry = byCategory.get(key) ?? { amount: 0, count: 0 };
    entry.amount += num(e.amount);
    entry.count += 1;
    byCategory.set(key, entry);
  }
  const top = [...byCategory.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 5);
  const lines = [
    `**${t('expenses', lang)} — ${farmLabel(ctx)}**`,
    `${t('totalExpenses', lang)}: **${money(total)}** across ${ctx.expenses.length} ${t('records', lang)}.`,
    ...top.map(([category, v]) => `• ${category.replace(/_/g, ' ')}: ${money(v.amount)} (${v.count})`),
  ];
  const dates = ctx.expenses.map((e) => String(e.expense_date)).filter(Boolean).sort();
  if (dates.length) lines.push(`Period covered by saved records: ${dates[0]} to ${dates.at(-1)}.`);
  lines.push(`\n${t('note', lang)}`);
  return lines.join('\n');
}

function income(ctx: FarmContext, lang: Lang): string {
  const totalIncome = ctx.income.reduce((s, i) => s + num(i.amount), 0);
  const totalExpenses = ctx.expenses.reduce((s, e) => s + num(e.amount), 0);
  const net = totalIncome - totalExpenses;
  const lines = [
    `**${t('income', lang)} — ${farmLabel(ctx)}**`,
    `${t('totalIncome', lang)}: **${money(totalIncome)}** (${ctx.income.length} ${t('records', lang)}).`,
    `${t('totalExpenses', lang)}: ${money(totalExpenses)}.`,
    `${t('netProfit', lang)}: **${net >= 0 ? '+' : '−'}${money(Math.abs(net))}**.`,
  ];
  if (!ctx.income.length) lines.push(t('noIncome', lang));
  lines.push('These figures use only records saved in FarmDesk; unrecorded sales or costs are not included.');
  lines.push(`\n${t('note', lang)}`);
  return lines.join('\n');
}

function weather(ctx: FarmContext, lang: Lang): string {
  if (!ctx.weather) return `${t('weather', lang)}: ${t('noWeather', lang)}`;
  const days = ctx.weather.days as Array<Record<string, unknown>>;
  const lines = [`**${t('weather', lang)} — ${farmLabel(ctx)}**`];
  lines.push(`7-day rainfall forecast: **${ctx.weather.rain7d} mm** (Open-Meteo, retrieved ${String(ctx.weather.fetchedAt).slice(0, 16).replace('T', ' ')}).`);
  for (const day of (days ?? []).slice(0, 5)) {
    lines.push(`• ${day.date}: ${Math.round(num(day.tempMin))}–${Math.round(num(day.tempMax))}°C, rain ${num(day.rainfall)} mm (${Math.round(num(day.rainProbability))}% chance), wind up to ${Math.round(num(day.windMax))} km/h.`);
  }
  const rainy = (days ?? []).filter((d) => num(d.rainfall) >= 25).length;
  if (rainy) lines.push(`⚠ ${rainy} day(s) are forecast at or above 25 mm. Check field drainage and avoid spraying just before rain.`);
  lines.push('This is an Open-Meteo forecast, not an official IMD warning.');
  lines.push(`\n${t('note', lang)}`);
  return lines.join('\n');
}

function market(ctx: FarmContext, lang: Lang, message: string): string {
  const rows = latestByCommodity(ctx.marketRows);
  if (!rows.length) return `${t('market', lang)}: ${t('noMarket', lang)}`;
  const m = normalise(message);
  const cropCommodities = new Set<string>();
  for (const crop of ctx.activeCrops) {
    const ref = crop.crop as Record<string, unknown> | null;
    for (const name of (ref?.market_commodities as string[] | null) ?? []) cropCommodities.add(normalise(name));
    if (ref?.name) cropCommodities.add(normalise(ref.name));
  }
  let matches = rows.filter((r) => {
    const commodity = normalise(r.commodity);
    return m.includes(commodity) || commodity.split(' ').some((part) => part.length > 3 && m.includes(part));
  });
  if (!matches.length && cropCommodities.size) {
    matches = rows.filter((r) => cropCommodities.has(normalise(r.commodity)));
  }
  if (!matches.length) {
    const byCommodity = new Map<string, number>();
    for (const row of rows) {
      const key = String(row.commodity);
      const price = num(row.modal_price);
      if (price > (byCommodity.get(key) ?? 0)) byCommodity.set(key, price);
    }
    const top = [...byCommodity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return [
      `**${t('market', lang)}**`,
      `No commodity name in your question matched the saved snapshots. Latest saved commodities include:`,
      ...top.map(([commodity, price]) => `• ${commodity}: ${money(price)}/quintal`),
      t('noMarket', lang),
      `\n${t('note', lang)}`,
    ].join('\n');
  }
  matches.sort((a, b) => String(b.arrival_date).localeCompare(String(a.arrival_date)));
  const lines = [`**${t('market', lang)}**`, `Source: saved data.gov.in / AGMARKNET observations.`];
  for (const row of matches.slice(0, 6)) {
    lines.push(`• ${row.commodity}${row.variety ? ` (${row.variety})` : ''} at ${row.market_name}, ${row.district ?? ''}: **${money(num(row.modal_price))}/quintal** modal (min ${money(num(row.min_price))}, max ${money(num(row.max_price))}), ${t('latest', lang)} ${row.arrival_date}.`);
  }
  lines.push('Prices are observed mandi prices and do not promise the rate you will receive; quality, transport and demand matter.');
  lines.push(`\n${t('note', lang)}`);
  return lines.join('\n');
}

function crops(ctx: FarmContext, lang: Lang): string {
  if (!ctx.activeCrops.length) return `${t('crops', lang)}: ${t('noCrops', lang)}`;
  const lines = [`**${t('crops', lang)} — ${farmLabel(ctx)}**`];
  for (const farmCrop of ctx.activeCrops.slice(0, 8)) {
    const ref = farmCrop.crop as Record<string, unknown> | null;
    const name = String(ref?.name ?? 'Crop');
    lines.push(`• ${name}: stage ${String(farmCrop.current_stage).replace(/_/g, ' ')}, sown ${farmCrop.sowing_date ?? 'date not recorded'}, expected harvest ${farmCrop.expected_harvest_date ?? 'not recorded'}, area ${num(farmCrop.area_planted) || 'not recorded'} ${farmCrop.area_unit ?? ''}.`);
  }
  lines.push(`\n${t('note', lang)}`);
  return lines.join('\n');
}

function tasks(ctx: FarmContext, lang: Lang): string {
  if (!ctx.tasks.length) return `${t('tasks', lang)}: ${t('noTasks', lang)}`;
  const lines = [`**${t('tasks', lang)} — ${farmLabel(ctx)}**`];
  for (const task of ctx.tasks.slice(0, 10)) {
    lines.push(`• ${task.title}${task.due_date ? ` — due ${task.due_date}` : ''} (${task.priority ?? 'normal'} priority).`);
  }
  lines.push(`\n${t('note', lang)}`);
  return lines.join('\n');
}

function soil(ctx: FarmContext, lang: Lang): string {
  if (!ctx.soilRecords.length) {
    return `${t('soil', lang)}: ${t('noSoil', lang)}\n\nFarm-level soil: ${ctx.farm?.soil_type ?? 'not recorded'}, pH ${ctx.farm?.soil_ph ?? 'not recorded'}.`;
  }
  const lines = [`**${t('soil', lang)} — ${farmLabel(ctx)}**`];
  for (const record of ctx.soilRecords.slice(0, 5)) {
    lines.push(`• Test ${record.test_date ?? 'date not recorded'}: pH ${record.ph ?? '—'}, organic carbon ${record.organic_carbon ?? '—'}, N ${record.nitrogen ?? '—'}, P ${record.phosphorus ?? '—'}, K ${record.potassium ?? '—'}${record.lab_name ? ` (${record.lab_name})` : ''}.`);
  }
  lines.push('Soil test values use the units reported by your laboratory. Confirm interpretation with your KVK before applying corrections.');
  lines.push(`\n${t('note', lang)}`);
  return lines.join('\n');
}

interface Candidate {
  name: string;
  score: number;
  reasons: string[];
  cautions: string[];
}

function band(value: number | null, min: number | null, max: number | null): number {
  if (value == null || min == null || max == null) return 55;
  if (value >= min && value <= max) return 100;
  const span = Math.max(1, max - min);
  const distance = value < min ? min - value : value - max;
  return Math.max(0, 100 - (distance / span) * 70);
}

function quickRecommendations(ctx: FarmContext): Candidate[] {
  const season = seasonNow();
  const rain = num(ctx.climate?.annualRainfallMm) || null;
  const temp = num(ctx.climate?.meanTempC) || null;
  const soil = normalise(ctx.farm?.soil_type);
  const ph = ctx.farm?.soil_ph != null ? num(ctx.farm.soil_ph) : null;
  const irrigated = Boolean(ctx.farm?.irrigation_available && normalise(ctx.farm?.water_source) !== 'rain fed only');
  const candidates: Candidate[] = [];

  for (const crop of ctx.cropReference) {
    const seasons = (crop.seasons as string[] | null) ?? [];
    if (!seasons.includes('annual') && !seasons.includes(season)) continue;
    const reasons: string[] = [];
    const cautions: string[] = [];
    let score = 0;
    let weight = 0;

    const rainScore = band(rain, crop.optimal_rainfall_min as number | null, crop.optimal_rainfall_max as number | null);
    score += rainScore * 0.3; weight += 0.3;
    if (rain != null && rainScore >= 80) reasons.push(`historical rainfall ${rain} mm fits its reference range`);
    if (rain != null && rainScore < 60) cautions.push(`rainfall is outside its preferred range`);

    const tempScore = band(temp, crop.optimal_temp_min as number | null, crop.optimal_temp_max as number | null);
    score += tempScore * 0.25; weight += 0.25;
    if (temp != null && tempScore >= 80) reasons.push(`mean temperature ${temp}°C is suitable`);

    if (soil) {
      const soils = ((crop.suitable_soil_types as string[] | null) ?? []).map(normalise);
      const soilFit = soils.some((s) => s.includes(soil) || soil.includes(s)) ? 100 : 35;
      score += soilFit * 0.2; weight += 0.2;
      if (soilFit === 100) reasons.push(`your ${ctx.farm?.soil_type} soil is listed as suitable`);
      else cautions.push(`your ${ctx.farm?.soil_type} soil is not in its listed soil types`);
    }

    if (ph != null && crop.min_ph != null && crop.max_ph != null) {
      const phFit = band(ph, num(crop.min_ph), num(crop.max_ph));
      score += phFit * 0.1; weight += 0.1;
      if (phFit < 70) cautions.push(`soil pH ${ph} is outside its reference range`);
    }

    const req = String(crop.water_requirement ?? 'medium');
    const waterFit = req === 'low' ? 100 : req === 'medium' ? (irrigated ? 85 : 55) : (irrigated ? 85 : 25);
    score += waterFit * 0.15; weight += 0.15;
    if (waterFit >= 85) reasons.push(`${req} water requirement matches your water profile`);
    else cautions.push(`${req} water requirement may exceed your recorded water availability`);

    const total = weight ? score / weight : 0;
    if (total < 35) continue;
    candidates.push({
      name: String(crop.name),
      score: Math.round(total),
      reasons: reasons.slice(0, 3),
      cautions: cautions.slice(0, 2),
    });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
}

function recommend(ctx: FarmContext, lang: Lang): string {
  if (!ctx.farm) return t('noFarm', lang);
  const season = seasonNow();
  const candidates = quickRecommendations(ctx);
  if (!candidates.length) {
    return [
      `**${t('recommend', lang)}**`,
      `I could not screen any reference crop for the current ${season} season with the data available.`,
      `Record soil type, pH, irrigation and farm coordinates, then retry. ${t('fullPage', lang)}`,
      `\n${t('note', lang)}`,
    ].join('\n');
  }
  const lines = [
    `**${t('recommend', lang)} — ${season} season**`,
    `Quick screen using your ${areaText(ctx)} farm, ${ctx.climate?.annualRainfallMm ?? 'unavailable'} mm historical annual rainfall, ${ctx.climate?.meanTempC ?? 'unavailable'}°C mean temperature, soil ${ctx.farm.soil_type ?? 'not recorded'}.`,
  ];
  candidates.forEach((c, i) => {
    lines.push(`\n${i + 1}. **${c.name}** — quick fit ${c.score}/100`);
    if (c.reasons.length) lines.push(`   Why: ${c.reasons.join('; ')}.`);
    if (c.cautions.length) lines.push(`   Check: ${c.cautions.join('; ')}.`);
  });
  lines.push(`\n${t('fullPage', lang)}`);
  lines.push(t('note', lang));
  return lines.join('\n');
}

function sourcesBlock(ctx: FarmContext, lang: Lang): string {
  if (!ctx.sources.length) return '';
  return `\n\n**${t('sources', lang)}**\n` + ctx.sources
    .map((s) => `• ${s.provider} — ${s.dataset}${s.observationDate ? ` (observation ${s.observationDate})` : ''}; retrieved ${s.retrievedAt.slice(0, 16).replace('T', ' ')}${s.note ? `. ${s.note}` : ''}`)
    .join('\n');
}

export function rulesAnswer(ctx: FarmContext, message: string, language: string): string {
  const lang: Lang = language === 'mr' || language === 'hi' ? language : 'en';
  const intent = detectIntent(message);
  let body: string;
  if (!ctx.farm && intent !== 'overview') {
    body = overview(ctx, lang);
  } else {
    switch (intent) {
      case 'expenses': body = expenses(ctx, lang); break;
      case 'income': body = income(ctx, lang); break;
      case 'weather': body = weather(ctx, lang); break;
      case 'market': body = market(ctx, lang, message); break;
      case 'crops': body = crops(ctx, lang); break;
      case 'tasks': body = tasks(ctx, lang); break;
      case 'soil': body = soil(ctx, lang); break;
      case 'recommend': body = recommend(ctx, lang); break;
      default: body = overview(ctx, lang);
    }
  }

  const missing = ctx.missing.length
    ? `\n\n**${t('missing', lang)}:** ${ctx.missing.join(', ')}.`
    : '';
  const month = monthName(new Date().getMonth() + 1);
  return [
    `_${month} ${new Date().getFullYear()} · FarmDesk Rules Engine (no AI model configured)._`,
    body,
    missing,
    sourcesBlock(ctx, lang),
  ].filter(Boolean).join('\n');
}
