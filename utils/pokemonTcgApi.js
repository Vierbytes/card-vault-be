/**
 * Pokewallet API Service
 *
 * This is a supplementary data source for CardVault. While TCGdex handles
 * search, pricing, and images, Pokewallet gives us the detailed card
 * mechanics that collectors and players care about - attacks, abilities,
 * weaknesses, resistances, and retreat cost.
 *
 * The tricky part was that Pokewallet uses its own ID format (pk_xxxxx)
 * instead of the TCGdex format (swsh3-136). So I have to search by the
 * card name and then try to match the right result using the card number.
 *
 * The attack data comes as HTML-formatted strings that I had to write
 * parsers for - the energy costs are encoded like [1RR] or [Lightning]
 * which was kind of fun to figure out.
 *
 * Docs: https://www.pokewallet.io/api-docs
 */

/**
 * Map of single-letter energy abbreviations to full type names
 * Pokewallet uses these in attack cost strings like [1RR] or [GCC]
 * The number represents colorless energy, letters are specific types
 */
const ENERGY_CODES = {
  R: 'Fire',
  W: 'Water',
  G: 'Grass',
  L: 'Lightning',
  P: 'Psychic',
  F: 'Fighting',
  D: 'Darkness',
  M: 'Metal',
  Y: 'Fairy',
  N: 'Dragon',
  C: 'Colorless',
};

/**
 * Map of single-letter weakness/resistance abbreviations to full type names
 * Pokewallet weakness format is like "Wx2" (Water x2) or "Mx2" (Metal x2)
 */
const TYPE_CODES = {
  R: 'Fire',
  W: 'Water',
  G: 'Grass',
  L: 'Lightning',
  P: 'Psychic',
  F: 'Fighting',
  D: 'Darkness',
  M: 'Metal',
  Y: 'Fairy',
  N: 'Dragon',
};

/**
 * Strip HTML tags from a string
 * Pokewallet returns attack text and card_text with <br>, <strong>, <em> tags
 *
 * @param {string} html - String that might contain HTML
 * @returns {string} Clean text without HTML tags
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse the energy cost from an attack string
 *
 * Pokewallet encodes energy costs in square brackets at the start of attacks.
 * Two formats I've seen:
 *   - Short: [1RR] where numbers = colorless, letters = specific types
 *   - Long: [Lightning][Colorless][Colorless] with full type names
 *
 * @param {string} costStr - The cost portion like "1RR" or "Lightning"
 * @returns {string[]} Array of energy type names like ['Colorless', 'Fire', 'Fire']
 */
function parseEnergyCost(costStr) {
  if (!costStr) return [];

  const costs = [];

  // Check if it uses the long format first: [Lightning][Colorless]
  // by seeing if the string contains full type names
  const longFormatTypes = [
    'Fire', 'Water', 'Grass', 'Lightning', 'Psychic',
    'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless',
  ];

  const lowerStr = costStr.toLowerCase();
  const hasLongFormat = longFormatTypes.some(
    (type) => lowerStr.includes(type.toLowerCase())
  );

  if (hasLongFormat) {
    // Long format: split by ][  and clean up
    const parts = costStr.replace(/^\[/, '').replace(/\]$/, '').split('][');
    for (const part of parts) {
      const cleaned = part.trim();
      // Find matching type (case-insensitive)
      const match = longFormatTypes.find(
        (t) => t.toLowerCase() === cleaned.toLowerCase()
      );
      if (match) costs.push(match);
    }
    return costs;
  }

  // Short format: [1RR] or [3] or [GCC]
  for (const char of costStr) {
    if (char >= '0' && char <= '9') {
      // Numbers represent colorless energy
      const count = parseInt(char);
      for (let i = 0; i < count; i++) {
        costs.push('Colorless');
      }
    } else if (ENERGY_CODES[char.toUpperCase()]) {
      costs.push(ENERGY_CODES[char.toUpperCase()]);
    }
  }

  return costs;
}

/**
 * Parse a Pokewallet attack string into a structured object
 *
 * Attack strings come in formats like:
 *   "[1RR] Explosive Fire (130+)\r\n<br>Does 100 more damage if..."
 *   "[Lightning] Pika Ball (30)"
 *   "[3] Telekinesis\r\n<br>This attack does 50 damage..."
 *
 * I had to handle cases where damage might not exist (like status moves)
 * and where the description is on a second line with HTML <br> tags.
 *
 * @param {string} attackStr - Raw attack string from Pokewallet
 * @returns {Object} Parsed attack with name, cost, damage, text
 */
function parseAttack(attackStr) {
  if (!attackStr) return null;

  // Clean up the string first
  const cleaned = stripHtml(attackStr);

  // Extract ALL energy cost brackets from the start of the attack string
  // Pokewallet uses two formats:
  //   Short: [1RR] - single bracket with codes
  //   Long: [Colorless][Colorless] - multiple brackets with full type names
  // I need to grab ALL consecutive [brackets] before the attack name
  let cost = [];
  let remainder = cleaned;

  // Match all consecutive [bracket] groups at the start
  const allBracketsMatch = cleaned.match(/^(\[([^\]]+)\]\s*)+/);
  if (allBracketsMatch) {
    const bracketStr = allBracketsMatch[0];
    remainder = cleaned.slice(bracketStr.length);

    // Extract each individual [bracket] content
    const individualBrackets = bracketStr.match(/\[([^\]]+)\]/g);
    if (individualBrackets) {
      // Check if this is short format (single bracket like [1RR]) or long format
      if (individualBrackets.length === 1) {
        // Could be short format [1RR] or long format [Lightning]
        const inner = individualBrackets[0].replace(/[[\]]/g, '');
        cost = parseEnergyCost(inner);
      } else {
        // Multiple brackets = long format like [Colorless][Colorless]
        for (const bracket of individualBrackets) {
          const inner = bracket.replace(/[[\]]/g, '');
          cost.push(...parseEnergyCost(inner));
        }
      }
    }
  }

  // Extract attack name and damage
  // Damage is usually in parentheses like (130+) or (30x) at the end of the first part
  // But sometimes there's no damage (utility attacks)
  const damageMatch = remainder.match(/^(.+?)\s*\((\d+[+x×]?)\)\s*(.*)/);

  let name = '';
  let damage = '';
  let text = '';

  if (damageMatch) {
    name = damageMatch[1].trim();
    damage = damageMatch[2];
    text = damageMatch[3].trim();
  } else {
    // No damage value - split on first sentence boundary or take it all as name
    const parts = remainder.split(/\s+(.+)/);
    // Try to find where the name ends - usually it's the first 1-3 words before descriptive text
    const nameMatch = remainder.match(/^([\w\s'-]+?)(?:\s{2,}|\s+(?:This|Your|Each|If|When|During|Once|You|Discard|Draw|Search|Flip|Heal|Choose|Put|Attach|Switch|Move|Look|Remove|Prevent))/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
      text = remainder.slice(nameMatch[1].length).trim();
    } else {
      name = remainder.trim();
    }
  }

  return {
    name,
    cost,
    damage,
    text,
  };
}

/**
 * Parse the weakness string from Pokewallet
 *
 * Formats I've seen:
 *   "Wx2" (Water x2)
 *   "[Fighting]x2"
 *   "Fx2" (Fighting x2)
 *   null (no weakness)
 *
 * @param {string} weaknessStr - Raw weakness string
 * @returns {Object[]} Array of {type, value} objects
 */
function parseWeakness(weaknessStr) {
  if (!weaknessStr) return [];

  // Check for long format with brackets like [Fighting]x2
  const bracketMatch = weaknessStr.match(/\[(\w+)\]\s*(x\d+)/);
  if (bracketMatch) {
    return [{ type: bracketMatch[1], value: bracketMatch[2] }];
  }

  // Full type name without brackets like "Fighting x2" or "Fire x2"
  const fullNameMatch = weaknessStr.match(/^(\w+)\s+(x\d+)$/);
  if (fullNameMatch) {
    return [{ type: fullNameMatch[1], value: fullNameMatch[2] }];
  }

  // Short format like Wx2, Fx2, Mx2
  const shortMatch = weaknessStr.match(/^([A-Z])(x\d+)$/);
  if (shortMatch && TYPE_CODES[shortMatch[1]]) {
    return [{ type: TYPE_CODES[shortMatch[1]], value: shortMatch[2] }];
  }

  // Fallback - just return the raw string as type
  return [{ type: weaknessStr, value: '' }];
}

/**
 * Parse the resistance string from Pokewallet
 *
 * Similar to weakness but with minus values like "D-20" or "[Metal]-30"
 *
 * @param {string} resistanceStr - Raw resistance string
 * @returns {Object[]} Array of {type, value} objects
 */
function parseResistance(resistanceStr) {
  if (!resistanceStr) return [];

  // Check for long format with brackets like [Metal]-30
  const bracketMatch = resistanceStr.match(/\[(\w+)\]\s*(-\d+)/);
  if (bracketMatch) {
    return [{ type: bracketMatch[1], value: bracketMatch[2] }];
  }

  // Full type name without brackets like "Darkness -20" or "Fighting -30"
  const fullNameMatch = resistanceStr.match(/^(\w+)\s+(-\d+)$/);
  if (fullNameMatch) {
    return [{ type: fullNameMatch[1], value: fullNameMatch[2] }];
  }

  // Short format like D-20, M-30
  const shortMatch = resistanceStr.match(/^([A-Z])(-\d+)$/);
  if (shortMatch && TYPE_CODES[shortMatch[1]]) {
    return [{ type: TYPE_CODES[shortMatch[1]], value: shortMatch[2] }];
  }

  // Fallback
  return [{ type: resistanceStr, value: '' }];
}

/**
 * Parse the card_text field to extract abilities
 *
 * Pokewallet puts abilities in the card_text field with HTML formatting:
 *   "<strong>Ability — Bright Heal</strong>\n<br>\nOnce during your turn..."
 *
 * Some cards have multiple abilities, and some cards use card_text for
 * rules instead (like Trainer cards or Pokemon ex rules).
 *
 * @param {string} cardText - Raw card_text from Pokewallet
 * @returns {{ abilities: Object[], rules: string[] }}
 */
function parseCardText(cardText) {
  if (!cardText) return { abilities: [], rules: [] };

  const abilities = [];
  const rules = [];

  // Split on ability markers - look for "Ability —" or "Ability:" patterns
  // Some cards have the ability name in <strong> tags
  const abilityPattern = /(?:<strong>)?\s*(Ability|Poké-Body|Poké-Power|Ancient Trait)\s*[—:–]\s*(.+?)(?:<\/strong>)\s*(?:<br\s*\/?>)?\s*([\s\S]*?)(?=(?:<strong>|$))/gi;

  let match;
  let foundAbility = false;

  while ((match = abilityPattern.exec(cardText)) !== null) {
    foundAbility = true;
    abilities.push({
      name: stripHtml(match[2]).trim(),
      text: stripHtml(match[3]).trim(),
      type: stripHtml(match[1]).trim(),
    });
  }

  // If no abilities were found, the card_text might be a rule or flavor text
  if (!foundAbility) {
    const cleanedText = stripHtml(cardText).trim();
    if (cleanedText) {
      rules.push(cleanedText);
    }
  }

  return { abilities, rules };
}

/**
 * Convert retreat cost number to array of Colorless energy
 *
 * Pokewallet gives retreat cost as a decimal string like "2.0" or "3.0"
 * The frontend expects an array like ['Colorless', 'Colorless']
 *
 * @param {string|number} retreatCost - Retreat cost value
 * @returns {string[]} Array of 'Colorless' strings
 */
function parseRetreatCost(retreatCost) {
  if (!retreatCost) return [];
  const count = Math.round(parseFloat(retreatCost));
  if (isNaN(count) || count <= 0) return [];
  return Array(count).fill('Colorless');
}

/**
 * Fetch detailed card mechanics from the Pokewallet API
 *
 * Since Pokewallet uses its own IDs (pk_xxxxx), I search by card name
 * and try to match based on the card number. The card name and number
 * come from the TCGdex data that the controller already has.
 *
 * This only gets called from the card detail page - we don't need mechanics
 * data for search results or random cards. If the API call fails for any
 * reason, we just return null and the frontend gracefully hides the
 * mechanics sections.
 *
 * @param {string} cardName - The card name from TCGdex
 * @param {string} cardNumber - The card number from TCGdex (e.g., '136')
 * @returns {Object|null} Formatted mechanics object or null on failure
 */
const getCardMechanics = async (cardName, cardNumber) => {
  try {
    const apiKey = process.env.POKEWALLET_API_KEY;

    if (!apiKey) {
      console.warn('POKEWALLET_API_KEY not set - skipping mechanics fetch');
      return null;
    }

    if (!cardName) return null;

    // 12 second timeout - Pokewallet can be slow, especially when their
    // cache is down. I'd rather wait a bit longer than show no data at all.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    // Search by card name - Pokewallet doesn't support TCGdex IDs
    // I'm limiting to 10 results and hoping to find a match by card number
    const searchUrl = `https://api.pokewallet.io/search?q=${encodeURIComponent(cardName)}&limit=10`;

    const response = await fetch(searchUrl, {
      headers: {
        'X-API-Key': apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Pokewallet API returned ${response.status} for "${cardName}"`);
      return null;
    }

    const data = await response.json();
    const results = data.results;

    if (!results || results.length === 0) return null;

    // Filter out non-real cards like "Code Card" listings and cards
    // without any actual game data (no HP, no attacks)
    const realCards = results.filter((r) => {
      const info = r.card_info;
      if (!info) return false;
      // Skip code cards, tokens, and other non-playable items
      if (info.rarity === 'Code Card') return false;
      if (info.name?.includes('Code Card')) return false;
      // Must have at least HP or attacks to be a real card
      return info.hp || (info.attacks && info.attacks.length > 0);
    });

    if (realCards.length === 0) return null;

    // Try to find the best match - prefer matching by card number
    // since multiple cards can share the same name (different sets/printings)
    let bestMatch = realCards[0]; // Default to first real card

    if (cardNumber) {
      for (const result of realCards) {
        const resultNum = result.card_info?.card_number;
        if (!resultNum) continue;

        // Card numbers can be like "136/189" or just "136"
        // TCGdex gives us just the number part
        const numPart = resultNum.split('/')[0];
        if (numPart === cardNumber || numPart === String(parseInt(cardNumber))) {
          bestMatch = result;
          break;
        }
      }
    }

    const card = bestMatch.card_info;
    if (!card) return null;

    // Parse attacks from the HTML-formatted strings
    const attacks = (card.attacks || [])
      .map(parseAttack)
      .filter((a) => a !== null);

    // Parse abilities and rules from card_text
    const { abilities, rules } = parseCardText(card.card_text);

    // Parse weakness, resistance, and retreat cost
    const weaknesses = parseWeakness(card.weakness);
    const resistances = parseResistance(card.resistance);
    const retreatCost = parseRetreatCost(card.retreat_cost);

    return {
      attacks,
      abilities,
      weaknesses,
      resistances,
      retreatCost,
      stage: card.stage || null,
      subtypes: card.stage ? [card.stage] : [],
      rules,
      cardType: card.card_type || null,
    };
  } catch (error) {
    // AbortError means our timeout fired - the API was too slow
    if (error.name === 'AbortError') {
      console.warn(`Pokewallet API timed out for "${cardName}"`);
    } else {
      console.warn(`Pokewallet API error for "${cardName}":`, error.message);
    }
    return null;
  }
};

module.exports = {
  getCardMechanics,
};
