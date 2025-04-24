const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Namespace-level entry points
const baseUrls = [
  'https://help.solidworks.com/2025/english/api/swdocmgrapi/SolidWorks.Interop.swdocumentmgr~SolidWorks.Interop.swdocumentmgr_namespace.html?id=4044b78005984a01922553042935a3bc#Pg0',
  'https://help.solidworks.com/2025/english/api/swconst/SolidWorks.Interop.swconst~SolidWorks.Interop.swconst_namespace.html?id=4c923420736a49a98458345fd708984e#Pg0',
  'https://help.solidworks.com/2025/english/api/sldworksapi/SolidWorks.Interop.sldworks~SolidWorks.Interop.sldworks_namespace.html?id=f8d6d8535f3a49e7ad0538d96c234df8#Pg0'
];

const scrapedData = [];
const visitedUrls = new Set();

async function scrapePage(url, currentDepth, maxDepth) {
  if (visitedUrls.has(url)) return;

  console.log(`Scraping (depth ${currentDepth}) → ${url}`);
  visitedUrls.add(url);

  try {
    const res = await axios.get(url, { headers: { 'User-Agent': 'MyScraperBot/1.0' } });
    const $ = cheerio.load(res.data);

    const linksToFollow = [];

    // ───────────────────────────────────────────────────────── depth-0 ──
    // namespace page → gather interface topics
    if (currentDepth === 0) {
      const match = url.match(/~(.*?)_namespace\.html/);
      if (match) {
        const ns = match[1];                        // e.g. SolidWorks.Interop.swdocumentmgr
        $('a[href$=".html"]').each((_, a) => {
          const href = $(a).attr('href');
          if (!href) return;
          if (href.includes(`~${ns}.I`)) {          // only interface topics
            const abs = new URL(href, url).href;
            if (!visitedUrls.has(abs)) linksToFollow.push(abs);
          }
        });
      }
    }

    // ───────────────────────────────────────────────────────── depth-1 ──
    // interface topic → gather example pages
    if (currentDepth === 1) {
      $('h2, h3').filter((_, h) => $(h).text().trim().startsWith('Example'))
        .nextAll('a').each((_, a) => {
          const href = $(a).attr('href');
          if (!href) return;
          const abs = new URL(href, url).href;
          if (abs.match(/\.(htm|html?)$/i) && !visitedUrls.has(abs)) {
            linksToFollow.push(abs);
          }
        });
    }

    // ───────────────────────────────────────────────────────── depth-2 ──
    // example page → extract code & constants, stop recursion
    if (currentDepth === 2) {
      const title = $('h1, h2').first().text().trim();
      $('pre, code').each((_, block) => {
        scrapedData.push({
          title,
          language: ($(block).attr('class') || '').replace(/\bcode\b/, '') || 'unknown',
          snippet: $(block).text(),
          url
        });
      });

      $('code').each((_, ele) => {
        const constantName = $(ele).text();
        const description = $(ele).parent().next('p').text();
        if (constantName && description) {
          scrapedData.push({ constant: constantName, description, url });
        }
      });
      return;                                       // leaf node
    }

    // recurse while within depth limit
    if (currentDepth < maxDepth) {
      await Promise.all(linksToFollow.map(link => scrapePage(link, currentDepth + 1, maxDepth)));
    }
  } catch (e) {
    console.error(`Error scraping ${url}: ${e.message}`);
  }
}

(async () => {
  const maxDepth = 2;
  for (const base of baseUrls) {
    await scrapePage(base, 0, maxDepth);
  }
  fs.writeFileSync('scrapedData.json', JSON.stringify(scrapedData, null, 2));
  console.log(`Scraping complete → ${scrapedData.length} records written to scrapedData.json`);
})();
