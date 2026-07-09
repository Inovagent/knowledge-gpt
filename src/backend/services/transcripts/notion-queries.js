const { getSelectPropertyName } = require("./notion-properties");

async function queryByProperty(notion, databaseId, propertyName, filter) {
  if (!propertyName) {
    return null;
  }

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: propertyName,
      ...filter
    },
    page_size: 1
  });

  return response.results[0] || null;
}

async function queryManyByProperty(notion, databaseId, propertyName, filter, pageSize = 10) {
  if (!propertyName) {
    return [];
  }

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: propertyName,
      ...filter
    },
    page_size: pageSize
  });

  return response.results || [];
}

async function findExistingPage(notion, databaseId, payload, propertyMapping) {
  if (propertyMapping.videoId && payload.videoId) {
    const matchById = await queryByProperty(notion, databaseId, propertyMapping.videoId, {
      rich_text: {
        equals: payload.videoId
      }
    });

    if (matchById) {
      return matchById;
    }
  }

  if (payload.contentType === "selection") {
    return null;
  }

  if (propertyMapping.videoUrl && payload.url) {
    const matchByUrl = await queryByProperty(notion, databaseId, propertyMapping.videoUrl, {
      url: {
        equals: payload.url
      }
    });

    if (matchByUrl) {
      return matchByUrl;
    }
  }

  if (propertyMapping.title && payload.title) {
    const titleMatches = await queryManyByProperty(notion, databaseId, propertyMapping.title, {
      title: {
        equals: payload.title
      }
    });

    if (!propertyMapping.channel || !(payload.source || payload.channel)) {
      return titleMatches[0] || null;
    }

    const sourceName = payload.source || payload.channel;
    const matchingPage = titleMatches.find((page) => {
      const currentSource = getSelectPropertyName(page, propertyMapping.channel);
      return currentSource === sourceName;
    });

    if (matchingPage) {
      return matchingPage;
    }
  }

  return null;
}

module.exports = {
  findExistingPage
};
