const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Array of starting URLs to scrape
const baseUrls = [
  'https://help.solidworks.com/2025/english/api/SWHelp_List.html?id=e9a912d06e17425f80be7e8805dc03a6#Pg0',
  'https://help.solidworks.com/2025/english/api/sldworksapi/FunctionalCategories-sldworksapi.html?id=ba81b44c99b64f61b8214eaaa7b0cb06#Pg0',
  'https://help.solidworks.com/2025/english/api/SWHelp_List.html?id=79ca6baa542f4fa8a000139ea01071f1#Pg0',
  'https://help.solidworks.com/2025/english/api/SWHelp_List.html?id=75019a46d48b452fbb81e7713d6ce7b1#Pg0'
];

// Array to store scraped data
let scrapedData = [];

// Set to track visited URLs to avoid scraping the same page
let visitedUrls = new Set();

// Function to scrape a page
async function scrapePage(url) {
  if (visitedUrls.has(url)) {
    return;  // Skip if the URL is already visited
  }

  try {
    console.log(`Scraping: ${url}`);
    
    // Mark this URL as visited
    visitedUrls.add(url);

    // Fetch the page content
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Scrape constants and their descriptions
    $('code').each((index, element) => {
      let constantName = $(element).text();
      let description = $(element).parent().next('p').text();

      scrapedData.push({
        constant: constantName,
        description: description,
        url: url  // Store the page URL
      });
    });

    // Follow links on the page
    const links = $('a');
    $(links).each((index, link) => {
      let newUrl = $(link).attr('href');
      if (newUrl && newUrl.startsWith('http')) {
        scrapePage(newUrl);  // Recursively scrape linked pages
      }
    });
    
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
  }
}

// Start scraping all the base URLs
(async () => {
  for (let baseUrl of baseUrls) {
    await scrapePage(baseUrl);  // Scrape each URL in the list
  }

  // Save the scraped data to a JSON file
  fs.writeFileSync('scrapedData.json', JSON.stringify(scrapedData, null, 2));
  console.log('Scraping complete! Data saved to scrapedData.json');
})();
