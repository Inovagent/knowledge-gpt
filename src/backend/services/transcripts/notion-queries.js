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

async function findExistingPage(notion, databaseId, payload, propertyMapping) {
  if (propertyMapping.videoId) {
    const matchById = await queryByProperty(notion, databaseId, propertyMapping.videoId, {
      rich_text: {
        equals: payload.videoId
      }
    });

    if (matchById) {
      return matchById;
    }
  }

  if (propertyMapping.videoUrl) {
    const matchByUrl = await queryByProperty(notion, databaseId, propertyMapping.videoUrl, {
      url: {
        equals: payload.url
      }
    });

    if (matchByUrl) {
      return matchByUrl;
    }
  }

  return null;
}

module.exports = {
  findExistingPage
};
