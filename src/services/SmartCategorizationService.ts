/**
 * Smart Categorization Service
 * Provides intelligent category suggestions based on merchant patterns,
 * spending history, and user behavior learning.
 */

export interface CategorySuggestion {
  category: string;
  confidence: number;
  reason: string;
  subcategory?: string;
}

export interface MerchantPattern {
  merchant_name: string;
  category: string;
  frequency: number;
  last_used: string;
  confidence: number;
}

export interface SpendingPattern {
  category: string;
  typical_amount_range: { min: number; max: number };
  frequency_per_month: number;
  common_merchants: string[];
  typical_days: number[]; // Day of week (0-6)
  seasonal_variance: { [month: string]: number };
}

export class SmartCategorizationService {
  private merchantPatterns: Map<string, MerchantPattern> = new Map();
  private spendingPatterns: Map<string, SpendingPattern> = new Map();
  private userCorrections: Map<string, { from: string; to: string; timestamp: string }[]> = new Map();

  constructor(private receipts: any[] = []) {
    this.buildPatterns();
  }

  /**
   * Build patterns from historical receipt data
   */
  private buildPatterns(): void {
    const merchantCategoryMap = new Map<string, { category: string; count: number; amounts: number[]; dates: string[] }>();
    const categoryStats = new Map<string, { amounts: number[]; merchants: Set<string>; dates: string[] }>();

    // Analyze historical data
    this.receipts.forEach(receipt => {
      if (!receipt.merchant_name || !receipt.category || receipt.category === 'other') return;

      const merchantKey = this.normalizeMerchantName(receipt.merchant_name);
      const category = receipt.category;
      const amount = receipt.total_amount;
      const date = new Date(receipt.receipt_date);

      // Build merchant patterns
      if (!merchantCategoryMap.has(merchantKey)) {
        merchantCategoryMap.set(merchantKey, { 
          category, 
          count: 0, 
          amounts: [], 
          dates: [] 
        });
      }
      const merchantData = merchantCategoryMap.get(merchantKey)!;
      
      if (merchantData.category === category) {
        merchantData.count++;
        merchantData.amounts.push(amount);
        merchantData.dates.push(receipt.receipt_date);
      }

      // Build category spending patterns
      if (!categoryStats.has(category)) {
        categoryStats.set(category, { 
          amounts: [], 
          merchants: new Set(), 
          dates: [] 
        });
      }
      const categoryData = categoryStats.get(category)!;
      categoryData.amounts.push(amount);
      categoryData.merchants.add(merchantKey);
      categoryData.dates.push(receipt.receipt_date);
    });

    // Convert to patterns
    merchantCategoryMap.forEach((data, merchantKey) => {
      if (data.count >= 2) { // Only store patterns with at least 2 occurrences
        this.merchantPatterns.set(merchantKey, {
          merchant_name: merchantKey,
          category: data.category,
          frequency: data.count,
          last_used: Math.max(...data.dates.map(d => new Date(d).getTime())).toString(),
          confidence: Math.min(0.95, 0.5 + (data.count * 0.1))
        });
      }
    });

    // Build spending patterns
    categoryStats.forEach((data, category) => {
      if (data.amounts.length >= 3) {
        const amounts = data.amounts.sort((a, b) => a - b);
        const dates = data.dates.map(d => new Date(d));
        const daysOfWeek = dates.map(d => d.getDay());
        const months = dates.map(d => d.getMonth());

        // Calculate typical amount range (25th to 75th percentile)
        const q1Index = Math.floor(amounts.length * 0.25);
        const q3Index = Math.floor(amounts.length * 0.75);

        // Calculate frequency per month
        const dateRange = Math.max(...dates.map(d => d.getTime())) - Math.min(...dates.map(d => d.getTime()));
        const monthsSpanned = Math.max(1, dateRange / (30 * 24 * 60 * 60 * 1000));
        const frequencyPerMonth = data.amounts.length / monthsSpanned;

        // Calculate seasonal variance
        const monthlyVariance: { [month: string]: number } = {};
        for (let i = 0; i < 12; i++) {
          const monthCount = months.filter(m => m === i).length;
          monthlyVariance[i.toString()] = monthCount / data.amounts.length;
        }

        this.spendingPatterns.set(category, {
          category,
          typical_amount_range: { 
            min: amounts[q1Index], 
            max: amounts[q3Index] 
          },
          frequency_per_month: frequencyPerMonth,
          common_merchants: Array.from(data.merchants).slice(0, 10),
          typical_days: this.getTopValues(daysOfWeek, 3),
          seasonal_variance: monthlyVariance
        });
      }
    });
  }

  /**
   * Get category suggestions for a receipt
   */
  public getCategorySuggestions(receipt: {
    merchant_name?: string;
    total_amount: number;
    receipt_date: string;
    description?: string;
  }): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];

    // 1. Merchant-based suggestion
    if (receipt.merchant_name) {
      const merchantSuggestion = this.getMerchantBasedSuggestion(receipt.merchant_name);
      if (merchantSuggestion) {
        suggestions.push(merchantSuggestion);
      }
    }

    // 2. Amount-based suggestions
    const amountSuggestions = this.getAmountBasedSuggestions(receipt.total_amount);
    suggestions.push(...amountSuggestions);

    // 3. Keyword-based suggestions
    const keywordSuggestions = this.getKeywordBasedSuggestions(
      receipt.merchant_name,
      receipt.description
    );
    suggestions.push(...keywordSuggestions);

    // 4. Temporal pattern suggestions
    const temporalSuggestions = this.getTemporalSuggestions(receipt.receipt_date);
    suggestions.push(...temporalSuggestions);

    // Deduplicate and sort by confidence
    const uniqueSuggestions = this.deduplicateAndRank(suggestions);
    
    return uniqueSuggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Learn from user corrections to improve future suggestions
   */
  public learnFromCorrection(
    receipt: any,
    suggestedCategory: string,
    actualCategory: string
  ): void {
    if (suggestedCategory === actualCategory) return;

    const merchantKey = receipt.merchant_name ? 
      this.normalizeMerchantName(receipt.merchant_name) : 'unknown';
    
    if (!this.userCorrections.has(merchantKey)) {
      this.userCorrections.set(merchantKey, []);
    }

    this.userCorrections.get(merchantKey)!.push({
      from: suggestedCategory,
      to: actualCategory,
      timestamp: new Date().toISOString()
    });

    // Update merchant pattern if this is a repeated correction
    const corrections = this.userCorrections.get(merchantKey)!;
    const recentCorrections = corrections.filter(c => {
      const age = Date.now() - new Date(c.timestamp).getTime();
      return age < 30 * 24 * 60 * 60 * 1000; // Last 30 days
    });

    if (recentCorrections.length >= 2 && 
        recentCorrections.every(c => c.to === actualCategory)) {
      // Update or create merchant pattern
      this.merchantPatterns.set(merchantKey, {
        merchant_name: merchantKey,
        category: actualCategory,
        frequency: recentCorrections.length,
        last_used: new Date().toISOString(),
        confidence: 0.8 // High confidence for user-corrected patterns
      });
    }
  }

  /**
   * Get category suggestions for bulk categorization
   */
  public getBulkCategorySuggestions(receipts: any[]): Map<string, CategorySuggestion[]> {
    const suggestions = new Map<string, CategorySuggestion[]>();
    
    receipts.forEach(receipt => {
      if (!receipt.category || receipt.category === 'other') {
        const receiptSuggestions = this.getCategorySuggestions(receipt);
        if (receiptSuggestions.length > 0) {
          suggestions.set(receipt.id, receiptSuggestions);
        }
      }
    });

    return suggestions;
  }

  /**
   * Get merchant-based category suggestion
   */
  private getMerchantBasedSuggestion(merchantName: string): CategorySuggestion | null {
    const normalizedName = this.normalizeMerchantName(merchantName);
    const pattern = this.merchantPatterns.get(normalizedName);
    
    if (pattern) {
      return {
        category: pattern.category,
        confidence: pattern.confidence,
        reason: `Based on ${pattern.frequency} previous transactions with ${merchantName}`,
        subcategory: this.getSubcategoryForMerchant(normalizedName, pattern.category)
      };
    }

    // Fuzzy matching for similar merchant names
    const similarMerchant = this.findSimilarMerchant(normalizedName);
    if (similarMerchant) {
      return {
        category: similarMerchant.category,
        confidence: similarMerchant.confidence * 0.7, // Reduce confidence for fuzzy match
        reason: `Based on similarity to ${similarMerchant.merchant_name}`,
        subcategory: this.getSubcategoryForMerchant(similarMerchant.merchant_name, similarMerchant.category)
      };
    }

    return null;
  }

  /**
   * Get amount-based suggestions
   */
  private getAmountBasedSuggestions(amount: number): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];

    this.spendingPatterns.forEach((pattern, category) => {
      const { min, max } = pattern.typical_amount_range;
      
      if (amount >= min && amount <= max) {
        const confidence = this.calculateAmountConfidence(amount, min, max);
        suggestions.push({
          category,
          confidence,
          reason: `Amount $${amount} is typical for ${category} (usually $${min}-$${max})`,
        });
      }
    });

    return suggestions;
  }

  /**
   * Get keyword-based suggestions
   */
  private getKeywordBasedSuggestions(
    merchantName?: string,
    description?: string
  ): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];
    const text = `${merchantName || ''} ${description || ''}`.toLowerCase();

    const categoryKeywords = {
      'food_dining': ['restaurant', 'cafe', 'food', 'pizza', 'burger', 'coffee', 'grocery', 'market', 'deli', 'bakery'],
      'transportation': ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'parking', 'metro', 'bus', 'train'],
      'shopping': ['store', 'shop', 'retail', 'clothing', 'amazon', 'target', 'walmart'],
      'healthcare': ['pharmacy', 'doctor', 'medical', 'hospital', 'clinic', 'dental', 'cvs', 'walgreens'],
      'entertainment': ['movie', 'theater', 'gym', 'fitness', 'netflix', 'spotify', 'game'],
      'business': ['office', 'supply', 'software', 'conference', 'meeting', 'professional'],
      'travel': ['hotel', 'flight', 'airline', 'booking', 'airbnb', 'car rental'],
      'utilities': ['electric', 'gas', 'water', 'internet', 'phone', 'cable', 'utility'],
      'home_garden': ['home', 'depot', 'lowes', 'garden', 'furniture', 'hardware'],
      'education': ['school', 'university', 'course', 'book', 'education', 'training']
    };

    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
      const matchedKeywords = keywords.filter(keyword => text.includes(keyword));
      
      if (matchedKeywords.length > 0) {
        const confidence = Math.min(0.8, 0.3 + (matchedKeywords.length * 0.2));
        suggestions.push({
          category,
          confidence,
          reason: `Contains keywords: ${matchedKeywords.join(', ')}`,
        });
      }
    });

    return suggestions;
  }

  /**
   * Get temporal pattern suggestions
   */
  private getTemporalSuggestions(receiptDate: string): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];
    const date = new Date(receiptDate);
    const dayOfWeek = date.getDay();
    const month = date.getMonth();

    this.spendingPatterns.forEach((pattern, category) => {
      // Check if this day of week is typical for this category
      if (pattern.typical_days.includes(dayOfWeek)) {
        suggestions.push({
          category,
          confidence: 0.3,
          reason: `${category} expenses are common on ${this.getDayName(dayOfWeek)}s`,
        });
      }

      // Check seasonal patterns
      const monthlyVariance = pattern.seasonal_variance[month.toString()];
      if (monthlyVariance > 0.15) { // Above average for this month
        suggestions.push({
          category,
          confidence: 0.25,
          reason: `${category} expenses are more common in ${this.getMonthName(month)}`,
        });
      }
    });

    return suggestions;
  }

  /**
   * Utility functions
   */
  private normalizeMerchantName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findSimilarMerchant(merchantName: string): MerchantPattern | null {
    const threshold = 0.7;
    let bestMatch: MerchantPattern | null = null;
    let bestScore = 0;

    this.merchantPatterns.forEach((pattern) => {
      const similarity = this.calculateStringSimilarity(merchantName, pattern.merchant_name);
      if (similarity > threshold && similarity > bestScore) {
        bestScore = similarity;
        bestMatch = pattern;
      }
    });

    return bestMatch;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateAmountConfidence(amount: number, min: number, max: number): number {
    const range = max - min;
    const center = (min + max) / 2;
    const distance = Math.abs(amount - center);
    const normalizedDistance = distance / (range / 2);
    
    return Math.max(0.1, 0.7 - (normalizedDistance * 0.4));
  }

  private getTopValues<T>(array: T[], count: number): T[] {
    const frequency = new Map<T, number>();
    array.forEach(item => {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    });
    
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([value]) => value);
  }

  private deduplicateAndRank(suggestions: CategorySuggestion[]): CategorySuggestion[] {
    const categoryMap = new Map<string, CategorySuggestion>();
    
    suggestions.forEach(suggestion => {
      const existing = categoryMap.get(suggestion.category);
      if (!existing || suggestion.confidence > existing.confidence) {
        categoryMap.set(suggestion.category, suggestion);
      }
    });
    
    return Array.from(categoryMap.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  private getSubcategoryForMerchant(merchantName: string, category: string): string | undefined {
    // Simple subcategory mapping based on merchant patterns
    const subcategoryMap: { [key: string]: { [merchant: string]: string } } = {
      'food_dining': {
        'mcdonald': 'fast_food',
        'starbucks': 'coffee',
        'subway': 'fast_food',
        'whole foods': 'grocery',
        'trader joe': 'grocery'
      },
      'transportation': {
        'shell': 'fuel',
        'exxon': 'fuel',
        'uber': 'rideshare',
        'lyft': 'rideshare'
      }
    };

    const categoryMap = subcategoryMap[category];
    if (!categoryMap) return undefined;

    for (const [merchant, subcategory] of Object.entries(categoryMap)) {
      if (merchantName.includes(merchant)) {
        return subcategory;
      }
    }

    return undefined;
  }

  private getDayName(dayIndex: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex];
  }

  private getMonthName(monthIndex: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }

  /**
   * Get statistics about categorization patterns
   */
  public getCategorizationStats(): {
    totalPatterns: number;
    merchantPatterns: number;
    spendingPatterns: number;
    userCorrections: number;
    topMerchants: Array<{ merchant: string; category: string; frequency: number }>;
    categoryCoverage: { [category: string]: number };
  } {
    const topMerchants = Array.from(this.merchantPatterns.entries())
      .sort((a, b) => b[1].frequency - a[1].frequency)
      .slice(0, 10)
      .map(([merchant, pattern]) => ({
        merchant,
        category: pattern.category,
        frequency: pattern.frequency
      }));

    const categoryCoverage: { [category: string]: number } = {};
    this.spendingPatterns.forEach((pattern, category) => {
      categoryCoverage[category] = pattern.frequency_per_month;
    });

    const totalCorrections = Array.from(this.userCorrections.values())
      .reduce((sum, corrections) => sum + corrections.length, 0);

    return {
      totalPatterns: this.merchantPatterns.size + this.spendingPatterns.size,
      merchantPatterns: this.merchantPatterns.size,
      spendingPatterns: this.spendingPatterns.size,
      userCorrections: totalCorrections,
      topMerchants,
      categoryCoverage
    };
  }
}