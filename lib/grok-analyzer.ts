import axios from 'axios';
import type { MUTCDSign } from '@/lib/types/mutcd';

// Analyze OCR JSON with Grok API (corrects artifacts, adds descriptions)
export const analyzeWithGrok = async (ocrSigns: MUTCDSign[]): Promise<MUTCDSign[]> => {
  // NEW: Log input for debug
  console.log('Sending to Grok:', JSON.stringify(ocrSigns, null, 2));
  try {
    const response = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: 'grok-4-fast-reasoning', // Grok 4 equivalent (use 'grok-4' if available later)
      messages: [
        {
          role: 'system',
          content: 'You are a MUTCD sign expert. Analyze and correct this OCR-extracted JSON for accuracy: Fix codes (e.g., "Ma-8" to "M4-8"), remove artifacts (e.g., "|", commas), add full descriptions from MUTCD standards, infer quantities if possible. Return ONLY the corrected JSON array—no extra text.'
        },
        {
          role: 'user',
          content: JSON.stringify(ocrSigns) // Passes your JSON as prompt
        }
      ],
      max_tokens: 1000, // Limit output to keep costs low
      temperature: 0.1, // Low for consistent corrections
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`, // Pulls from .env.local
        'Content-Type': 'application/json'
      }
    });

    // Log response for debug
    console.log('Grok response:', response.data.choices[0].message.content);

    const correctedJson = response.data.choices[0].message.content.trim();
    return JSON.parse(correctedJson); // Assume Grok returns clean JSON array
  } catch (err) {
    console.error('Grok API failed:', err);
    return ocrSigns; // Fallback to raw OCR
  }
};
