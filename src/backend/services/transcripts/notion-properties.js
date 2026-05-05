const { STATUS_PROPERTY_NAME, TO_PROCESS_STATUS } = require("./constants");

function buildProperties(payload, propertyMapping) {
  const properties = {};
  const titleName = propertyMapping.title;

  properties[titleName] = {
    title: [
      {
        type: "text",
        text: {
          content: payload.title
        }
      }
    ]
  };

  if (propertyMapping.videoUrl) {
    properties[propertyMapping.videoUrl] = {
      url: payload.url
    };
  }

  if (propertyMapping.videoId) {
    properties[propertyMapping.videoId] = {
      rich_text: [
        {
          type: "text",
          text: {
            content: payload.videoId
          }
        }
      ]
    };
  }

  if (propertyMapping.channel) {
    properties[propertyMapping.channel] = {
      select: {
        name: payload.channel.replaceAll(",", " ")
      }
    };
  }

  if (propertyMapping.lastSyncedAt) {
    properties[propertyMapping.lastSyncedAt] = {
      date: {
        start: payload.capturedAt || new Date().toISOString()
      }
    };
  }

  properties[STATUS_PROPERTY_NAME] = {
    select: {
      name: TO_PROCESS_STATUS
    }
  };

  return properties;
}

function getPageStatusName(page) {
  const statusProperty = page?.properties?.[STATUS_PROPERTY_NAME];
  if (!statusProperty) {
    return "";
  }

  if (statusProperty.type === "status") {
    return statusProperty.status?.name || "";
  }

  if (statusProperty.type === "select") {
    return statusProperty.select?.name || "";
  }

  return "";
}

module.exports = {
  buildProperties,
  getPageStatusName
};
