const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const url = 'https://help.solidworks.com/2025/english/api/swconst/SolidWorks.Interop.swconst~SolidWorks.Interop.swconst_namespace.html'; // Replace with the actual URL

// Fetch the page
axios.get(url)
  .then((response) => {
    const $ = cheerio.load(response.data);
    let scrapedData = [];

    // Example: Scraping for all <code> elements (adjust based on actual page structure)
    $('code').each((index, element) => {
      let constantName = $(element).text(); // Extract the constant name
      let description = $(element).parent().next('p').text(); // Find the description (adjust if needed)
      scrapedData.push({
        constant: constantName,
        description: description
      });
    });

    // Save the scraped data to a JSON file
    fs.writeFileSync('scrapedData.json', JSON.stringify(scrapedData, null, 2));
    console.log('Scraping complete! Data saved to scrapedData.json');
  })
  .catch((error) => {
    console.error('Error scraping the page:', error);
  });
