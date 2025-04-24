async function scrapePage(url, currentDepth, maxDepth) {
  if (visitedUrls.has(url)) {
    console.log(`Skipping already visited URL: ${url}`);
    return;
  }

  try {
    console.log(`Scraping (depth ${currentDepth}): ${url}`);
    visitedUrls.add(url); // Mark URL as visited

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'MyScraperBot/1.0' }
    });
    const $ = cheerio.load(response.data);

    // Decide which section to scrape based on URL
    let sectionSelector = '#interfaceSection';
    if (url.includes('swconst')) {
      sectionSelector = '#enumerationSection';
    }

    // Stop if max depth is reached
    if (currentDepth >= maxDepth) {
      console.log(`Reached max depth at: ${url}`);
      return;
    }

    // At Depth 1: Extract links and follow them
    if (currentDepth === 1) {
      console.log(`Checking section: ${sectionSelector}`);
      $(`${sectionSelector} a`).each(async (index, link) => {
        let newUrl = $(link).attr('href');
        if (newUrl && !newUrl.startsWith('http')) {
          newUrl = `https://help.solidworks.com${newUrl}`;
        }
        console.log(`Extracted link: ${newUrl} at depth ${currentDepth}`);
        if (newUrl) {
          await scrapePage(newUrl, currentDepth + 1, maxDepth); // Recursively follow the link
        }
      });
    }

    // At Depth 2: Extract example links and stop after one level deeper
    if (currentDepth === 2) {
      console.log(`Checking #exampleSection`);
      $('#exampleSection a').each(async (index, link) => {
        let exampleUrl = $(link).attr('href');
        if (exampleUrl && !exampleUrl.startsWith('http')) {
          exampleUrl = `https://help.solidworks.com${exampleUrl}`;
        }
        console.log(`Extracted example link: ${exampleUrl} at depth ${currentDepth}`);
        if (exampleUrl) {
          await scrapePage(exampleUrl, currentDepth + 1, maxDepth); // Recursively follow the link
        }
      });
      return; // Stop after processing examples
    }

    // Collect data for the current page
    $('code').each((index, element) => {
      const constantName = $(element).text();
      const description = $(element).parent().next('p').text();
      scrapedData.push({ constant: constantName, description: description, url: url });
      console.log(`Collected: ${constantName} - ${description}`);
    });

  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`);
  }
}
