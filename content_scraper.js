// Immediately-invoked scraper that runs in the page context and returns the article text.
(() => {
    const ARTICLE_SELECTORS = [
        'article',
        '[role="main"]',
        '.post-content',
        '.article-content',
        '.entry-content',
        '.content',
        'main',
        '.body-content',
        '.story-body'
    ];

    // Try to grab a coherent article block first
    let articleText = '';
    for (const sel of ARTICLE_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) {
            articleText = el.innerText.trim();
            if (articleText.length > 200) break; // found meaningful content
        }
    }

    // Fallback: collect headings and paragraphs if no article block found
    if (!articleText || articleText.length < 200) {
        const nodes = document.querySelectorAll('h1,h2,h3,p,li');
        const parts = [];
        nodes.forEach(el => {
            const text = el.innerText.trim();
            if (text.length > 10) parts.push(text);
        });
        articleText = parts.join('\n\n');
    }

    // Basic cleanup: collapse long whitespace
    articleText = articleText.replace(/\s{2,}/g, ' ').trim();

    // Allow up to a generous limit so analysis has sufficient context
    const MAX_CHARS = 20000;
    return articleText.substring(0, MAX_CHARS);
})();