// This script contains the logic for the extension's popup.html

const statusEl = document.getElementById('status');
const resultTextEl = document.getElementById('result-text');
const summaryEl = document.getElementById('summary');
const analyzeButton = document.getElementById('analyze-button');

// Minimum character threshold for analysis (lowered so shorter articles can be analyzed)
const MIN_CHARS_FOR_ANALYSIS = 500; 

// API Key is intentionally empty. The canvas environment will inject it at runtime.
const apiKey = "AIzaSyA46tcFoaBAfKXS3u8bd0fww852ugIJPsw"; 
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

/**
 * Updates the status box with the given message and style.
 * @param {string} message 
 * @param {string} type - 'loading', 'credible', 'suspicious', 'neutral', 'error'
 */
function updateStatus(message, type = 'loading') {
  statusEl.textContent = message;
  statusEl.className = 'status-box flex items-center justify-center';
  
  // Remove existing status classes
  statusEl.classList.remove('status-loading', 'status-credible', 'status-suspicious', 'status-neutral', 'bg-red-200', 'text-red-800', 'font-semibold', 'text-blue-900');
  
  // Clear inner HTML before setting the message
  statusEl.innerHTML = '';

  if (type === 'loading') {
    statusEl.classList.add('status-loading', 'text-blue-900', 'font-semibold');
    // Re-insert spinner for loading state
    statusEl.innerHTML = `<div class="spinner mr-3"></div> ${message}`;
  } else if (type === 'credible') {
    statusEl.classList.add('status-credible');
    statusEl.textContent = message;
  } else if (type === 'suspicious') {
    statusEl.classList.add('status-suspicious');
    statusEl.textContent = message;
  } else if (type === 'neutral') {
    statusEl.classList.add('status-neutral');
    statusEl.textContent = message;
  } else if (type === 'error') {
    statusEl.classList.add('bg-red-200', 'text-red-800', 'font-semibold');
    statusEl.textContent = message;
  }
  
  analyzeButton.classList.remove('hidden');
}

/**
 * Calls the Gemini API to classify the text's credibility.
 * @param {string} articleText The text scraped from the page.
 */
async function classifyText(articleText) {
  // Use the new, lower threshold
  if (!articleText || articleText.length < MIN_CHARS_FOR_ANALYSIS) {
    updateStatus(`⚠️ Not enough content found (Min ${MIN_CHARS_FOR_ANALYSIS} chars).`, 'neutral');
    summaryEl.textContent = `The scraper could only find ${articleText.length || 0} characters of text. This may be insufficient for a full analysis — try focusing the page on the main article content.`;
    resultTextEl.classList.remove('hidden');
    return;
  }
  
  updateStatus("Analyzing content with AI...", 'loading');

  const systemPrompt = `You are a professional news analyst. Your task is to evaluate the provided article content based on style, tone, and language patterns, and categorize its credibility into one of three types: "Credible", "Suspicious", or "Neutral/Uncertain". 
  
  - Use "Suspicious" if the tone is highly emotional, uses excessive sensationalism (clickbait language, all-caps, urgent warnings), lacks citations, or uses vague claims.
  - Use "Credible" if the tone is objective, formal, balanced, and focuses on verifiable facts.
  - Use "Neutral/Uncertain" if the content is too short, or lacks enough context to determine either way (e.g., a simple product listing or brief abstract).
  
  Provide your response in JSON format. Do not include any text outside the JSON object.

  JSON Structure:
  {
    "status": "[Credible|Suspicious|Neutral/Uncertain]",
    "reasoning": "A brief, one-sentence explanation of why you assigned that status (e.g., 'The language is highly emotional and uses unsubstantiated claims.')"
  }`;

  const userQuery = `Analyze the credibility of the following article text:\n\n---\n${articleText}`;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "OBJECT",
            properties: {
                "status": { 
                    "type": "STRING", 
                    "enum": ["Credible", "Suspicious", "Neutral/Uncertain"] 
                },
                "reasoning": { "type": "STRING" }
            }
        }
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorDetail = await response.text();
        console.error("API Fetch Error Details:", response.status, errorDetail);
        updateStatus(`API Error: ${response.status}`, 'error');
        summaryEl.textContent = `API responded with status ${response.status}. Details: ${errorDetail.substring(0, 500)}`;
        resultTextEl.classList.remove('hidden');
        return;
    }

    const result = await response.json();

    // Check if the response structure is valid
    const candidate = result.candidates?.[0];
    if (!candidate) {
        console.error('Invalid API response:', result);
        updateStatus('Error: Invalid API response', 'error');
        summaryEl.textContent = `Invalid API response structure. Full response (truncated): ${JSON.stringify(result).substring(0,1000)}`;
        resultTextEl.classList.remove('hidden');
        return;
    }

    const jsonString = candidate.content?.parts?.[0]?.text;
    if (!jsonString) {
        console.error('Missing content text in candidate:', candidate);
        updateStatus('Error: Missing API content', 'error');
        summaryEl.textContent = `API candidate is missing the generated text. Candidate (truncated): ${JSON.stringify(candidate).substring(0,1000)}`;
        resultTextEl.classList.remove('hidden');
        return;
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (e) {
      console.error('Failed to parse API JSON string:', jsonString, e);
      updateStatus('Error: Failed to parse API response', 'error');
      summaryEl.textContent = `Failed to parse API JSON output. Raw text (truncated): ${jsonString.substring(0,500)}`;
      resultTextEl.classList.remove('hidden');
      return;
    }

    const status = (parsedData.status || "").trim();
    const reasoning = (parsedData.reasoning || "").trim();

    if (!status) {
    updateStatus("Error: API did not return a status field.", "error");
    summaryEl.textContent = `Raw API output: ${JSON.stringify(parsedData).substring(0,500)}`;
    resultTextEl.classList.remove('hidden');
    return;
}


    
    let statusType;
    let displayMessage;

    if (status.includes('Suspicious')) {
      statusType = 'suspicious';
      displayMessage = `🔴 SUSPICIOUS CONTENT DETECTED`;
    } else if (status.includes('Credible')) {
      statusType = 'credible';
      displayMessage = `✅ CONTENT SEEMS REAL`;
    } else {
      statusType = 'neutral';
      displayMessage = `🟡 NEUTRAL / UNCERTAIN`;
    }
    
    updateStatus(displayMessage, statusType);
    summaryEl.textContent = reasoning;
    resultTextEl.classList.remove('hidden');

  } catch (error) {
    console.error("Gemini API Error:", error);
    updateStatus("Error: Could not classify content. Check console for details.", 'error');
    summaryEl.textContent = `Analysis failed. This often indicates a network or API issue. Details: ${error.message.substring(0, 200)}`;
    resultTextEl.classList.remove('hidden');
  }
}

/**
 * Main function to start the analysis process.
 */
async function startAnalysis() {
  updateStatus("Scraping page content...", 'loading');
  resultTextEl.classList.add('hidden');
  
  try {
    // 1. Query the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
        updateStatus("Error: No active tab found.", 'error');
        return;
    }

    // 2. Execute the scraping script in the active tab
    // We execute the function defined in content_scraper.js
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content_scraper.js'] // Use the local file
    });

    const articleText = results && results[0] && results[0].result ? results[0].result : '';

    // Show immediate feedback about scraped content length
    updateStatus(`Scraped ${articleText.length || 0} characters.`, 'loading');

    if (!articleText || articleText.length === 0) {
      updateStatus("Error: Scraper returned no content.", 'error');
      summaryEl.textContent = "The content scraper returned an empty string. This can happen if the page blocks script access or the selector failed. Check the page console for injection errors.";
      resultTextEl.classList.remove('hidden');
      return;
    }

    // 3. Classify the scraped text
    await classifyText(articleText);

  } catch (error) {
    console.error("Extension Scripting Error:", error);
    updateStatus("Error: Failed to access page content.", 'error');
  }
}

// Initialize analysis on popup load
document.addEventListener('DOMContentLoaded', startAnalysis);

// Re-run analysis on button click
analyzeButton.addEventListener('click', startAnalysis);