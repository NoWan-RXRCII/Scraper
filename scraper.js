const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Array of starting URLs to scrape
const baseUrls = [
  'https://help.solidworks.com/2025/english/api/sldworksapi/SolidWorks.Interop.sldworks~SolidWorks.Interop.sldworks_namespace.html?id=f8d6d8535f3a49e7ad0538d96c234df8#Pg0',
  'https://help.solidworks.com/2025/english/api/swconst/SolidWorks.Interop.swconst~SolidWorks.Interop.swconst_namespace.html?id=4c923420736a49a98458345fd708984e#Pg0',
  'https://help.solidworks.com/2025/english/api/SWHelp_List.html?id=24fa32e6abfe4e9384060ed91220d29b#Pg0',
  'https://help.solidworks.com/2025/english/api/SWHelp_List.html?id=a18edefdb6f84d02b62a327123832d52#Pg0'
];

// Array to store scraped data
let scrapedData = [];

// Set to track visited URLs to avoid scraping the same page
let visitedUrls = new Set();

// Function to scrape a page (one level deep)
async function scrapePage(url) {
  if (visitedUrls.has(url)) {
    return; // Skip if the URL is already visited
  }

  try {
    console.log(`Scraping: ${url}`);

    // Mark this URL as visited
    visitedUrls.add(url);

    // Fetch the page content
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'MyScraperBot/1.0' } // Added User-Agent to avoid being blocked
    });
    const $ = cheerio.load(response.data);

    // Scrape constants and their descriptions
    $('code').each((index, element) => {
      let constantName = $(element).text();
      let description = $(element).parent().next('p').text();

      scrapedData.push({
        constant: constantName,
        description: description,
        url: url // Store the page URL
      });
    });

    // Collect links on the page (only one level deep)
    const links = $('a');
    $(links).each((index, link) => {
      let newUrl = $(link).attr('href');

      // If the link is relative, make it absolute
      if (newUrl && !newUrl.startsWith('http')) {
        newUrl = `https://help.solidworks.com${newUrl}`;
      }

      // Only follow links that are within the same SolidWorks documentation domain
      if (newUrl && newUrl.startsWith('https://help.solidworks.com/')) {
        scrapedData.push({
          linkedUrl: newUrl,
          parentUrl: url // Store the parent page URL
        });
      }
    });

  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`);
  }
}

// Start scraping all the base URLs
(async () => {
  for (let baseUrl of baseUrls) {
    await scrapePage(baseUrl); // Scrape each URL in the list
  }

  // Save the scraped data to a JSON file
  fs.writeFileSync('scrapedData.json', JSON.stringify(scrapedData, null, 2));
  console.log('Scraping complete! Data saved to scrapedData.json');
})();
