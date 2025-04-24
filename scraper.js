const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// The base URLs you provided (these should not be changed)
const baseUrls = [
  'https://help.solidworks.com/2025/english/api/swconst/SolidWorks.Interop.swconst~SolidWorks.Interop.swconst_namespace.html?id=4c923420736a49a98458345fd708984e#Pg0',
  'https://help.solidworks.com/2025/english/api/swdocmgrapi/SolidWorks.Interop.swdocumentmgr~SolidWorks.Interop.swdocumentmgr_namespace.html?id=4044b78005984a01922553042935a3bc#Pg0',
  'https://help.solidworks.com/2025/english/api/sldworksapi/SolidWorks.Interop.sldworks~SolidWorks.Interop.sldworks_namespace.html?id=f8d6d8535f3a49e7ad0538d96c234df8#Pg0'
];

const scrapedData = [];
const visitedUrls = new Set();
const exampleLinks = new Set();  // Prevent re-scraping examples

async function scrapePage(url, currentDepth, maxDepth) {
  if (visitedUrls.has(url)) return; // Skip if URL has already been visited

  console.log(`Scraping (depth ${currentDepth}): ${url}`);
  visitedUrls.add(url);

  try {
    const res = await axios.get(url, { headers: { 'User-Agent': 'MyScraperBot/1.0' } });
    const $ = cheerio.load(res.data);

    const pageData = {
      url,
      remarks: "",
      accessors: [],
      examples: [],
      see_also: [],
    };

    // --- Scrape Depth 0 (Directory Page) ---
    if (currentDepth === 0) {
      let linksSelector;
      if (url.includes('swconst')) {
        // Use enumerationSection for swconst
        linksSelector = '#enumerationSection a';
      } else {
        // Use interfaceSection for swdocmgrapi and sldworksapi
        linksSelector = '#interfaceSection a';
      }

      // Extract links from the selected section
      $(linksSelector).each((index, link) => {
        let newUrl = $(link).attr('href');
        if (newUrl && !newUrl.startsWith('http')) {
          newUrl = `https://help.solidworks.com${newUrl}`;
        }
        if (newUrl && !exampleLinks.has(newUrl)) {
          exampleLinks.add(newUrl);
          scrapePage(newUrl, currentDepth + 1, maxDepth);  // Follow the link to Depth 1 page
        }
      });
    }

    // --- Scrape Depth 1 (Interface Page) ---
    if (currentDepth === 1) {
      // Extract remarks if available
      if ($('#remarksSection').length > 0) {
        pageData.remarks = $('#remarksSection').text().trim();
      }

      // Extract accessors if available
      $('#accessorsSection a').each((index, link) => {
        let accessorUrl = $(link).attr('href');
        if (accessorUrl && !accessorUrl.startsWith('http')) {
          accessorUrl = `https://help.solidworks.com${accessorUrl}`;
        }
        pageData.accessors.push({
          name: $(link).text(),
          url: accessorUrl
        });
      });

      // Extract example code if available (on Depth 1 pages)
      $('pre').each((index, element) => {
        const exampleTitle = $(element).prev('h3').text() || `Example ${index + 1}`;
        pageData.examples.push({
          title: exampleTitle,
          example_code: $(element).text().trim(),
        });
      });

      // Collect "See Also" links
      $('#seeAlsoSection a').each((index, link) => {
        let seeAlsoUrl = $(link).attr('href');
        if (seeAlsoUrl && !seeAlsoUrl.startsWith('http')) {
          seeAlsoUrl = `https://help.solidworks.com${seeAlsoUrl}`;
        }
        pageData.see_also.push(seeAlsoUrl);
      });
    }

    // Store the page data into the final scraped data
    scrapedData.push(pageData);

  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`);
  }
}

// Start scraping all the base URLs
(async () => {
  const maxDepth = 2;  // Max depth to scrape, including directory and interface pages

  for (let baseUrl of baseUrls) {
    await scrapePage(baseUrl, 0, maxDepth);  // Start at Depth 0
  }

  // Save the scraped data to a JSON file
  fs.writeFileSync('scrapedData.json', JSON.stringify(scrapedData, null, 2));
  console.log('Scraping complete! Data saved to scrapedData.json');
})();
