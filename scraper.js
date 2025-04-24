const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Updated array of starting URLs to scrape
const baseUrls = [
  'https://help.solidworks.com/2025/english/api/swdocmgrapi/SolidWorks.Interop.swdocumentmgr~SolidWorks.Interop.swdocumentmgr_namespace.html?id=4044b78005984a01922553042935a3bc#Pg0',
  'https://help.solidworks.com/2025/english/api/swconst/SolidWorks.Interop.swconst~SolidWorks.Interop.swconst_namespace.html?id=4c923420736a49a98458345fd708984e#Pg0',
  'https://help.solidworks.com/2025/english/api/sldworksapi/SolidWorks.Interop.sldworks~SolidWorks.Interop.sldworks_namespace.html?id=f8d6d8535f3a49e7ad0538d96c234df8#Pg0'
];

// Array to store scraped data
let scrapedData = [];

// Set to track visited URLs to avoid scraping the same page
let visitedUrls = new Set();

// Function to scrape a page up to a certain depth
async function scrapePage(url, currentDepth, maxDepth) {
  if (visitedUrls.has(url)) {
    return; // Skip if the URL is already visited
  }

  try {
    console.log(`Scraping (depth ${currentDepth}): ${url}`);

    // Mark this URL as visited
    visitedUrls.add(url);

    // Fetch the page content
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'MyScraperBot/1.0' } // Added User-Agent to avoid being blocked
    });
    const $ = cheerio.load(response.data);

    // Stop if max depth is reached
    if (currentDepth >= maxDepth) {
      return;
    }

    // Collect links from the relevant sections
    let linksToFollow = [];

    if (currentDepth === 1) {
      $('#interfaceSection a').each((index, link) => {
        let newUrl = $(link).attr('href');

        // If the link is relative, make it absolute
        if (newUrl && !newUrl.startsWith('http')) {
          newUrl = `https://help.solidworks.com${newUrl}`;
        }

        // Only follow links that match the base parent names
        if (newUrl && (newUrl.includes('SolidWorks.Interop.swdocumentmgr') ||
                       newUrl.includes('SolidWorks.Interop.swconst') ||
                       newUrl.includes('SolidWorks.Interop.sldworks'))) {
          linksToFollow.push(newUrl);
        }
      });
    }

    if (currentDepth === 2) {
      $('#exampleSection a').each((index, link) => {
        let exampleUrl = $(link).attr('href');

        // If the link is relative, make it absolute
        if (exampleUrl && !exampleUrl.startsWith('http')) {
          exampleUrl = `https://help.solidworks.com${exampleUrl}`;
        }

        // Follow example links one level deeper
        if (exampleUrl && exampleUrl.startsWith('https://help.solidworks.com/')) {
          linksToFollow.push(exampleUrl);
        }
      });
    }

    // Follow all collected links asynchronously
    await Promise.all(linksToFollow.map(link => scrapePage(link, currentDepth + 1, maxDepth)));

    // Collect content for the current page
    $('code').each((index, element) => {
      let constantName = $(element).text();
      let description = $(element).parent().next('p').text();

      scrapedData.push({
        constant: constantName,
        description: description,
        url: url // Store the page URL
      });
    });

  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`);
  }
}

// Start scraping all the base URLs
(async () => {
  const maxDepth = 2; // Adjusted maximum depth

  for (let baseUrl of baseUrls) {
    await scrapePage(baseUrl, 0, maxDepth); // Start scraping with an initial depth of 0
  }

  // Save the scraped data to a JSON file
  fs.writeFileSync('scrapedData.json', JSON.stringify(scrapedData, null, 2));
  console.log('Scraping complete! Data saved to scrapedData.json');
})();
