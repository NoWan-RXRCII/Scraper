async function scrapePage(url, currentDepth, maxDepth) {
  if (visitedUrls.has(url)) {
    console.log(`Skipping already visited URL: ${url}`);
    return;
  }

  try {
    console.log(`Scraping (depth ${currentDepth}): ${url}`);
    visitedUrls.add(url);

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'MyScraperBot/1.0' }
    });
    const $ = cheerio.load(response.data);

    let sectionSelector = '#interfaceSection';
    if (url.includes('swconst')) {
      sectionSelector = '#enumerationSection';
    }

    // Depth 1: Extract links from the relevant section
    if (currentDepth === 1) {
      console.log(`Checking section: ${sectionSelector}`);
      $(`${sectionSelector} a`).each(async (index, link) => {
        let newUrl = $(link).attr('href');
        if (newUrl && !newUrl.startsWith('http')) {
          newUrl = `https://help.solidworks.com${newUrl}`;
        }
        console.log(`Extracted link: ${newUrl} at depth ${currentDepth}`);
        if (newUrl) {
          await scrapePage(newUrl, currentDepth + 1, maxDepth);
        }
      });
    }

    // Depth 2: Extract links from the example section
    if (currentDepth === 2) {
      console.log(`Checking #exampleSection`);
      $('#exampleSection a').each(async (index, link) => {
        let exampleUrl = $(link).attr('href');
        if (exampleUrl && !exampleUrl.startsWith('http')) {
          exampleUrl = `https://help.solidworks.com${exampleUrl}`;
        }
        console.log(`Extracted example link: ${exampleUrl} at depth ${currentDepth}`);
        if (exampleUrl) {
          await scrapePage(exampleUrl, currentDepth + 1, maxDepth);
        }
      });
      return; // Stop after processing #exampleSection
    }

    // Collect data from the current page
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
