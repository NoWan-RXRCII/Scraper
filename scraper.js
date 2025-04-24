const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Array of starting URLs to scrape
const baseUrls = [
  'https://help.solidworks.com/2025/english/api/sldworksapi/SolidWorks.Interop.sldworks~SolidWorks.Interop.sldworks_namespace.html?id=f8d6d8535f3a49e7ad0538d96c234df8#Pg0',
  'https://help.solidworks.com/2025/english/api/swconst/SolidWorks.Interop.swconst~SolidWorks.Interop.swconst_namespace.html?id=4c923420736a49a98458345fd708984e#Pg0',
  'https://help.solidworks.com/2025/english/api/SWHelp_List.html?id=24fa32e6abfe4e9384060ed91220d29b#Pg0',
  'https://help.solidworks.com/2025/english/api/SWHelp_List.html?id=a18edefdb6f84d02b62a327123832d52#Pg0',
  'https://help.solidworks.com/2025/english/api/SWHelp_List.html?id=80c5e679128e44599bfa417383245607#Pg0'
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

    // Scrape constants and their descriptions
    if (currentDepth <= maxDepth) {
      $('code').each((index, element) => {
        let constantName = $(element).text();
        let description = $(element).parent().next('p').text();

        scrapedData.push({
          constant: constantName,
          description: description,
          url: url // Store the page URL
        });
      });
    }

    // If at Level 3, scrape only the main body and example section
    if (currentDepth === maxDepth) {
      const mainBody = $('body').text().trim();
      scrapedData.push({
        depth: currentDepth,
        body: mainBody,
        url: url
      });

      // Check for links in the "example section" and go one more level deep
      $('section.example a').each(async (index, link) => {
        let exampleUrl = $(link).attr('href');

        // If the link is relative, make it absolute
        if (exampleUrl && !exampleUrl.startsWith('http')) {
          exampleUrl = `https://help.solidworks.com${exampleUrl}`;
        }

        // Follow links in the example section
        if (exampleUrl && exampleUrl.startsWith('https://help.solidworks.com/')) {
          await scrapePage(exampleUrl, currentDepth + 1, maxDepth + 1); // One extra level for example links
        }
      });

      return; // Stop after scraping the main body and example section
    }

    // Collect links on the page and go deeper
    if (currentDepth < maxDepth) {
      const links = $('a');
      $(links).each(async (index, link) => {
        let newUrl = $(link).attr('href');

        // If the link is relative, make it absolute
        if (newUrl && !newUrl.startsWith('http')) {
          newUrl = `https://help.solidworks.com${newUrl}`;
        }

        // Only follow links that are within the same SolidWorks documentation domain
        if (newUrl && newUrl.startsWith('https://help.solidworks.com/')) {
          await scrapePage(newUrl, currentDepth + 1, maxDepth);
        }
      });
    }

  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`);
  }
}

// Start scraping all the base URLs
(async () => {
  const maxDepth = 3; // Define the maximum depth to scrape

  for (let baseUrl of baseUrls) {
    await scrapePage(baseUrl, 1, maxDepth); // Start scraping with an initial depth of 1
  }

  // Save the scraped data to a JSON file
  fs.writeFileSync('scrapedData.json', JSON.stringify(scrapedData, null, 2));
  console.log('Scraping complete! Data saved to scrapedData.json');
})();
